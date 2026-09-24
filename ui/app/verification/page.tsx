import FlowForm from "@/components/flow-form";
import { getFlow, startFlow } from "@/lib/kratos";

export const dynamic = "force-dynamic";

export default async function Verification({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: id } = await searchParams;
  if (!id) startFlow("verification");
  const flow = await getFlow("verification", id);
  const done = flow.state === "passed_challenge";

  return (
    <main className="page">
      <h1>{done ? "Verified" : "Verify your account"}</h1>
      <p className="lead">
        {done
          ? "Thanks, your details are verified."
          : flow.state === "sent_email"
            ? "Enter the code we sent you."
            : "Enter your email and we will send you a verification code."}
      </p>
      {done ? <p className="switch"><a href="/">Continue</a></p> : <FlowForm flow={flow} />}
    </main>
  );
}
