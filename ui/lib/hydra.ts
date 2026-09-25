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

export type LoginRequest = { skip: boolean; subject: string; request_url: string; client: { client_id: string } };
export type ConsentRequest = {
  subject: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  client: { client_id: string };
};
type Redirect = { redirect_to: string };

export const getLoginRequest = (c: string) => admin<LoginRequest>(`/oauth2/auth/requests/login?${q("login_challenge", c)}`);
export const acceptLogin = (c: string, body: object) =>
  admin<Redirect>(`/oauth2/auth/requests/login/accept?${q("login_challenge", c)}`, put(body));

export const getConsentRequest = (c: string) => admin<ConsentRequest>(`/oauth2/auth/requests/consent?${q("consent_challenge", c)}`);
export const acceptConsent = (c: string, body: object) =>
  admin<Redirect>(`/oauth2/auth/requests/consent/accept?${q("consent_challenge", c)}`, put(body));

export const acceptLogout = (c: string) =>
  admin<Redirect>(`/oauth2/auth/requests/logout/accept?${q("logout_challenge", c)}`, put({}));

export const getClient = (id: string) =>
  admin<{ client_id: string; redirect_uris?: string[] }>(`/clients/${encodeURIComponent(id)}`);
