import Blocked from "@/components/blocked";
import StatusPage from "@/components/status-page";
import { Errors, Field } from "@/components/fields";
import { activeFlash, getCtx } from "@/lib/ctx";
import { getFlow } from "@/lib/kratos-api";

export const dynamic = "force-dynamic";

const mask = (phone: string) => `${phone.slice(0, 5)}••••${phone.slice(-3)}`;

// Phone OTP screen: after registration, or a correct password with an unverified phone.
export default async function Verification() {
  const ctx = await getCtx();
  if (!ctx?.vfl || !ctx.phone) return <Blocked />;

  const flow = await getFlow("verification", ctx.vfl);
  if (!flow.ok) {
    return (
      <StatusPage tone="clock" title="OTP expired" action={{ href: "/login", label: "Log in again" }}>
        Your verification session has expired.
      </StatusPage>
    );
  }
  const f = activeFlash(ctx);

  return (
    <main className="page">
      <h1>Verify your mobile number</h1>
      <p className="lead">Enter the OTP we sent to {mask(ctx.phone)}.</p>

      <form action="/verification/submit" method="POST">
        <input type="hidden" name="intent" value="verify" />
        <Errors messages={f?.fields._form ?? []} />
        <Field name="code" label="OTP" placeholder="Enter OTP" errors={f?.fields.code} autoComplete="one-time-code" />
        <button className="submit" type="submit">Verify</button>
      </form>

      <form action="/verification/submit" method="POST">
        <input type="hidden" name="intent" value="resend" />
        <button className="submit secondary" type="submit" formNoValidate>Send a new OTP</button>
      </form>
    </main>
  );
}
