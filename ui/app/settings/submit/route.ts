import { back, backWithText, guard } from "@/lib/handlers";
import { csrfOf, endSession, readFlow, submit } from "@/lib/kratos-browser";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.kj || !ctx.sfl) return new Response("No password reset in progress", { status: 400 });

  const password = String((await req.formData()).get("password") ?? "");
  const flow = await readFlow("settings", ctx.sfl, ctx.kj);
  if (!flow.ok) return backWithText("/recovery", { ch: ctx.ch, exp: ctx.exp }, "Your reset session expired. Request a new code.");

  const res = await submit("settings", ctx.sfl, { method: "password", password, csrf_token: csrfOf(flow.body) }, flow.jar);
  if (!res.ok) return back("/settings", ctx, res.body);

  // Done: end the recovery session; log in with the new password.
  await endSession(res.jar);
  return backWithText("/login", { ch: ctx.ch, exp: ctx.exp }, "Password updated. Log in with your new password.", "success");
}
