import { finishLogin, guard, noContext, str, to } from "@/lib/handlers";
import { setCtx } from "@/lib/ctx";
import { createCompany } from "@/lib/authz";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("res" in g) return g.res;
  const { ctx } = g;
  if (!ctx.co || !ctx.sub) return noContext();

  const name = str((await req.formData()).get("company"));
  const res = await createCompany(name, ctx.sub);
  if (!res.ok) {
    const text = res.reason === "invalid_name"
      ? "Enter a company name of up to 100 characters."
      : "Your company could not be created right now. Please try again.";
    await setCtx({ ...ctx, flash: { at: Date.now(), fields: { _form: [{ id: 0, text, type: "error" }] }, values: { company: name } } });
    return to("/company");
  }
  // finishLogin re-checks the phone and the membership, then accepts the Hydra login.
  return finishLogin(ctx, ctx.sub);
}
