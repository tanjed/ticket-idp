// Authz's internal REST API (grpc-gateway over its proto InternalService; cluster-internal, never
// through the gateway): a provider's company and roles for the token, company onboarding, and staff
// invitations. Errors are {error: <reason>, message}.
const AUTHZ = process.env.AUTHZ_INTERNAL_URL ?? "http://localhost:8091";

export type Claims = { company_id: string; roles: { id: string; name: string; version: number }[] };
export type Invitation = {
  id: string;
  company_name: string;
  phone: string;
  expire_time: string;
  status: "INVITATION_STATUS_PENDING" | "INVITATION_STATUS_ACCEPTED" | "INVITATION_STATUS_EXPIRED";
};

// status 0: Authz unreachable. reason: Authz's error code (e.g. "already_member").
type Result<T> = { ok: true; body: T } | { ok: false; status: number; reason?: string; message?: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  try {
    const res = await fetch(`${AUTHZ}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      ...init,
      headers: init.body ? { "content-type": "application/json" } : {},
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { ok: true, body } : { ok: false, status: res.status, reason: body?.error, message: body?.message };
  } catch (e) {
    console.error("[authz]", path.split("/").slice(0, 4).join("/"), (e as Error).message);
    return { ok: false, status: 0 };
  }
}

const id = encodeURIComponent;

// 404: belongs to no company. 403: the company is suspended.
export const getClaims = (sub: string) => call<Claims>(`/internal/v1/subjects/${id(sub)}/claims`);

// Idempotent per subject: returns the company they already belong to, if any (created: false).
export const createCompany = (name: string, adminSub: string) =>
  call<{ company_id: string; created: boolean }>("/internal/v1/companies", { method: "POST", body: JSON.stringify({ name, admin_sub: adminSub }) });

export async function getInvitation(invitationId: string): Promise<Result<Invitation>> {
  const r = await call<{ invitation: Invitation }>(`/internal/v1/invitations/${id(invitationId)}`);
  return r.ok ? { ok: true, body: r.body.invitation } : r;
}

// 409: already used ("already_accepted") or the account belongs to a company ("already_member").
// 400 "expired".
export const acceptInvitation = (invitationId: string, sub: string) =>
  call<object>(`/internal/v1/invitations/${id(invitationId)}/accept`, { method: "POST", body: JSON.stringify({ sub }) });
