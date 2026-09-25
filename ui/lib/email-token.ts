import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring token: base64url(payload).base64url(hmac), bound to identity and email.
// cid: the client that asked, so the verify page can return to its redirect URI.
export type EmailTokenPayload = { sub: string; email: string; exp: number; cid?: string };

const TTL_SECONDS = 24 * 60 * 60;

function secret(): string {
  const s = process.env.EMAIL_TOKEN_SECRET;
  if (!s) throw new Error("EMAIL_TOKEN_SECRET is not set");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function signEmailToken(sub: string, email: string, opts: { cid?: string } = {}): string {
  const payload: EmailTokenPayload = { sub, email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS, ...opts };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: EmailTokenPayload }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyEmailToken(token: string): VerifyResult {
  const [body, sig, ...rest] = token.split(".");
  if (!body || !sig || rest.length) return { ok: false, reason: "invalid" };

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: EmailTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
