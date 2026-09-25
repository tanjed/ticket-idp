import { back, guard, str, to } from "@/lib/handlers";
import { setCtx } from "@/lib/ctx";
import { resolveOtp } from "@/lib/dev-otp";
import { csrfOf, startFlow, submit } from "@/lib/kratos-browser";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;

  const form = await req.formData();
  const intent = str(form.get("intent"));

  // Same answer whether or not the address exists.
  if (intent === "send" || intent === "resend") {
    const email = intent === "send" ? str(form.get("email")) : ctx.email;
    if (!email) return to("/recovery");
    const flow = await startFlow("recovery");
    if (!flow.ok) return new Response("Recovery is unavailable", { status: 502 });
    const csrf = csrfOf(flow.body);
    const res = await submit("recovery", flow.body.id, { method: "code", email, csrf_token: csrf }, flow.jar);
    if (!res.ok) return back("/recovery", ctx, res.body, { email });
    await setCtx({ ch: ctx.ch, email, rfl: flow.body.id, rcsrf: csrf, kj: res.jar });
    return to("/recovery");
  }

  // Success is a redirect answer plus a privileged session cookie.
  if (!ctx.rfl || !ctx.kj) return to("/recovery");
  const code = await resolveOtp(str(form.get("code")));
  const res = await submit("recovery", ctx.rfl, { method: "code", code, csrf_token: ctx.rcsrf }, ctx.kj);
  const target: string | undefined = res.body?.redirect_browser_to;
  const settingsFlow = target && new URL(target).searchParams.get("flow");
  if (settingsFlow) {
    await setCtx({ ch: ctx.ch, email: ctx.email, kj: res.jar, sfl: settingsFlow });
    return to("/settings");
  }
  return back("/recovery", ctx, res.body);
}
