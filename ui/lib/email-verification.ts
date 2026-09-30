import { Config } from "./config";
import { inject, singleton } from "./di";
import { EmailTokens } from "./email-token";
import { EventPublisher } from "./events";
import { KratosAdmin } from "./identity";

// Email verification by signed link. Kratos only tracks the phone, so the verified state lives
// in metadata_public (readable from the session).
@singleton()
export class EmailVerification {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(EmailTokens) private readonly tokens: EmailTokens,
    @inject(EventPublisher) private readonly events: EventPublisher,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
  ) {}

  // Publishes USER_EMAIL_VERIFICATION_REQUEST. Throws if Kafka is unreachable.
  async send(identityId: string, email: string, firstName?: string, clientId?: string) {
    const url = `${this.config.publicUiUrl}/verify-email?token=${encodeURIComponent(this.tokens.sign(identityId, email, { cid: clientId }))}`;

    // Local dev: log the link (nothing consumes the event).
    if (this.config.devLogLinks) console.log(`[email-verification] ${email} -> ${url}`);

    await this.events.publish("USER_EMAIL_VERIFICATION_REQUEST", {
      identity_id: identityId,
      email,
      first_name: firstName ?? null,
      verification_url: url,
      expires_in: "24h",
    });
  }

  async markVerified(identityId: string, email: string): Promise<boolean> {
    const identity = await this.admin.getIdentity(identityId);
    if (!identity) return false;

    // The token is bound to the email it was issued for.
    if (identity.traits?.email?.toLowerCase() !== email.toLowerCase()) return false;

    // Already verified: keep the timestamp, don't announce again.
    if (identity.metadata_public?.email_verified_at) return true;

    const ok = await this.admin.setMetadataPublic(identityId, {
      ...(identity.metadata_public ?? {}),
      email_verified_at: new Date().toISOString(),
    });
    if (!ok) return false;

    await this.events.publish("USER_EMAIL_VERIFICATION_SUCCESS", {
      identity_id: identityId,
      email,
      first_name: identity.traits?.name?.first ?? null,
    }).catch((e) => console.error("[events] USER_EMAIL_VERIFICATION_SUCCESS not published:", e.message));
    return true;
  }
}
