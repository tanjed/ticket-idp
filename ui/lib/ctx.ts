import { cookies } from "next/headers";
import { COOKIE, open, seal } from "./ctx-cookie";
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

export async function getCtx(): Promise<Ctx | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v ? open<Ctx>(v) : null;
}

export async function setCtx(ctx: Omit<Ctx, "exp"> & { exp?: number }) {
  (await cookies()).set(COOKIE, seal({ ...ctx, exp: ctx.exp ?? Date.now() + TTL_MS }), {
    httpOnly: true,
    sameSite: "lax", // also the CSRF defence: cross-site POSTs arrive without it
    secure: (process.env.PUBLIC_UI_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearCtx() {
  (await cookies()).delete(COOKIE);
}

export const activeFlash = (ctx: Ctx | null): Flash | undefined =>
  ctx?.flash && Date.now() - ctx.flash.at < FLASH_MS ? ctx.flash : undefined;
