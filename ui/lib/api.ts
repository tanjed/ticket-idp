import { createRemoteJWKSet, jwtVerify } from "jose";
import { Config } from "./config";
import { inject, singleton } from "./di";

// Responses for the bearer-token API, with CORS for browser clients on other origins.
@singleton()
export class ApiResponder {
  constructor(@inject(Config) private readonly config: Config) {}

  corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin");
    if (!origin || !this.config.corsAllowedOrigins.includes(origin)) return {};
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "600",
      vary: "origin",
    };
  }

  preflight(req: Request) {
    return new Response(null, { status: 204, headers: this.corsHeaders(req) });
  }

  json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
    return Response.json(body, { status, headers: { ...this.corsHeaders(req), ...extra } });
  }
}

export type Caller = { sub: string; clientId: string; scope: string };

// Bearer JWTs are verified locally (JWKS, iss, exp, aud). A revoked token stays valid until it expires (10m).
@singleton()
export class BearerAuth {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@inject(Config) private readonly config: Config) {
    this.jwks = createRemoteJWKSet(new URL(config.hydraJwksUrl));
  }

  async authenticate(req: Request): Promise<Caller | null> {
    const token = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.jwtIssuer,
        audience: this.config.apiAudience,
        algorithms: ["RS256"],
      });
      if (!payload.sub || typeof payload.client_id !== "string") return null;
      const scp = payload.scp;
      return { sub: payload.sub, clientId: payload.client_id, scope: Array.isArray(scp) ? scp.join(" ") : String(scp ?? "") };
    } catch {
      return null;
    }
  }
}

// Per-key rate limit. In memory: use a shared store for several replicas.
@singleton()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
    recent.push(now);
    this.hits.set(key, recent);
    return { ok: true, retryAfter: 0 };
  }
}
