import { signEmailToken } from "./email-token";
import { publishEvent } from "./events";

const ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";
const UI_URL = process.env.PUBLIC_UI_URL ?? "http://localhost:3001";

// Publishes USER_EMAIL_VERIFICATION_REQUEST. Throws if Kafka is unreachable.
export async function sendEmailVerification(
  identityId: string,
  email: string,
  firstName?: string,
  clientId?: string,
) {
  const url = `${UI_URL}/verify-email?token=${encodeURIComponent(signEmailToken(identityId, email, { cid: clientId }))}`;

  // Local dev: log the link (nothing consumes the event).
  if (process.env.DEV_LOG_EMAIL_LINKS) console.log(`[email-verification] ${email} -> ${url}`);

  await publishEvent("USER_EMAIL_VERIFICATION_REQUEST", {
    identity_id: identityId,
    email,
    first_name: firstName ?? null,
    verification_url: url,
    expires_in: "24h",
  });
}

type Identity = { traits?: { email?: string; name?: { first?: string } }; metadata_public?: Record<string, unknown> | null };

// Kratos only tracks the phone, so email verification lives in metadata_public
// (readable from the session).
export async function markEmailVerified(identityId: string, email: string): Promise<boolean> {
  const res = await fetch(`${ADMIN}/admin/identities/${identityId}`, { cache: "no-store" });
  if (!res.ok) return false;
  const identity: Identity = await res.json();

  // The token is bound to the email it was issued for.
  if (identity.traits?.email?.toLowerCase() !== email.toLowerCase()) return false;

  // Already verified: keep the timestamp, don't announce again.
  if (identity.metadata_public?.email_verified_at) return true;

  const patch = await fetch(`${ADMIN}/admin/identities/${identityId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([
      {
        op: "add",
        path: "/metadata_public",
        value: { ...(identity.metadata_public ?? {}), email_verified_at: new Date().toISOString() },
      },
    ]),
  });
  if (!patch.ok) return false;

  await publishEvent("USER_EMAIL_VERIFICATION_SUCCESS", {
    identity_id: identityId,
    email,
    first_name: identity.traits?.name?.first ?? null,
  }).catch((e) => console.error("[events] USER_EMAIL_VERIFICATION_SUCCESS not published:", e.message));
  return true;
}
