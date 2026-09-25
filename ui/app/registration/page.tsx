import Blocked from "@/components/blocked";
import RegistrationForm from "@/components/registration-form";
import { activeFlash, getCtx } from "@/lib/ctx";

export const dynamic = "force-dynamic";

export default async function Registration() {
  const ctx = await getCtx();
  if (!ctx) return <Blocked />;

  return (
    <main className="page">
      <h1>Create an account</h1>
      <p className="lead">
        Create your account once and enjoy a seamless journey across all Shohoz
        services. One account for all your travel needs.
      </p>
      <RegistrationForm flash={activeFlash(ctx)} />
    </main>
  );
}
