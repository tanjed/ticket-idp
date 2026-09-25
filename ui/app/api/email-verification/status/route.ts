import { authenticate, json, preflight } from "@/lib/api";
import { emailVerified, getIdentity } from "@/lib/identity";

export const OPTIONS = preflight;

// Live state, so a client needn't wait for a new ID token.
export async function GET(req: Request) {
  const caller = await authenticate(req);
  if (!caller) return json(req, { error: "invalid_token" }, 401, { "www-authenticate": "Bearer" });

  const identity = await getIdentity(caller.sub);
  if (!identity) return json(req, { error: "unknown_user" }, 404);
  return json(req, { email: identity.traits.email, email_verified: emailVerified(identity) });
}
