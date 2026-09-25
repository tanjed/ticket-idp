import { createRemoteJWKSet, jwtVerify } from "jose";

// CORS for browser clients on other origins.
const ALLOWED = (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...corsHeaders(req), ...extra } });
}

// Bearer JWTs are verified locally (JWKS, iss, exp, aud). A revoked token stays valid until it expires (10m).
export type Caller = { sub: string; clientId: string; scope: string };

const JWKS = createRemoteJWKSet(new URL(process.env.HYDRA_JWKS_URL ?? "http://localhost:4444/.well-known/jwks.json"));

export async function authenticate(req: Request): Promise<Caller | null> {
  const token = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.JWT_ISSUER ?? "http://localhost:4444/",
      audience: process.env.API_AUDIENCE ?? "bus-api",
      algorithms: ["RS256"],
    });
    if (!payload.sub || typeof payload.client_id !== "string") return null;
    const scp = payload.scp;
    return { sub: payload.sub, clientId: payload.client_id, scope: Array.isArray(scp) ? scp.join(" ") : String(scp ?? "") };
  } catch {
    return null;
  }
}

// Per-identity rate limit. In memory: use a shared store for several replicas.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}
