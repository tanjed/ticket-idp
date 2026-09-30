import Blocked from "@/components/blocked";
import { Errors, Field } from "@/components/fields";
import { ContextStore } from "@/lib/ctx";
import { container } from "@/lib/di";

export const dynamic = "force-dynamic";

// Company onboarding: signed in (password and phone done) through a provider app, but in no
// company yet. Whoever creates the company becomes its administrator.
export default async function Company() {
  const store = container.resolve(ContextStore);
  const ctx = await store.get();
  if (!ctx?.co || !ctx.sub) return <Blocked />;
  const f = store.flash(ctx);

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
