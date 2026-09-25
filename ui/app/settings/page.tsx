import Blocked from "@/components/blocked";
import { Errors, PasswordField } from "@/components/fields";
import { activeFlash, getCtx } from "@/lib/ctx";

export const dynamic = "force-dynamic";

// Only reachable after a successful recovery code.
export default async function Settings() {
  const ctx = await getCtx();
  if (!ctx?.kj || !ctx.sfl) return <Blocked />;
  const f = activeFlash(ctx);

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
