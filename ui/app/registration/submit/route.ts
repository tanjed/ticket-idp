import { back, guard, str, to } from "@/lib/handlers";
import { setCtx } from "@/lib/ctx";
import type { ContinueWith } from "@/lib/flow";
import { newFlow, revokeSession, submitFlow } from "@/lib/kratos-api";
import { sendEmailVerification } from "@/lib/email-verification";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const traits = {
    name: { first: str(form.get("traits.name.first")), last: str(form.get("traits.name.last")) },
    phone: str(form.get("traits.phone")),
    email: str(form.get("traits.email")),
    gender: str(form.get("traits.gender")),
  };
  // Re-shown after an error (never the password).
  const values = {
    "traits.name.first": traits.name.first, "traits.name.last": traits.name.last,
    "traits.phone": traits.phone, "traits.email": traits.email, "traits.gender": traits.gender,
  };

  const flow = await newFlow("registration");
  if (!flow.ok) return new Response("Registration is unavailable", { status: 502 });
  const res = await submitFlow("registration", flow.body.id, { method: "password", password, traits });
  if (!res.ok) return back("/registration", ctx, res.body, values);

  // Kratos' hook announces USER_REGISTERED; the email link is ours. Not awaited:
  // a Kafka outage must not slow or fail a signup.
  const identityId: string | undefined = res.body.identity?.id;
  if (identityId) {
    sendEmailVerification(identityId, traits.email, traits.name.first)
      .catch((e) => console.error("[events] USER_EMAIL_VERIFICATION_REQUEST not published:", e.message));
  }

  // Revoke the Kratos session: nobody is signed in until the OTP is done.
  if (res.body.session_token) await revokeSession(res.body.session_token);
  const cw: ContinueWith | undefined = res.body.continue_with?.find((a: ContinueWith) => a.action === "show_verification_ui");
  if (!cw || !("flow" in cw) || !res.body.identity?.id) {
    return new Response("Account created, but the verification step could not be started. Please log in.", { status: 500 });
  }
  await setCtx({ ch: ctx.ch, sub: res.body.identity.id, phone: traits.phone, vfl: cw.flow.id });
  return to("/verification");
}
