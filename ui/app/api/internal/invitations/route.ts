import { publishEvent } from "@/lib/events";
import { refusePublicHost } from "@/lib/internal";
import { signInviteToken } from "@/lib/invite-token";

const UI_URL = process.env.PUBLIC_UI_URL ?? "http://localhost:3001";

// Internal (Authz): deliver a staff invitation. Publishes USER_INVITED with the signed link (the
// notification service sends the SMS). 503 when Kafka is down, so Authz drops the invitation.
export async function POST(req: Request) {
  const refused = refusePublicHost(req);
  if (refused) return refused;

  const body = await req.json().catch(() => null);
  const { invitation_id, phone, company_name, expires_at } = body ?? {};
  const expires = new Date(expires_at);
  if (typeof invitation_id !== "string" || typeof phone !== "string" || typeof company_name !== "string" || isNaN(expires.getTime())) {
    return new Response("Bad invitation", { status: 400 });
  }

  const url = `${UI_URL}/invite?token=${encodeURIComponent(signInviteToken(invitation_id, phone, expires))}`;
  // Local dev: log the link (nothing consumes the event).
  if (process.env.DEV_LOG_EMAIL_LINKS) console.log(`[invite] ${phone} -> ${url}`);

  try {
    await publishEvent("USER_INVITED", {
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
