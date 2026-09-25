import type { Flow } from "./flow";

// Server-to-server Kratos client (API-mode flows); Kratos is private.
const PUBLIC = process.env.KRATOS_INTERNAL_URL ?? "http://localhost:4433";
const ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";

export type FlowType = "login" | "registration" | "verification" | "recovery" | "settings";
export type Result<T = any> = { status: number; ok: boolean; body: T };

async function call(url: string, init: RequestInit = {}): Promise<Result> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

export const newFlow = (type: FlowType, sessionToken?: string) =>
  call(`${PUBLIC}/self-service/${type}/api`, sessionToken ? { headers: { "x-session-token": sessionToken } } : {});

export const getFlow = (type: FlowType, id: string): Promise<Result<Flow>> =>
  call(`${PUBLIC}/self-service/${type}/flows?id=${encodeURIComponent(id)}`);

export const submitFlow = (type: FlowType, id: string, body: unknown, sessionToken?: string) =>
  call(`${PUBLIC}/self-service/${type}?flow=${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: sessionToken ? { "x-session-token": sessionToken } : {},
  });

// Sessions are throwaway: revoked once Hydra accepts the login.
export const revokeSession = (sessionToken: string) =>
  call(`${PUBLIC}/self-service/logout/api`, { method: "DELETE", body: JSON.stringify({ session_token: sessionToken }) });

// Admin lookup by the login identifier (phone).
export async function identityIdByPhone(phone: string): Promise<string | null> {
  const r = await call(`${ADMIN}/admin/identities?credentials_identifier=${encodeURIComponent(phone)}`);
  return r.ok && Array.isArray(r.body) && r.body[0]?.id ? r.body[0].id : null;
}
