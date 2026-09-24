import FlowForm from "@/components/flow-form";
import { getFlow, startFlow } from "@/lib/kratos";

export const dynamic = "force-dynamic";

// Recovery drops the user here with a privileged session to set a new password.
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: id } = await searchParams;
  if (!id) startFlow("settings");
  const flow = await getFlow("settings", id);

  return (
    <main className="page">
      <h1>Set a new password</h1>
      <p className="lead">Choose a new password for your account.</p>
      <FlowForm flow={flow} groups={["default", "password"]} />
      <p className="switch"><a href="/">Done</a></p>
    </main>
  );
}
