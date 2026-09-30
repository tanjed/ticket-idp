import { AuthzClient } from "../authz";
import { ContextStore } from "../ctx";
import { inject, singleton } from "../di";
import { FlowResponder } from "../handlers";
import { HydraAdmin, userType } from "../hydra";
import { claimsFor, emailVerified, KratosAdmin, phoneVerified } from "../identity";

// Hydra's three handlers: urls.login, urls.consent, urls.logout.
@singleton()
export class OAuthController {
  constructor(
    @inject(HydraAdmin) private readonly hydra: HydraAdmin,
    @inject(KratosAdmin) private readonly kratos: KratosAdmin,
    @inject(AuthzClient) private readonly authz: AuthzClient,
    @inject(ContextStore) private readonly store: ContextStore,
    @inject(FlowResponder) private readonly respond: FlowResponder,
  ) {}

  // The only entry point to authentication: validates the challenge and pins it to this browser
  // in the encrypted context cookie.
  async login(req: Request): Promise<Response> {
    const challenge = new URL(req.url).searchParams.get("login_challenge");
    if (!challenge) return new Response("Missing login_challenge", { status: 400 });

    const login = await this.hydra.getLoginRequest(challenge).catch(() => null);
    if (!login) return new Response("Unknown or expired login request", { status: 400 });

    // Remembered login: no credentials needed.
    if (login.skip) {
      const { redirect_to } = await this.hydra.acceptLogin(challenge, { subject: login.subject });
      return Response.redirect(redirect_to, 303);
    }

    await this.store.set({ ch: challenge });
    const signup = new URL(login.request_url).searchParams.get("screen_hint") === "signup";
    return this.respond.to(signup ? "/registration" : "/login");
  }

  // First-party clients: granted automatically, with fresh claims. Provider clients also get the
  // user's company and roles from Authz, read fresh here, so a remembered login cannot mint a
  // provider token for someone who left their company.
  async consent(req: Request): Promise<Response> {
    const challenge = new URL(req.url).searchParams.get("consent_challenge");
    if (!challenge) return new Response("Missing consent_challenge", { status: 400 });

    const consent = await this.hydra.getConsentRequest(challenge);
    const identity = await this.kratos.getIdentity(consent.subject);
    if (!identity) return new Response("Unknown subject", { status: 400 });

    // Also in the JWT (allowed_top_level_claims).
    const accessToken: Record<string, unknown> = {
      email_verified: emailVerified(identity),
      phone_number_verified: phoneVerified(identity),
      user_type: userType(consent.client),
    };
    if (accessToken.user_type === "provider") {
      const claims = await this.authz.getClaims(consent.subject);
      if (!claims.ok) {
        const { redirect_to } = await this.hydra.rejectConsent(challenge, claims.status === 404 || claims.status === 403
          ? { error: "access_denied", error_description: claims.status === 403 ? "The company is suspended." : "The user belongs to no company.", status_code: 403 }
          : { error: "temporarily_unavailable", error_description: "Authorization is unavailable. Try again.", status_code: 503 });
        return Response.redirect(redirect_to, 302);
      }
      accessToken.company_id = claims.body.company_id;
      accessToken.roles = claims.body.roles;
    }

    const { redirect_to } = await this.hydra.acceptConsent(challenge, {
      grant_scope: consent.requested_scope,
      grant_access_token_audience: consent.requested_access_token_audience,
      remember: true,
      remember_for: 3600,
      session: {
        id_token: claimsFor(identity, consent.requested_scope),
        access_token: accessToken,
      },
    });
    return Response.redirect(redirect_to, 302);
  }

  // Only Hydra's session is left to end (Kratos sessions are revoked at login).
  async logout(req: Request): Promise<Response> {
    const challenge = new URL(req.url).searchParams.get("logout_challenge");
    if (!challenge) return new Response("Missing logout_challenge", { status: 400 });
    const { redirect_to } = await this.hydra.acceptLogout(challenge);
    return Response.redirect(redirect_to, 303);
  }
}
