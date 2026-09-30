import { ApiResponder, BearerAuth, RateLimiter } from "../api";
import { inject, singleton } from "../di";
import { EmailVerification } from "../email-verification";
import { emailVerified, KratosAdmin } from "../identity";

// The bearer-token API for client apps: send a verification link, read the live state.
@singleton()
export class EmailVerificationApiController {
  constructor(
    @inject(ApiResponder) private readonly api: ApiResponder,
    @inject(BearerAuth) private readonly auth: BearerAuth,
    @inject(RateLimiter) private readonly limiter: RateLimiter,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
    @inject(EmailVerification) private readonly emails: EmailVerification,
  ) {}

  options(req: Request): Response {
    return this.api.preflight(req);
  }

  // Emails a verification link to the caller's user. "Return to app" later goes to the client's
  // registered redirect URI.
  async send(req: Request): Promise<Response> {
    const caller = await this.auth.authenticate(req);
    if (!caller) return this.api.json(req, { error: "invalid_token" }, 401, { "www-authenticate": "Bearer" });

    const identity = await this.admin.getIdentity(caller.sub);
    if (!identity?.traits.email) return this.api.json(req, { error: "unknown_user" }, 404);
    if (emailVerified(identity)) return this.api.json(req, { status: "already_verified" });

    const limit = this.limiter.hit(`send:${identity.id}`, 3, 10 * 60 * 1000);
    if (!limit.ok) {
      return this.api.json(req, { error: "rate_limited", retry_after: limit.retryAfter }, 429, { "retry-after": String(limit.retryAfter) });
    }

    try {
      await this.emails.send(identity.id, identity.traits.email, identity.traits.name?.first, caller.clientId);
    } catch (e) {
      console.error("[email-verification] could not publish event:", (e as Error).message);
      return this.api.json(req, { error: "delivery_unavailable" }, 503);
    }
    return this.api.json(req, { status: "sent" });
  }

  // Live state, so a client needn't wait for a new ID token.
  async status(req: Request): Promise<Response> {
    const caller = await this.auth.authenticate(req);
    if (!caller) return this.api.json(req, { error: "invalid_token" }, 401, { "www-authenticate": "Bearer" });

    const identity = await this.admin.getIdentity(caller.sub);
    if (!identity) return this.api.json(req, { error: "unknown_user" }, 404);
    return this.api.json(req, { email: identity.traits.email, email_verified: emailVerified(identity) });
  }
}
