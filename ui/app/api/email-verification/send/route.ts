import { authenticate, json, preflight, rateLimit } from "@/lib/api";
import { emailVerified, getIdentity } from "@/lib/identity";
import { sendEmailVerification } from "@/lib/email-verification";

export const OPTIONS = preflight;

// Emails a verification link to the caller's user (Bearer token).
// "Return to app" later goes to the client's registered redirect URI.
export async function POST(req: Request) {
  const caller = await authenticate(req);
  if (!caller) return json(req, { error: "invalid_token" }, 401, { "www-authenticate": "Bearer" });

  const identity = await getIdentity(caller.sub);
  if (!identity?.traits.email) return json(req, { error: "unknown_user" }, 404);
  if (emailVerified(identity)) return json(req, { status: "already_verified" });

  const limit = rateLimit(`send:${identity.id}`, 3, 10 * 60 * 1000);
  if (!limit.ok) {
    return json(req, { error: "rate_limited", retry_after: limit.retryAfter }, 429, { "retry-after": String(limit.retryAfter) });
  }

  try {
    await sendEmailVerification(identity.id, identity.traits.email, identity.traits.name?.first, caller.clientId);
  } catch (e) {
    console.error("[email-verification] could not publish event:", (e as Error).message);
    return json(req, { error: "delivery_unavailable" }, 503);
  }
  return json(req, { status: "sent" });
}
