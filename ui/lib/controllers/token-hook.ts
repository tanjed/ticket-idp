import { AuthzClient } from "../authz";
import { inject, singleton } from "../di";

// What Hydra sends to its token hook (oauth2.token_hook). extra is the access token's claims as
// consent set them; id_token_claims.ext the ID token's.
type HookRequest = {
  session?: {
    extra?: Record<string, unknown>;
    id_token?: { subject?: string; id_token_claims?: { sub?: string; ext?: Record<string, unknown> } };
  };
  request?: { grant_types?: string[] };
};

// Hydra's token hook, called on every token exchange. Internal: Hydra calls it on the UI's service
// name; the ingress must never route /api/internal/*.
@singleton()
export class TokenHookController {
  constructor(@inject(AuthzClient) private readonly authz: AuthzClient) {}

  // A provider's refreshed token gets fresh company, roles and authz_version from Authz: after a
  // role change the gateway refuses the old token (401 token_stale), and the refresh mends it.
  // Everything else keeps its claims (204): an authorization code's were set at consent just now.
  async hook(req: Request): Promise<Response> {
    const body = (await req.json().catch(() => null)) as HookRequest | null;
    const session = body?.session;
    if (!session) return new Response("Bad hook request", { status: 400 });
    const extra = session.extra ?? {};
    if (!body.request?.grant_types?.includes("refresh_token") || extra.user_type !== "provider") {
      return new Response(null, { status: 204 });
    }
    const sub = session.id_token?.subject || session.id_token?.id_token_claims?.sub;
    if (!sub) return new Response("No subject", { status: 400 });

    const claims = await this.authz.getClaims(sub);
    if (!claims.ok) {
      // No longer in a company, or the company is suspended: no new token, the user must sign in
      // again. Authz unreachable: the refresh fails, the client retries.
      return new Response(null, { status: claims.status === 404 || claims.status === 403 ? 403 : 503 });
    }
    // Hydra replaces both claim sets with what we return: send them whole.
    return Response.json({
      session: {
        access_token: {
          ...extra,
          company_id: claims.body.company_id,
          roles: claims.body.roles,
          authz_version: Number(claims.body.authz_version),
        },
        id_token: session.id_token?.id_token_claims?.ext ?? {},
      },
    });
  }
}
