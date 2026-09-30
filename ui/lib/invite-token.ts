import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring staff-invitation token: base64url(payload).base64url(hmac). It is sent by SMS
// to `phone`, so holding it proves control of that number. iid: the invitation in Authz.
export type InviteTokenPayload = { iid: string; phone: string; exp: number };

function secret(): string {
  const s = process.env.INVITE_TOKEN_SECRET;
  if (!s) throw new Error("INVITE_TOKEN_SECRET is not set");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function signInviteToken(iid: string, phone: string, expiresAt: Date): string {
  const payload: InviteTokenPayload = { iid, phone, exp: Math.floor(expiresAt.getTime() / 1000) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type InviteVerifyResult = { ok: true; payload: InviteTokenPayload } | { ok: false; reason: "invalid" | "expired" };

export function verifyInviteToken(token: string): InviteVerifyResult {
  const [body, sig, ...rest] = token.split(".");
  if (!body || !sig || rest.length) return { ok: false, reason: "invalid" };

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };

  let payload: InviteTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof payload.iid !== "string" || typeof payload.phone !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid" };
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
