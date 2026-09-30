import { Config } from "./config";
import { inject, singleton } from "./di";
import type { Flow } from "./flow";
import { KratosAdmin } from "./identity";

export type Jar = Record<string, string>;
export type BResult<T = any> = { status: number; ok: boolean; body: T; jar: Jar };

const cookieHeader = (jar: Jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

export const csrfOf = (flow: Flow | undefined) =>
  flow?.ui?.nodes?.find((n) => n.attributes.name === "csrf_token")?.attributes.value ?? "";

// Recovery only. In API mode a correct recovery code returns no session, so the settings
// step has nothing to authenticate with. The UI plays the browser for those requests,
// keeping Kratos' cookies in a jar inside the encrypted context cookie.
@singleton()
export class KratosBrowser {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
  ) {}

  private async call(url: string, jar: Jar, init: RequestInit = {}): Promise<BResult> {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        cookie: cookieHeader(jar),
      },
    });
    const next = { ...jar };
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), value = pair.slice(i + 1);
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c)) delete next[name];
      else next[name] = value;
    }
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, ok: res.ok, body, jar: next };
  }

  startFlow(type: "recovery" | "settings", jar: Jar = {}) {
    return this.call(`${this.config.kratosPublicUrl}/self-service/${type}/browser`, jar);
  }

  readFlow(type: "settings", id: string, jar: Jar): Promise<BResult<Flow>> {
    return this.call(`${this.config.kratosPublicUrl}/self-service/${type}/flows?id=${encodeURIComponent(id)}`, jar);
  }

  submit(type: "recovery" | "settings", id: string, body: object, jar: Jar) {
    return this.call(`${this.config.kratosPublicUrl}/self-service/${type}?flow=${encodeURIComponent(id)}`, jar, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // Ends the temporary session.
  async endSession(jar: Jar) {
    const who = await this.call(`${this.config.kratosPublicUrl}/sessions/whoami`, jar);
    const id = who.body?.id;
    if (id) await this.admin.deleteSession(id);
  }
}
