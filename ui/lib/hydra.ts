import { Config } from "./config";
import { inject, singleton } from "./di";

type Client = { client_id: string; metadata?: { user_type?: string } | null };
export type LoginRequest = { skip: boolean; subject: string; request_url: string; client: Client };
export type ConsentRequest = {
  subject: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  client: Client;
};
type Redirect = { redirect_to: string };

// Which kind of user a client signs in (client metadata.user_type). Anything but "provider" is a
// consumer: the least-privileged type, with no company or roles in its token.
export type UserType = "provider" | "consumer";
export const userType = (c: Client): UserType => (c.metadata?.user_type === "provider" ? "provider" : "consumer");

const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
const put = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// Hydra admin API client (login / consent / logout challenges, clients).
@singleton()
export class HydraAdmin {
  constructor(@inject(Config) private readonly config: Config) {}

  private async admin<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.hydraAdminUrl}/admin${path}`, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`Hydra admin ${init?.method ?? "GET"} ${path.split("?")[0]} -> ${res.status}`);
    return res.json();
  }

  getLoginRequest(c: string) {
    return this.admin<LoginRequest>(`/oauth2/auth/requests/login?${q("login_challenge", c)}`);
  }

  acceptLogin(c: string, body: object) {
    return this.admin<Redirect>(`/oauth2/auth/requests/login/accept?${q("login_challenge", c)}`, put(body));
  }

  getConsentRequest(c: string) {
    return this.admin<ConsentRequest>(`/oauth2/auth/requests/consent?${q("consent_challenge", c)}`);
  }

  acceptConsent(c: string, body: object) {
    return this.admin<Redirect>(`/oauth2/auth/requests/consent/accept?${q("consent_challenge", c)}`, put(body));
  }

  rejectConsent(c: string, body: { error: string; error_description: string; status_code?: number }) {
    return this.admin<Redirect>(`/oauth2/auth/requests/consent/reject?${q("consent_challenge", c)}`, put(body));
  }

  acceptLogout(c: string) {
    return this.admin<Redirect>(`/oauth2/auth/requests/logout/accept?${q("logout_challenge", c)}`, put({}));
  }

  getClient(id: string) {
    return this.admin<{ client_id: string; redirect_uris?: string[] }>(`/clients/${encodeURIComponent(id)}`);
  }
}
