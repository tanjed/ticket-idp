import Blocked from "@/components/blocked";
import { Errors, Field } from "@/components/fields";
import { activeFlash, getCtx } from "@/lib/ctx";

export const dynamic = "force-dynamic";

// Company onboarding: signed in (password and phone done) through a provider app, but in no
// company yet. Whoever creates the company becomes its administrator.
export default async function Company() {
  const ctx = await getCtx();
  if (!ctx?.co || !ctx.sub) return <Blocked />;
  const f = activeFlash(ctx);

  return (
    <main className="page">
      <h1>Create your company</h1>
      <p className="lead">
        This app is for companies. Create yours to continue: you will be its administrator and can invite your team.
        Invited by a company? Use the link in your SMS instead.
      </p>

      <form action="/company/submit" method="POST">
        <Errors messages={f?.fields._form ?? []} />
        <Field name="company" label="Company name" placeholder="Enter your company name"
          defaultValue={f?.values.company} errors={f?.fields.company} autoComplete="organization" />
        <button className="submit" type="submit">Create company</button>
      </form>
    </main>
  );
}
