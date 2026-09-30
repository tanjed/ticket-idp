import { Config } from "./config";
import { inject, singleton } from "./di";
import { SignedToken } from "./signed-token";

// A staff invitation, sent by SMS to `phone`: holding it proves control of that number.
// iid: the invitation in Authz.
export type InviteTokenPayload = { iid: string; phone: string; exp: number };

@singleton()
export class InviteTokens extends SignedToken<InviteTokenPayload> {
  constructor(@inject(Config) private readonly config: Config) {
    super();
  }

  protected secret() {
    return this.config.inviteTokenSecret;
  }

  protected valid(p: unknown): p is InviteTokenPayload {
    const v = p as InviteTokenPayload;
    return !!v && typeof v.iid === "string" && typeof v.phone === "string" && typeof v.exp === "number";
  }

  sign(iid: string, phone: string, expiresAt: Date): string {
    return this.encode({ iid, phone, exp: Math.floor(expiresAt.getTime() / 1000) });
  }
}
