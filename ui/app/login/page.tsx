import Blocked from "@/components/blocked";
import { Errors, Field, PasswordField } from "@/components/fields";
import { ContextStore } from "@/lib/ctx";
import { container } from "@/lib/di";

export const dynamic = "force-dynamic";

export default async function Login() {
  const store = container.resolve(ContextStore);
  const ctx = await store.get();
  if (!ctx) return <Blocked />;
  const f = store.flash(ctx);

  return (
    <main className="page">
      <h1>Log in</h1>
      <p className="lead">Welcome back. Log in to manage your Shohoz account.</p>

      <form action="/login/submit" method="POST">
        <Errors messages={f?.fields._form ?? []} />
        <Field name="identifier" label="Mobile Number" type="tel" placeholder="Enter your mobile number"
          defaultValue={f?.values.identifier} errors={f?.fields.identifier} autoComplete="username" />
        <PasswordField name="password" label="Password" errors={f?.fields.password} autoComplete="current-password" />
        <p className="forgot"><a href="/recovery">Forgot password?</a></p>
        <button className="submit" type="submit">Log in</button>
        <p className="switch">New here? <a href="/registration">Create an account</a></p>
      </form>
    </main>
  );
}
