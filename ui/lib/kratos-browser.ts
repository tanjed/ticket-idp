import type { Flow } from "./flow";

// Recovery only. In API mode a correct recovery code returns no session, so the settings
// step has nothing to authenticate with. The UI plays the browser for those requests,
// keeping Kratos' cookies in a jar inside the encrypted context cookie.
const PUBLIC = process.env.KRATOS_INTERNAL_URL ?? "http://localhost:4433";
const ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";

export type Jar = Record<string, string>;
export type BResult<T = any> = { status: number; ok: boolean; body: T; jar: Jar };

const cookieHeader = (jar: Jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

async function call(url: string, jar: Jar, init: RequestInit = {}): Promise<BResult> {
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

export const csrfOf = (flow: Flow | undefined) =>
  flow?.ui?.nodes?.find((n) => n.attributes.name === "csrf_token")?.attributes.value ?? "";

export const startFlow = (type: "recovery" | "settings", jar: Jar = {}) =>
  call(`${PUBLIC}/self-service/${type}/browser`, jar);

export const readFlow = (type: "settings", id: string, jar: Jar): Promise<BResult<Flow>> =>
  call(`${PUBLIC}/self-service/${type}/flows?id=${encodeURIComponent(id)}`, jar);

export const submit = (type: "recovery" | "settings", id: string, body: object, jar: Jar) =>
  call(`${PUBLIC}/self-service/${type}?flow=${encodeURIComponent(id)}`, jar, { method: "POST", body: JSON.stringify(body) });

// Ends the temporary session.
export async function endSession(jar: Jar) {
  const who = await call(`${PUBLIC}/sessions/whoami`, jar);
  const id = who.body?.id;
  if (id) await fetch(`${ADMIN}/admin/sessions/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
}
