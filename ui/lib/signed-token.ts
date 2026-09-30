import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult<T> = { ok: true; payload: T } | { ok: false; reason: "invalid" | "expired" };

// A signed, expiring token: base64url(payload).base64url(hmac-sha256). Subclasses name the
// secret and check the payload's shape.
export abstract class SignedToken<T extends { exp: number }> {
  protected abstract secret(): string;
  protected abstract valid(payload: unknown): payload is T;

  private mac(body: string) {
    return createHmac("sha256", this.secret()).update(body).digest("base64url");
  }

  protected encode(payload: T): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${this.mac(body)}`;
  }

  verify(token: string): VerifyResult<T> {
    const [body, sig, ...rest] = token.split(".");
    if (!body || !sig || rest.length) return { ok: false, reason: "invalid" };

    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString());
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (!this.valid(payload)) return { ok: false, reason: "invalid" };
    if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
    return { ok: true, payload };
  }
}
