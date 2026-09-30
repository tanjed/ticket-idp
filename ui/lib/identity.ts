import { Config } from "./config";
import { inject, singleton } from "./di";

export type Identity = {
  id: string;
  traits: { email?: string; phone?: string; gender?: string; name?: { first?: string; last?: string } };
  metadata_public?: Record<string, unknown> & { email_verified_at?: string } | null;
  verifiable_addresses?: { via: string; value: string; verified: boolean }[];
};

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

// Kratos admin API: identities (and, for the local OTP shim, the courier queue).
@singleton()
export class KratosAdmin {
  constructor(@inject(Config) private readonly config: Config) {}

  private url(path: string) {
    return `${this.config.kratosAdminUrl}/admin${path}`;
  }

  async getIdentity(id: string): Promise<Identity | null> {
    const res = await fetch(this.url(`/identities/${encodeURIComponent(id)}`), { cache: "no-store" });
    return res.ok ? res.json() : null;
  }

  // Lookup by the login identifier (phone).
  async identityIdByPhone(phone: string): Promise<string | null> {
    const res = await fetch(this.url(`/identities?credentials_identifier=${encodeURIComponent(phone)}`), { cache: "no-store" });
    const body = res.ok ? await res.json() : null;
    return Array.isArray(body) && body[0]?.id ? body[0].id : null;
  }

  // Replaces metadata_public (JSON patch "add" on the whole object).
  async setMetadataPublic(id: string, value: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(this.url(`/identities/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ op: "add", path: "/metadata_public", value }]),
    });
    return res.ok;
  }

  // An invited staff member's identity. The phone is marked verified: the invite link was sent to
  // it by SMS, so opening it proves control of the number.
  async createInvitedIdentity(
    traits: { phone: string; email: string; name: { first: string; last: string } },
    password: string,
  ): Promise<{ ok: true; id: string } | { ok: false; status: number }> {
    const res = await fetch(this.url("/identities"), {
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

  // Ends one Kratos session.
  async deleteSession(id: string) {
    await fetch(this.url(`/sessions/${encodeURIComponent(id)}`), { method: "DELETE", cache: "no-store" });
  }

  async courierMessages(): Promise<{ id: string; template_type: string }[]> {
    const res = await fetch(this.url("/courier/messages?page_size=20"), { cache: "no-store" });
    return res.json();
  }

  async courierMessage(id: string): Promise<{ body?: string }> {
    const res = await fetch(this.url(`/courier/messages/${encodeURIComponent(id)}`), { cache: "no-store" });
    return res.json();
  }
}
