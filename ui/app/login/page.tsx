import { Errors, Field, PasswordField } from "@/components/fields";
import { errors, value } from "@/lib/flow";
import { getFlow, startFlow } from "@/lib/kratos";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow: id } = await searchParams;
  if (!id) startFlow("login");
  const flow = await getFlow("login", id);

  return (
    <main className="page">
      <h1>Log in</h1>
      <p className="lead">Welcome back. Log in to manage your Shohoz account.</p>

      <form action={flow.ui.action} method={flow.ui.method}>
        <input type="hidden" name="csrf_token" value={value(flow, "csrf_token")} />
        <input type="hidden" name="method" value="password" />

        <Errors messages={flow.ui.messages ?? []} />

        <Field name="identifier" label="Mobile Number" type="tel" placeholder="Enter your mobile number"
          defaultValue={value(flow, "identifier")} errors={errors(flow, "identifier")}
          autoComplete="username" />
        <PasswordField name="password" label="Password" errors={errors(flow, "password")}
          autoComplete="current-password" />
        <p className="forgot"><a href="/recovery">Forgot password?</a></p>

        <button className="submit" type="submit">Log in</button>

        <p className="switch">New here? <a href="/registration">Create an account</a></p>
      </form>
    </main>
  );
}
