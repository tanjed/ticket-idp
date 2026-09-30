import Blocked from "@/components/blocked";
import { Errors, PasswordField } from "@/components/fields";
import { ContextStore } from "@/lib/ctx";
import { container } from "@/lib/di";

export const dynamic = "force-dynamic";

// Only reachable after a successful recovery code.
export default async function Settings() {
  const store = container.resolve(ContextStore);
  const ctx = await store.get();
  if (!ctx?.kj || !ctx.sfl) return <Blocked />;
  const f = store.flash(ctx);

  return (
    <main className="page">
      <h1>Set a new password</h1>
      <p className="lead">Choose a new password for your account.</p>
      <form action="/settings/submit" method="POST">
        <Errors messages={f?.fields._form ?? []} />
        <PasswordField name="password" label="New password" errors={f?.fields.password} autoComplete="new-password" />
        <button className="submit" type="submit">Save password</button>
      </form>
    </main>
  );
}
