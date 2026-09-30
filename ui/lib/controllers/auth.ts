import { AuthzClient } from "../authz";
import { ContextStore } from "../ctx";
import { DevOtp } from "../dev-otp";
import { inject, singleton } from "../di";
import { EmailVerification } from "../email-verification";
import type { ContinueWith } from "../flow";
import { FlowResponder, str } from "../handlers";
import { KratosAdmin } from "../identity";
import { KratosPublic } from "../kratos-api";
import { csrfOf, KratosBrowser } from "../kratos-browser";
import { LoginService } from "../login";

// The auth pages' form POSTs: login, registration, phone OTP, recovery, new password, company.
// Every one needs the context cookie (FlowResponder.guard).
@singleton()
export class AuthController {
  constructor(
    @inject(FlowResponder) private readonly respond: FlowResponder,
    @inject(ContextStore) private readonly store: ContextStore,
    @inject(KratosPublic) private readonly kratos: KratosPublic,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
    @inject(KratosBrowser) private readonly browser: KratosBrowser,
    @inject(DevOtp) private readonly otp: DevOtp,
    @inject(EmailVerification) private readonly emails: EmailVerification,
    @inject(AuthzClient) private readonly authz: AuthzClient,
    @inject(LoginService) private readonly login: LoginService,
  ) {}

  async submitLogin(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;

    const form = await req.formData();
    const identifier = str(form.get("identifier"));
    const password = String(form.get("password") ?? "");

    const flow = await this.kratos.newFlow("login");
    if (!flow.ok) return new Response("Login is unavailable", { status: 502 });
    const res = await this.kratos.submitFlow("login", flow.body.id, { method: "password", identifier, password });

    if (res.ok && res.body?.session_token) {
      const sub = res.body.session.identity.id;
      await this.kratos.revokeSession(res.body.session_token);
      return this.login.finish(ctx, sub);
    }

    // Right password, unverified phone: Kratos opened the OTP flow (API mode: a 403,
    // with the flow under error.details).
    const actions: ContinueWith[] = res.body?.continue_with ?? res.body?.error?.details?.continue_with ?? [];
    const cw = actions.find((a) => a.action === "show_verification_ui");
    if (cw && "flow" in cw) {
      const sub = await this.admin.identityIdByPhone(identifier);
      if (sub) {
        await this.store.set({ ch: ctx.ch, sub, phone: identifier, vfl: cw.flow.id });
        return this.respond.to("/verification");
      }
    }

    return this.respond.back("/login", ctx, res.body, { identifier });
  }

  async submitRegistration(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;

    const form = await req.formData();
    const password = String(form.get("password") ?? "");
    const traits = {
      name: { first: str(form.get("traits.name.first")), last: str(form.get("traits.name.last")) },
      phone: str(form.get("traits.phone")),
      email: str(form.get("traits.email")),
      gender: str(form.get("traits.gender")),
    };
    // Re-shown after an error (never the password).
    const values = {
      "traits.name.first": traits.name.first, "traits.name.last": traits.name.last,
      "traits.phone": traits.phone, "traits.email": traits.email, "traits.gender": traits.gender,
    };

    const flow = await this.kratos.newFlow("registration");
    if (!flow.ok) return new Response("Registration is unavailable", { status: 502 });
    const res = await this.kratos.submitFlow("registration", flow.body.id, { method: "password", password, traits });
    if (!res.ok) return this.respond.back("/registration", ctx, res.body, values);

    // Kratos' hook announces USER_REGISTERED; the email link is ours. Not awaited:
    // a Kafka outage must not slow or fail a signup.
    const identityId: string | undefined = res.body.identity?.id;
    if (identityId) {
      this.emails.send(identityId, traits.email, traits.name.first)
        .catch((e) => console.error("[events] USER_EMAIL_VERIFICATION_REQUEST not published:", e.message));
    }

    // Revoke the Kratos session: nobody is signed in until the OTP is done.
    if (res.body.session_token) await this.kratos.revokeSession(res.body.session_token);
    const cw: ContinueWith | undefined = res.body.continue_with?.find((a: ContinueWith) => a.action === "show_verification_ui");
    if (!cw || !("flow" in cw) || !res.body.identity?.id) {
      return new Response("Account created, but the verification step could not be started. Please log in.", { status: 500 });
    }
    await this.store.set({ ch: ctx.ch, sub: res.body.identity.id, phone: traits.phone, vfl: cw.flow.id });
    return this.respond.to("/verification");
  }

  async submitVerification(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;
    if (!ctx.vfl || !ctx.sub || !ctx.phone) return new Response("No verification in progress", { status: 400 });

    const form = await req.formData();

    // Kratos only sends an SMS from its hooks, so "resend" = log in again.
    if (str(form.get("intent")) === "resend") {
      return this.respond.backWithText("/login", { ch: ctx.ch, exp: ctx.exp },
        "Enter your password and we will send you a new OTP.", "info", undefined, { identifier: ctx.phone });
    }

    const code = await this.otp.resolve(str(form.get("code")));
    const res = await this.kratos.submitFlow("verification", ctx.vfl, { method: "code", code });
    if (res.ok && res.body?.state === "passed_challenge") return this.login.finish(ctx, ctx.sub);
    return this.respond.back("/verification", ctx, res.body);
  }

  async submitRecovery(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;

    const form = await req.formData();
    const intent = str(form.get("intent"));

    // Same answer whether or not the address exists.
    if (intent === "send" || intent === "resend") {
      const email = intent === "send" ? str(form.get("email")) : ctx.email;
      if (!email) return this.respond.to("/recovery");
      const flow = await this.browser.startFlow("recovery");
      if (!flow.ok) return new Response("Recovery is unavailable", { status: 502 });
      const csrf = csrfOf(flow.body);
      const res = await this.browser.submit("recovery", flow.body.id, { method: "code", email, csrf_token: csrf }, flow.jar);
      if (!res.ok) return this.respond.back("/recovery", ctx, res.body, { email });
      await this.store.set({ ch: ctx.ch, email, rfl: flow.body.id, rcsrf: csrf, kj: res.jar });
      return this.respond.to("/recovery");
    }

    // Success is a redirect answer plus a privileged session cookie.
    if (!ctx.rfl || !ctx.kj) return this.respond.to("/recovery");
    const code = await this.otp.resolve(str(form.get("code")));
    const res = await this.browser.submit("recovery", ctx.rfl, { method: "code", code, csrf_token: ctx.rcsrf }, ctx.kj);
    const target: string | undefined = res.body?.redirect_browser_to;
    const settingsFlow = target && new URL(target).searchParams.get("flow");
    if (settingsFlow) {
      await this.store.set({ ch: ctx.ch, email: ctx.email, kj: res.jar, sfl: settingsFlow });
      return this.respond.to("/settings");
    }
    return this.respond.back("/recovery", ctx, res.body);
  }

  async submitSettings(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;
    if (!ctx.kj || !ctx.sfl) return new Response("No password reset in progress", { status: 400 });

    const password = String((await req.formData()).get("password") ?? "");
    const flow = await this.browser.readFlow("settings", ctx.sfl, ctx.kj);
    if (!flow.ok) return this.respond.backWithText("/recovery", { ch: ctx.ch, exp: ctx.exp }, "Your reset session expired. Request a new code.");

    const res = await this.browser.submit("settings", ctx.sfl, { method: "password", password, csrf_token: csrfOf(flow.body) }, flow.jar);
    if (!res.ok) return this.respond.back("/settings", ctx, res.body);

    // Done: end the recovery session; log in with the new password.
    await this.browser.endSession(res.jar);
    return this.respond.backWithText("/login", { ch: ctx.ch, exp: ctx.exp }, "Password updated. Log in with your new password.", "success");
  }

  // Company onboarding: create a company (becoming its admin), then finish the login.
  async submitCompany(req: Request): Promise<Response> {
    const g = await this.respond.guard(req);
    if ("res" in g) return g.res;
    const { ctx } = g;
    if (!ctx.co || !ctx.sub) return this.respond.noContext();

    const name = str((await req.formData()).get("company"));
    const res = await this.authz.createCompany(name, ctx.sub);
    if (!res.ok) {
      const text = res.reason === "invalid_name"
        ? "Enter a company name of up to 100 characters."
        : "Your company could not be created right now. Please try again.";
      return this.respond.backWithText("/company", ctx, text, "error", undefined, { company: name });
    }
    // finish re-checks the phone and the membership, then accepts the Hydra login.
    return this.login.finish(ctx, ctx.sub);
  }
}
