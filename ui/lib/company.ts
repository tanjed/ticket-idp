import type { Result } from "./authz";
import { Config } from "./config";
import { inject, singleton } from "./di";

export type Invitation = {
  id: string;
  company_id: string;
  company_name: string;
  phone: string;
  role_ids?: string[];
  invited_by: string;
  accepted_user_id?: string;
  expire_time: string;
  accept_time?: string;
  create_time: string;
  status:
    | "INVITATION_STATUS_PENDING"
    | "INVITATION_STATUS_ACCEPTED"
    | "INVITATION_STATUS_EXPIRED"
    | "INVITATION_STATUS_REVOKED";
};

const id = encodeURIComponent;

// Company's internal REST API (Vanguard over its proto InternalService; cluster-internal, never
// through the gateway): company onboarding and staff invitations. Errors are {error: <reason>,
// message}; reasons: already_member, already_accepted, expired, revoked, not_found, invalid_name,
// unavailable. status 0: Company unreachable.
@singleton()
export class CompanyClient {
  constructor(@inject(Config) private readonly config: Config) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
    try {
      const res = await fetch(`${this.config.companyInternalUrl}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
        ...init,
        headers: init.body ? { "content-type": "application/json" } : {},
      });
      const body = await res.json().catch(() => null);
      return res.ok ? { ok: true, body } : { ok: false, status: res.status, reason: body?.error, message: body?.message };
    } catch (e) {
      console.error("[company]", path.split("/").slice(0, 4).join("/"), (e as Error).message);
      return { ok: false, status: 0 };
    }
  }

  // Idempotent per user: returns the company they already belong to, if any (created: false). A
  // company left half set up by an earlier failure is finished by calling again; "unavailable"
  // (503) means Authz could not be reached, so a retry is worthwhile.
  createCompany(name: string, adminUserId: string) {
    return this.call<{ company_id: string; created: boolean }>("/internal/v1/companies", {
      method: "POST",
      body: JSON.stringify({ name, admin_user_id: adminUserId }),
    });
  }

  // 404 "not_found".
  async getInvitation(invitationId: string): Promise<Result<Invitation>> {
    const r = await this.call<{ invitation: Invitation }>(`/internal/v1/invitations/${id(invitationId)}`);
    return r.ok ? { ok: true, body: r.body.invitation } : r;
  }

  // 409 "already_accepted" / "already_member" (the account belongs to a company); 400 "expired" /
  // "revoked"; 404 "not_found"; 503 "unavailable".
  acceptInvitation(invitationId: string, userId: string) {
    return this.call<{ company_id: string }>(`/internal/v1/invitations/${id(invitationId)}/accept`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  }
}
