import { AuthzClient } from "../authz";
import { inject, singleton } from "../di";
import { EventPublisher } from "../events";
import { FlowResponder, str } from "../handlers";
import { KratosAdmin } from "../identity";
import { InviteTokens } from "../invite-token";

// Accepts a staff invitation. The signed token (sent by SMS to the phone) is the only credential:
// it names the invitation and the phone. Results are shown back on /invite.
@singleton()
export class InviteController {
  constructor(
    @inject(FlowResponder) private readonly respond: FlowResponder,
    @inject(AuthzClient) private readonly authz: AuthzClient,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
    @inject(InviteTokens) private readonly tokens: InviteTokens,
    @inject(EventPublisher) private readonly events: EventPublisher,
  ) {}

  async submit(req: Request): Promise<Response> {
    if (!this.respond.originOk(req)) return new Response("Bad origin", { status: 403 });
    const form = await req.formData();
    const token = String(form.get("token") ?? "");
    const back = (e?: string) => this.respond.to(`/invite?token=${encodeURIComponent(token)}${e ? `&e=${e}` : ""}`);

    const v = this.tokens.verify(token);
    if (!v.ok) return back();
    const { iid, phone } = v.payload;
    const inv = await this.authz.getInvitation(iid);
    if (!inv.ok || inv.body.status !== "INVITATION_STATUS_PENDING" || inv.body.phone !== phone) return back();

    let sub = await this.admin.identityIdByPhone(phone);
    let created: { first: string; last: string; email: string } | null = null;
    if (!sub) {
      const first = str(form.get("first")), last = str(form.get("last")), email = str(form.get("email"));
      const password = String(form.get("password") ?? "");
      if (!first || !last || !email.includes("@") || password.length < 8) return back("fields");
      const r = await this.admin.createInvitedIdentity({ phone, email, name: { first, last } }, password);
      if (!r.ok) return back(r.status === 409 ? "taken" : "create");
      sub = r.id;
      created = { first, last, email };
    }

    const acc = await this.authz.acceptInvitation(iid, sub);
    if (!acc.ok) {
      // A new account stays (it can sign in to consumer apps); the page says what went wrong.
      if (acc.reason === "already_member") return back("member");
      if (acc.reason !== "already_accepted") return back("accept");
    }

    // Admin-created identities fire no Kratos hook: announce the signup ourselves.
    if (created) {
      this.events.publish("USER_REGISTERED", {
        identity_id: sub, email: created.email, phone, first_name: created.first, last_name: created.last, gender: null,
      }).catch((e) => console.error("[events] USER_REGISTERED not published:", e.message));
    }
    return back();
  }
}
