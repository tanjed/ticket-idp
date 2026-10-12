import { Config } from "../config";
import { inject, singleton } from "../di";
import { EventPublisher } from "../events";
import { KratosAdmin } from "../identity";
import { InviteTokens } from "../invite-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Called by Authz (identity lookup by phone) and Company (profiles by ids, invitation SMS) only. Internal: the ingress must never route /api/internal/*.
@singleton()
export class InternalController {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
    @inject(InviteTokens) private readonly tokens: InviteTokens,
    @inject(EventPublisher) private readonly events: EventPublisher,
  ) {}

  // ?ids= is Company's profile lookup; anything else is Authz's id-by-phone lookup (?phone=).
  identities(req: Request): Promise<Response> {
    return new URL(req.url).searchParams.has("ids") ? this.identitiesByIds(req) : this.identityByPhone(req);
  }

  // The identity id for a phone, so callers can refuse to invite someone who already belongs to a
  // company. 404 when there is none.
  async identityByPhone(req: Request): Promise<Response> {
    const phone = new URL(req.url).searchParams.get("phone") ?? "";
    if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return new Response("Bad phone", { status: 400 });
    const id = await this.admin.identityIdByPhone(phone);
    return id ? Response.json({ id }) : new Response("Not found", { status: 404 });
  }

  // Profiles for up to 100 identity ids (Company's user list). Unknown ids are omitted; 502 when
  // Kratos fails, so Company degrades rather than showing everyone as unknown.
  async identitiesByIds(req: Request): Promise<Response> {
    const raw = new URL(req.url).searchParams.get("ids") ?? "";
    const ids = [...new Set(raw.split(",").filter(Boolean))];
    if (ids.length === 0 || ids.length > 100 || !ids.every((i) => UUID.test(i))) return new Response("Bad ids", { status: 400 });
    const found = await this.admin.identitiesByIds(ids);
    if (!found) return new Response("Identity store unavailable", { status: 502 });
    return Response.json({
      identities: found.map((i) => ({
        id: i.id,
        name: [i.traits.name?.first, i.traits.name?.last].filter(Boolean).join(" "),
        phone: i.traits.phone ?? "",
        email: i.traits.email ?? "",
      })),
    });
  }

  // Deliver a staff invitation: publishes USER_INVITED with the signed link (the notification
  // service sends the SMS). 503 when Kafka is down, so Company drops the invitation.
  async sendInvitation(req: Request): Promise<Response> {
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
