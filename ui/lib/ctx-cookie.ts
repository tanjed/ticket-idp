import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Config } from "./config";
import { inject, singleton } from "./di";

// Encryption of the context cookie, kept apart from ContextStore so the proxy can check it
// without Next's request-scoped cookie helpers.
export const COOKIE = "idp_ctx";

@singleton()
export class CookieCipher {
  constructor(@inject(Config) private readonly config: Config) {}

  private key(): Buffer {
    return createHash("sha256").update(this.config.cookieSecret).digest();
  }

  seal(value: object): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key(), iv);
    const enc = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
  }

  // The decrypted value if the cookie is genuine and not expired, otherwise null.
  open<T extends { exp: number }>(cookie: string): T | null {
    try {
      const raw = Buffer.from(cookie, "base64url");
      const d = createDecipheriv("aes-256-gcm", this.key(), raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      const v: T = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
      return v.exp > Date.now() ? v : null;
    } catch {
      return null;
    }
  }
}
