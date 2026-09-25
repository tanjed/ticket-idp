import { back, finishLogin, guard, str, to } from "@/lib/handlers";
import { setCtx } from "@/lib/ctx";
import { resolveOtp } from "@/lib/dev-otp";
import { submitFlow } from "@/lib/kratos-api";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.vfl || !ctx.sub || !ctx.phone) return new Response("No verification in progress", { status: 400 });

  const form = await req.formData();

  // Kratos only sends an SMS from its hooks, so "resend" = log in again.
  if (str(form.get("intent")) === "resend") {
    const flash = { at: Date.now(), fields: { _form: [{ id: 0, type: "info", text: "Enter your password and we will send you a new OTP." }] }, values: { identifier: ctx.phone } };
    await setCtx({ ch: ctx.ch, exp: ctx.exp, flash });
    return to("/login");
  }

  const code = await resolveOtp(str(form.get("code")));
  const res = await submitFlow("verification", ctx.vfl, { method: "code", code });
  if (res.ok && res.body?.state === "passed_challenge") return finishLogin(ctx, ctx.sub);
  return back("/verification", ctx, res.body);
}
