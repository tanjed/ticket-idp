import RegistrationForm from "@/components/registration-form";
import { getFlow, startFlow } from "@/lib/kratos";

export const dynamic = "force-dynamic";

export default async function Registration({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: id } = await searchParams;
  if (!id) startFlow("registration");
  const flow = await getFlow("registration", id);

  return (
    <main className="page">
      <h1>Create an account</h1>
      <p className="lead">
        Create your account once and enjoy a seamless journey across all Shohoz
        services. One account for all your travel needs.
      </p>
      <RegistrationForm flow={flow} />
    </main>
  );
}
