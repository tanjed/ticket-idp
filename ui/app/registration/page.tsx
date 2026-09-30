import Blocked from "@/components/blocked";
import RegistrationForm from "@/components/registration-form";
import { ContextStore } from "@/lib/ctx";
import { container } from "@/lib/di";

export const dynamic = "force-dynamic";

export default async function Registration() {
  const store = container.resolve(ContextStore);
  const ctx = await store.get();
  if (!ctx) return <Blocked />;

  return (
    <main className="page">
      <h1>Create an account</h1>
      <p className="lead">
        Create your account once and enjoy a seamless journey across all Shohoz
        services. One account for all your travel needs.
      </p>
      <RegistrationForm flash={store.flash(ctx)} />
    </main>
  );
}
