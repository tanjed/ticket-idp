import { AuthzClient } from "./authz";
import { CompanyClient } from "./company";
import { ContextStore, type Ctx } from "./ctx";
import { inject, singleton } from "./di";
import { FlowResponder } from "./handlers";
import { HydraAdmin, userType } from "./hydra";
import { KratosAdmin, phoneVerified } from "./identity";

const expired = () =>
  new Response("This sign-in request has expired. Please go back to your app and try again.", { status: 400 });

@singleton()
export class LoginService {
  constructor(
    @inject(KratosAdmin) private readonly kratos: KratosAdmin,
    @inject(HydraAdmin) private readonly hydra: HydraAdmin,
    @inject(AuthzClient) private readonly authz: AuthzClient,
    @inject(CompanyClient) private readonly company: CompanyClient,
    @inject(ContextStore) private readonly store: ContextStore,
    @inject(FlowResponder) private readonly respond: FlowResponder,
  ) {}

  // Authenticated and phone-verified: accept the Hydra login and follow redirect_to. Through a
  // provider app the user must also belong to a company (Authz); consent puts it in the token.
  async finish(ctx: Ctx, sub: string): Promise<Response> {
    const identity = await this.kratos.getIdentity(sub);
    if (!identity || !phoneVerified(identity)) {
      return this.respond.backWithText("/login", { ch: ctx.ch, exp: ctx.exp }, "Your mobile number is not verified.");
    }
    // The client decides the user type; read it from Hydra rather than trusting anything we stored.
    const login = await this.hydra.getLoginRequest(ctx.ch).catch(() => null);
    if (!login) {
      await this.store.clear();
      return expired();
    }
    if (userType(login.client) === "provider") {
      let claims = await this.authz.getClaims(sub);
      if (!claims.ok && claims.status === 404 && ctx.cn) {
        // Provider signup: the company name rode in the encrypted context; create the company now
        // that the phone is verified, then read the claims again (Authz asks Company). Any failure
        // lands on /company with the name prefilled; submitting it again is idempotent and
        // finishes a half-made company. The pending name leaves the context here.
        const made = await this.provision(ctx.cn, sub);
        if (made.ok) claims = made;
        else {
          return this.respond.backWithText("/company", { ch: ctx.ch, exp: ctx.exp, sub, co: true },
            "Your company could not be created right now. Please try again.", "error", undefined, { company: ctx.cn });
        }
      }
      if (!claims.ok) {
        const fresh = { ch: ctx.ch, exp: ctx.exp };
        if (claims.status === 404) {
          await this.store.set({ ...fresh, sub, co: true });
          return this.respond.to("/company");
        }
        return this.respond.backWithText("/login", fresh, claims.status === 403
          ? "Your company's access is suspended. Please contact your company administrator."
          : "Sign-in is unavailable right now. Please try again.");
      }
    }
    try {
      const { redirect_to } = await this.hydra.acceptLogin(ctx.ch, { subject: sub, remember: true, remember_for: 3600 });
      await this.store.clear();
      return Response.redirect(redirect_to, 303);
    } catch {
      await this.store.clear();
      return expired();
    }
  }

  // Create the company, then fetch the claims. Both are retried once: Company answers
  // "unavailable" when Authz could not finish the setup (calling again finishes it), and Authz's
  // claims fail while the company is still pending.
  private async provision(name: string, sub: string) {
    let created = await this.company.createCompany(name, sub);
    if (!created.ok && (created.reason === "unavailable" || created.status === 0 || created.status >= 500)) {
      created = await this.company.createCompany(name, sub);
    }
    if (!created.ok) return created;
    let claims = await this.authz.getClaims(sub);
    if (!claims.ok && claims.status !== 404) claims = await this.authz.getClaims(sub);
    return claims;
  }
}
