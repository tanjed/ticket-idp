import Blocked from "@/components/blocked";
import { Errors, Field } from "@/components/fields";
import { activeFlash, getCtx } from "@/lib/ctx";

export const dynamic = "force-dynamic";

export default async function Recovery() {
  const ctx = await getCtx();
  if (!ctx) return <Blocked />;
  const f = activeFlash(ctx);
  const sent = !!ctx.rfl;

  return (
    <main className="page">
      <h1>Forgot password</h1>
      <p className="lead">
        {sent
          ? "We sent a code to your email. Enter it below to choose a new password."
          : "Enter the email on your account and we will send you a code to reset your password."}
      </p>

      {sent ? (
        <>
          <form action="/recovery/submit" method="POST">
            <input type="hidden" name="intent" value="verify" />
            <Errors messages={f?.fields._form ?? []} />
            <Field name="code" label="Code" placeholder="Enter code" errors={f?.fields.code} autoComplete="one-time-code" />
            <button className="submit" type="submit">Continue</button>
          </form>
          <form action="/recovery/submit" method="POST">
            <input type="hidden" name="intent" value="resend" />
            <button className="submit secondary" type="submit" formNoValidate>Resend code</button>
          </form>
        </>
      ) : (
        <form action="/recovery/submit" method="POST">
          <input type="hidden" name="intent" value="send" />
          <Errors messages={f?.fields._form ?? []} />
          <Field name="email" label="Email" type="email" placeholder="Enter your email"
            defaultValue={f?.values.email} errors={f?.fields.email} autoComplete="email" />
          <button className="submit" type="submit">Send code</button>
        </form>
      )}
      <p className="switch"><a href="/login">Back to Log In</a></p>
    </main>
  );
}
