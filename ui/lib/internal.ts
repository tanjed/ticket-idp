import { Config } from "./config";
import { inject, singleton } from "./di";

// Authz's endpoints (/api/internal/*) are called on the UI's service name, never on its public
// host. The ingress must not route them; this refuses them anyway.
@singleton()
export class InternalGuard {
  constructor(@inject(Config) private readonly config: Config) {}

  refusePublicHost(req: Request): Response | null {
    if (req.headers.get("host") === new URL(this.config.publicUiUrl).host) {
      return new Response("Forbidden", { status: 403 });
    }
    return null;
  }
}
