import { Config } from "./config";
import { inject, singleton } from "./di";
import type { Flow } from "./flow";

export type FlowType = "login" | "registration" | "verification" | "recovery" | "settings";
export type Result<T = any> = { status: number; ok: boolean; body: T };

export async function call(url: string, init: RequestInit = {}): Promise<Result> {
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

// Server-to-server Kratos public API (API-mode flows); Kratos is private.
@singleton()
export class KratosPublic {
  constructor(@inject(Config) private readonly config: Config) {}

  newFlow(type: FlowType, sessionToken?: string) {
    return call(`${this.config.kratosPublicUrl}/self-service/${type}/api`, sessionToken ? { headers: { "x-session-token": sessionToken } } : {});
  }

  getFlow(type: FlowType, id: string): Promise<Result<Flow>> {
    return call(`${this.config.kratosPublicUrl}/self-service/${type}/flows?id=${encodeURIComponent(id)}`);
  }

  submitFlow(type: FlowType, id: string, body: unknown, sessionToken?: string) {
    return call(`${this.config.kratosPublicUrl}/self-service/${type}?flow=${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: sessionToken ? { "x-session-token": sessionToken } : {},
    });
  }

  // Sessions are throwaway: revoked once Hydra accepts the login.
  revokeSession(sessionToken: string) {
    return call(`${this.config.kratosPublicUrl}/self-service/logout/api`, { method: "DELETE", body: JSON.stringify({ session_token: sessionToken }) });
  }
}
