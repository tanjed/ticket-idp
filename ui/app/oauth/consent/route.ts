import { getClaims } from "@/lib/authz";
import { acceptConsent, getConsentRequest, rejectConsent, userType } from "@/lib/hydra";
import { claimsFor, emailVerified, getIdentity, phoneVerified } from "@/lib/identity";

// Hydra's urls.consent. First-party clients: granted automatically, with fresh claims.
// Provider clients also get the user's company and roles from Authz, read fresh here, so a
// remembered login cannot mint a provider token for someone who left their company.
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("consent_challenge");
  if (!challenge) return new Response("Missing consent_challenge", { status: 400 });

  const consent = await getConsentRequest(challenge);
  const identity = await getIdentity(consent.subject);
  if (!identity) return new Response("Unknown subject", { status: 400 });

  // Also in the JWT (allowed_top_level_claims).
  const accessToken: Record<string, unknown> = {
    email_verified: emailVerified(identity),
    phone_number_verified: phoneVerified(identity),
    user_type: userType(consent.client),
  };
  if (accessToken.user_type === "provider") {
    const claims = await getClaims(consent.subject);
    if (!claims.ok) {
      const { redirect_to } = await rejectConsent(challenge, claims.status === 404 || claims.status === 403
        ? { error: "access_denied", error_description: claims.status === 403 ? "The company is suspended." : "The user belongs to no company.", status_code: 403 }
        : { error: "temporarily_unavailable", error_description: "Authorization is unavailable. Try again.", status_code: 503 });
      return Response.redirect(redirect_to, 302);
    }
    accessToken.company_id = claims.body.company_id;
    accessToken.roles = claims.body.roles;
  }

  const { redirect_to } = await acceptConsent(challenge, {
    grant_scope: consent.requested_scope,
    grant_access_token_audience: consent.requested_access_token_audience,
    remember: true,
    remember_for: 3600,
    session: {
      id_token: claimsFor(identity, consent.requested_scope),
      access_token: accessToken,
    },
  });
  return Response.redirect(redirect_to, 302);
}
