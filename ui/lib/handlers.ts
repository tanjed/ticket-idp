import { Config } from "./config";
import { ContextStore, type Ctx } from "./ctx";
import { inject, singleton } from "./di";
import { fieldMessages, type Flow } from "./flow";

export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// Shared behaviour of the auth pages' POST handlers: the context-cookie guard, redirects, and
// re-rendering a page with messages.
@singleton()
export class FlowResponder {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(ContextStore) private readonly store: ContextStore,
  ) {}

  to(path: string) {
    return Response.redirect(`${this.config.publicUiUrl}${path}`, 303);
  }

  // CSRF: SameSite=Lax cookie plus an Origin check.
  originOk(req: Request): boolean {
    const origin = req.headers.get("origin");
    return !origin || origin === new URL(this.config.publicUiUrl).origin;
  }

  noContext() {
    return new Response("This page can only be reached by signing in through an app. Please go back to your app and try again.", {
      status: 403,
    });
  }

  async guard(req: Request): Promise<{ ctx: Ctx } | { res: Response }> {
    if (!this.originOk(req)) return { res: new Response("Bad origin", { status: 403 }) };
    const ctx = await this.store.get();
    return ctx ? { ctx } : { res: this.noContext() };
  }

  // Re-render a page with Kratos' messages and the non-secret values typed.
  async back(path: string, ctx: Ctx, flow: Flow | undefined, values: Record<string, string> = {}, extra?: Partial<Ctx>) {
    const fields = fieldMessages(flow);
    if (Object.keys(fields).length === 0) {
      // Kratos answered with an error object rather than a flow (a 500, a rate limit, ...): never reload silently.
      console.error("[kratos] nothing to show for this answer:", JSON.stringify(flow ?? null).slice(0, 500));
      const limited = (flow as { error?: { code?: number } } | undefined)?.error?.code === 429;
      fields._form = [{
        id: 0,
        type: "error",
        text: limited ? "Too many attempts. Please wait a moment and try again." : "Something went wrong. Please try again.",
      }];
    }
    await this.store.set({ ...ctx, ...extra, flash: { at: Date.now(), fields, values } });
    return this.to(path);
  }

  async backWithText(path: string, ctx: Ctx | Pick<Ctx, "ch" | "exp">, text: string, type = "error", extra?: Partial<Ctx>, values: Record<string, string> = {}) {
    await this.store.set({
      ...ctx,
      ...extra,
      flash: { at: Date.now(), fields: { _form: [{ id: 0, text, type }] }, values },
    });
    return this.to(path);
  }
}
