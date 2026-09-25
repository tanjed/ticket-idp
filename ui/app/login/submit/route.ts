import { back, finishLogin, guard, str, to } from "@/lib/handlers";
import { setCtx } from "@/lib/ctx";
import type { ContinueWith } from "@/lib/flow";
import { identityIdByPhone, newFlow, revokeSession, submitFlow } from "@/lib/kratos-api";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;

  const form = await req.formData();
  const identifier = str(form.get("identifier"));
  const password = String(form.get("password") ?? "");

  const flow = await newFlow("login");
  if (!flow.ok) return new Response("Login is unavailable", { status: 502 });
  const res = await submitFlow("login", flow.body.id, { method: "password", identifier, password });

  if (res.ok && res.body?.session_token) {
    const sub = res.body.session.identity.id;
    await revokeSession(res.body.session_token);
    return finishLogin(ctx, sub);
  }

  // Right password, unverified phone: Kratos opened the OTP flow (API mode: a 403,
  // with the flow under error.details).
  const actions: ContinueWith[] = res.body?.continue_with ?? res.body?.error?.details?.continue_with ?? [];
  const cw = actions.find((a) => a.action === "show_verification_ui");
  if (cw && "flow" in cw) {
    const sub = await identityIdByPhone(identifier);
    if (sub) {
      await setCtx({ ch: ctx.ch, sub, phone: identifier, vfl: cw.flow.id });
      return to("/verification");
    }
  }

  return back("/login", ctx, res.body, { identifier });
}
