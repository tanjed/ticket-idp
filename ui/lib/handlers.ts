import { getClaims } from "./authz";
import { acceptLogin, getLoginRequest, userType } from "./hydra";
import { activeFlash, clearCtx, getCtx, setCtx, type Ctx } from "./ctx";
import { fieldMessages, type Flow } from "./flow";
import { getIdentity, phoneVerified } from "./identity";

const UI = process.env.PUBLIC_UI_URL ?? "http://localhost:3001";

export const to = (path: string) => Response.redirect(`${UI}${path}`, 303);

// CSRF: SameSite=Lax cookie plus an Origin check.
export function originOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(UI).origin;
}

export const noContext = () =>
  new Response("This page can only be reached by signing in through an app. Please go back to your app and try again.", {
    status: 403,
  });

export async function guard(req: Request): Promise<{ ctx: Ctx } | { res: Response }> {
  if (!originOk(req)) return { res: new Response("Bad origin", { status: 403 }) };
  const ctx = await getCtx();
  return ctx ? { ctx } : { res: noContext() };
}

export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// Re-render a page with Kratos' messages and the non-secret values typed.
export async function back(path: string, ctx: Ctx, flow: Flow | undefined, values: Record<string, string> = {}, extra?: Partial<Ctx>) {
  const fields = fieldMessages(flow);
  if (Object.keys(fields).length === 0) {
    // Kratos answered with an error object rather than a flow (a 500, a rate limit, ...): never reload silently.
    console.error("[kratos] nothing to show for this answer:", JSON.stringify(flow ?? null).slice(0, 500));
    const limited = (flow as { error?: { code?: number } } | undefined)?.error?.code === 429;
    fields._form = [{
      id: 0,
      type: "error",
      text: limited ? "Too many attempts. Please wait a moment and try again." : "Something went wrong. Please try again.",
    }];
  }
  await setCtx({ ...ctx, ...extra, flash: { at: Date.now(), fields, values } });
  return to(path);
}

export async function backWithText(path: string, ctx: Ctx, text: string, type = "error", extra?: Partial<Ctx>) {
  await setCtx({
    ...ctx,
    ...extra,
    flash: { at: Date.now(), fields: { _form: [{ id: 0, text, type }] }, values: {} },
  });
  return to(path);
}

const expired = () =>
  new Response("This sign-in request has expired. Please go back to your app and try again.", { status: 400 });

// Authenticated and phone-verified: accept the Hydra login and follow redirect_to. Through a
// provider app the user must also belong to a company (Authz); consent puts it in the token.
export async function finishLogin(ctx: Ctx, sub: string): Promise<Response> {
  const identity = await getIdentity(sub);
  if (!identity || !phoneVerified(identity)) {
    return backWithText("/login", { ch: ctx.ch, exp: ctx.exp }, "Your mobile number is not verified.");
  }
  // The client decides the user type; read it from Hydra rather than trusting anything we stored.
  const login = await getLoginRequest(ctx.ch).catch(() => null);
  if (!login) {
    await clearCtx();
    return expired();
  }
  if (userType(login.client) === "provider") {
    const claims = await getClaims(sub);
    if (!claims.ok) {
      const fresh = { ch: ctx.ch, exp: ctx.exp };
      if (claims.status === 404) {
        await setCtx({ ...fresh, sub, co: true });
        return to("/company");
      }
      return backWithText("/login", fresh, claims.status === 403
        ? "Your company's access is suspended. Please contact your company administrator."
        : "Sign-in is unavailable right now. Please try again.");
    }
  }
  try {
    const { redirect_to } = await acceptLogin(ctx.ch, { subject: sub, remember: true, remember_for: 3600 });
    await clearCtx();
    return Response.redirect(redirect_to, 303);
  } catch {
    await clearCtx();
    return expired();
  }
}

export { activeFlash };
