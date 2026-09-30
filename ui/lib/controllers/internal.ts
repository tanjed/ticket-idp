import { Config } from "../config";
import { inject, singleton } from "../di";
import { EventPublisher } from "../events";
import { KratosAdmin } from "../identity";
import { InternalGuard } from "../internal";
import { InviteTokens } from "../invite-token";

// Called by Authz only, on the UI's service name.
@singleton()
export class InternalController {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(InternalGuard) private readonly guard: InternalGuard,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
    @inject(InviteTokens) private readonly tokens: InviteTokens,
    @inject(EventPublisher) private readonly events: EventPublisher,
  ) {}

  // The identity id for a phone, so Authz can refuse to invite someone who already belongs to a
  // company. 404 when there is none.
  async identityByPhone(req: Request): Promise<Response> {
    const refused = this.guard.refusePublicHost(req);
    if (refused) return refused;

    const phone = new URL(req.url).searchParams.get("phone") ?? "";
    if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return new Response("Bad phone", { status: 400 });
    const id = await this.admin.identityIdByPhone(phone);
    return id ? Response.json({ id }) : new Response("Not found", { status: 404 });
  }

  // Deliver a staff invitation: publishes USER_INVITED with the signed link (the notification
  // service sends the SMS). 503 when Kafka is down, so Authz drops the invitation.
  async sendInvitation(req: Request): Promise<Response> {
    const refused = this.guard.refusePublicHost(req);
    if (refused) return refused;

    const body = await req.json().catch(() => null);
    const { invitation_id, phone, company_name, expires_at } = body ?? {};
    const expires = new Date(expires_at);
    if (typeof invitation_id !== "string" || typeof phone !== "string" || typeof company_name !== "string" || isNaN(expires.getTime())) {
      return new Response("Bad invitation", { status: 400 });
    }

    const url = `${this.config.publicUiUrl}/invite?token=${encodeURIComponent(this.tokens.sign(invitation_id, phone, expires))}`;
    // Local dev: log the link (nothing consumes the event).
    if (this.config.devLogLinks) console.log(`[invite] ${phone} -> ${url}`);

    try {
      await this.events.publish("USER_INVITED", {
        recipient: phone,
        phone,
        company_name,
        invitation_id,
        invite_url: url,
        expires_at: expires.toISOString(),
      });
      return Response.json({ ok: true });
    } catch (e) {
      console.error("[invite] USER_INVITED not published:", (e as Error).message);
      return new Response("Event bus unavailable", { status: 503 });
    }
  }
}
