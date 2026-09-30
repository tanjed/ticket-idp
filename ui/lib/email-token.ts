import { Config } from "./config";
import { inject, singleton } from "./di";
import { SignedToken } from "./signed-token";

// Bound to identity and email. cid: the client that asked, so the verify page can return to its
// redirect URI.
export type EmailTokenPayload = { sub: string; email: string; exp: number; cid?: string };

const TTL_SECONDS = 24 * 60 * 60;

@singleton()
export class EmailTokens extends SignedToken<EmailTokenPayload> {
  constructor(@inject(Config) private readonly config: Config) {
    super();
  }

  protected secret() {
    return this.config.emailTokenSecret;
  }

  protected valid(p: unknown): p is EmailTokenPayload {
    const v = p as EmailTokenPayload;
    return !!v && typeof v.sub === "string" && typeof v.email === "string" && typeof v.exp === "number";
  }

  sign(sub: string, email: string, opts: { cid?: string } = {}): string {
    return this.encode({ sub, email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS, ...opts });
  }
}
