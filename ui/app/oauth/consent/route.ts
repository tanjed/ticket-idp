import { acceptConsent, getConsentRequest } from "@/lib/hydra";
import { claimsFor, emailVerified, getIdentity, phoneVerified } from "@/lib/identity";

// Hydra's urls.consent. First-party clients: granted automatically, with fresh claims.
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("consent_challenge");
  if (!challenge) return new Response("Missing consent_challenge", { status: 400 });

  const consent = await getConsentRequest(challenge);
  const identity = await getIdentity(consent.subject);
  if (!identity) return new Response("Unknown subject", { status: 400 });

  const { redirect_to } = await acceptConsent(challenge, {
    grant_scope: consent.requested_scope,
    grant_access_token_audience: consent.requested_access_token_audience,
    remember: true,
    remember_for: 3600,
    session: {
      id_token: claimsFor(identity, consent.requested_scope),
      // Also in the JWT (allowed_top_level_claims).
      access_token: {
        email_verified: emailVerified(identity),
        phone_number_verified: phoneVerified(identity),
      },
    },
  });
  return Response.redirect(redirect_to, 302);
}
