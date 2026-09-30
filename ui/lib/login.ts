import { AuthzClient } from "./authz";
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
      const claims = await this.authz.getClaims(sub);
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
}
