import { cookies } from "next/headers";
import { Config } from "./config";
import { COOKIE, CookieCipher } from "./ctx-cookie";
import { inject, singleton } from "./di";
import type { FieldMessages } from "./flow";

// The UI's only per-user state: an encrypted httpOnly cookie tying a browser to one Hydra
// login_challenge and its Kratos flow. Without it every auth page and action refuses.
export type Flash = { at: number; fields: FieldMessages; values: Record<string, string> };

export type Ctx = {
  ch: string;        // Hydra login_challenge
  exp: number;       // epoch ms
  sub?: string;      // identity id, set once the password was accepted / account created
  phone?: string;
  vfl?: string;      // Kratos verification flow (phone OTP)
  email?: string;    // recovery
  rfl?: string;      // Kratos recovery flow
  rcsrf?: string;    // recovery flow CSRF token
  sfl?: string;      // Kratos settings flow (new password after recovery)
  kj?: Record<string, string>; // Kratos cookie jar, ONLY during recovery -> settings
  co?: true;         // signed in (password + phone done) through a provider app, but in no company yet
  flash?: Flash;
};

const TTL_MS = 30 * 60 * 1000;
const FLASH_MS = 60 * 1000;

@singleton()
export class ContextStore {
  constructor(
    @inject(CookieCipher) private readonly cipher: CookieCipher,
    @inject(Config) private readonly config: Config,
  ) {}

  async get(): Promise<Ctx | null> {
    const v = (await cookies()).get(COOKIE)?.value;
    return v ? this.cipher.open<Ctx>(v) : null;
  }

  async set(ctx: Omit<Ctx, "exp"> & { exp?: number }) {
    (await cookies()).set(COOKIE, this.cipher.seal({ ...ctx, exp: ctx.exp ?? Date.now() + TTL_MS }), {
      httpOnly: true,
      sameSite: "lax", // also the CSRF defence: cross-site POSTs arrive without it
      secure: this.config.secureCookies,
      path: "/",
      maxAge: TTL_MS / 1000,
    });
  }

  async clear() {
    (await cookies()).delete(COOKIE);
  }

  // The flash message, if it is recent enough to show.
  flash(ctx: Ctx | null): Flash | undefined {
    return ctx?.flash && Date.now() - ctx.flash.at < FLASH_MS ? ctx.flash : undefined;
  }
}
