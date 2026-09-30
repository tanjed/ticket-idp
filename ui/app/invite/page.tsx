import StatusPage from "@/components/status-page";
import { Errors, Field, PasswordField } from "@/components/fields";
import { getInvitation } from "@/lib/authz";
import { verifyInviteToken } from "@/lib/invite-token";
import { identityIdByPhone } from "@/lib/kratos-api";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  fields: "Please fill in every field. The password needs at least 8 characters.",
  create: "Your account could not be created. Check your email and password and try again.",
  taken: "An account with these details already exists. Please try again.",
  member: "Your account already belongs to a company, so it cannot join another.",
  accept: "Something went wrong. Please try again.",
};

// From the SMS link, any device: no sign-in context needed (like /verify-email). A new person
// creates their account here; someone who already has one just joins.
export default async function Invite({ searchParams }: { searchParams: Promise<{ token?: string; e?: string }> }) {
  const { token, e } = await searchParams;
  const result = token ? verifyInviteToken(token) : ({ ok: false, reason: "invalid" } as const);
  const invalid = (
    <StatusPage tone="alert" title="Invitation not valid">
      {!result.ok && result.reason === "expired"
        ? "This invitation has expired. Ask your company administrator for a new one."
        : "This invitation link is invalid."}
    </StatusPage>
  );
  if (!result.ok || !token) return invalid;

  const inv = await getInvitation(result.payload.iid);
  if (!inv.ok) {
    if (inv.status === 404) return invalid;
    return <StatusPage tone="alert" title="Something went wrong">Please try again in a moment.</StatusPage>;
  }
  const { company_name: company, phone, status } = inv.body;
  if (phone !== result.payload.phone) return invalid;
  if (status === "INVITATION_STATUS_ACCEPTED") {
    return (
      <StatusPage tone="check" title="You're in">
        You have joined {company}. Sign in through your company&apos;s app with your mobile number.
      </StatusPage>
    );
  }
  if (status !== "INVITATION_STATUS_PENDING") {
    return <StatusPage tone="clock" title="Invitation expired">Ask your company administrator for a new one.</StatusPage>;
  }

  const existing = await identityIdByPhone(phone);
  const errors = e && ERRORS[e] ? [{ id: 0, text: ERRORS[e], type: "error" }] : [];

  return (
    <main className="page">
      <h1>Join {company}</h1>
      <p className="lead">
        {existing
          ? "You already have an account with this mobile number. Join to use it for your company's apps."
          : "Create your account to join. You will sign in with this mobile number."}
      </p>
      <form action="/invite/submit" method="POST">
        <input type="hidden" name="token" value={token} />
        <Errors messages={errors} />
        {!existing && (
          <>
            <Field name="first" label="First name" placeholder="Enter your first name" autoComplete="given-name" />
            <Field name="last" label="Last name" placeholder="Enter your last name" autoComplete="family-name" />
            <Field name="email" label="Email" type="email" placeholder="Enter your email" autoComplete="email" />
            <PasswordField name="password" label="Password" autoComplete="new-password" />
          </>
        )}
        <button className="submit" type="submit">Join {company}</button>
      </form>
    </main>
  );
}
