import FlowForm from "@/components/flow-form";
import { getFlow, startFlow } from "@/lib/kratos";

export const dynamic = "force-dynamic";

export default async function Recovery({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: id } = await searchParams;
  if (!id) startFlow("recovery");
  const flow = await getFlow("recovery", id);
  const sent = flow.state === "sent_email";

  return (
    <main className="page">
      <h1>Forgot password</h1>
      <p className="lead">
        {sent
          ? "We sent a code to your email. Enter it below to choose a new password."
          : "Enter the email on your account and we will send you a code to reset your password."}
      </p>
      <FlowForm flow={flow} />
      <p className="switch"><a href="/login">Back to Log In</a></p>
    </main>
  );
}
