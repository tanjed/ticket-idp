const ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";

export type Identity = {
  id: string;
  traits: { email?: string; phone?: string; gender?: string; name?: { first?: string; last?: string } };
  metadata_public?: { email_verified_at?: string } | null;
  verifiable_addresses?: { via: string; value: string; verified: boolean }[];
};

export async function getIdentity(id: string): Promise<Identity | null> {
  const res = await fetch(`${ADMIN}/admin/identities/${encodeURIComponent(id)}`, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

export const phoneVerified = (i: Identity) => !!i.verifiable_addresses?.find((a) => a.via === "sms")?.verified;
export const emailVerified = (i: Identity) => !!i.metadata_public?.email_verified_at;

// OIDC claims by scope; email state is read live, so each consent is fresh.
export function claimsFor(i: Identity, scopes: string[]): Record<string, unknown> {
  const claims: Record<string, unknown> = {};
  if (scopes.includes("profile")) {
    const { first, last } = i.traits.name ?? {};
    claims.name = [first, last].filter(Boolean).join(" ");
    claims.given_name = first;
    claims.family_name = last;
    claims.gender = i.traits.gender;
  }
  if (scopes.includes("email")) {
    claims.email = i.traits.email;
    claims.email_verified = emailVerified(i);
  }
  if (scopes.includes("phone")) {
    claims.phone_number = i.traits.phone;
    claims.phone_number_verified = phoneVerified(i);
  }
  return claims;
}

// An invited staff member's identity, created through the admin API. The phone is marked verified:
// the invite link was sent to it by SMS, so opening it proves control of the number.
export async function createInvitedIdentity(
  traits: { phone: string; email: string; name: { first: string; last: string } },
  password: string,
): Promise<{ ok: true; id: string } | { ok: false; status: number }> {
  const res = await fetch(`${ADMIN}/admin/identities`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schema_id: "default",
      state: "active",
      traits,
      credentials: { password: { config: { password } } },
      verifiable_addresses: [{ value: traits.phone, via: "sms", verified: true, status: "completed" }],
    }),
  });
  if (!res.ok) {
    console.error("[invite] identity not created:", res.status, (await res.text()).slice(0, 300));
    return { ok: false, status: res.status };
  }
  return { ok: true, id: (await res.json()).id };
}
