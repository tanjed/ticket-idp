// Hydra admin API client (login / consent / logout challenges, clients).
const ADMIN = process.env.HYDRA_ADMIN_URL ?? "http://localhost:4445";

async function admin<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADMIN}/admin${path}`, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`Hydra admin ${init?.method ?? "GET"} ${path.split("?")[0]} -> ${res.status}`);
  return res.json();
}

const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
const put = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

type Client = { client_id: string; metadata?: { user_type?: string } | null };
export type LoginRequest = { skip: boolean; subject: string; request_url: string; client: Client };
export type ConsentRequest = {
  subject: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  client: Client;
};

// Which kind of user a client signs in (client metadata.user_type). Anything but "provider" is a
// consumer: the least-privileged type, with no company or roles in its token.
export type UserType = "provider" | "consumer";
export const userType = (c: Client): UserType => (c.metadata?.user_type === "provider" ? "provider" : "consumer");
type Redirect = { redirect_to: string };

export const getLoginRequest = (c: string) => admin<LoginRequest>(`/oauth2/auth/requests/login?${q("login_challenge", c)}`);
export const acceptLogin = (c: string, body: object) =>
  admin<Redirect>(`/oauth2/auth/requests/login/accept?${q("login_challenge", c)}`, put(body));

export const getConsentRequest = (c: string) => admin<ConsentRequest>(`/oauth2/auth/requests/consent?${q("consent_challenge", c)}`);
export const acceptConsent = (c: string, body: object) =>
  admin<Redirect>(`/oauth2/auth/requests/consent/accept?${q("consent_challenge", c)}`, put(body));

export const rejectConsent = (c: string, body: { error: string; error_description: string; status_code?: number }) =>
  admin<Redirect>(`/oauth2/auth/requests/consent/reject?${q("consent_challenge", c)}`, put(body));

export const acceptLogout = (c: string) =>
  admin<Redirect>(`/oauth2/auth/requests/logout/accept?${q("logout_challenge", c)}`, put({}));

export const getClient = (id: string) =>
  admin<{ client_id: string; redirect_uris?: string[] }>(`/clients/${encodeURIComponent(id)}`);
