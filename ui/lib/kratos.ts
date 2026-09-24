import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Flow } from "./flow";

// Forward the raw Cookie header: cookies().toString() re-encodes values and
// Kratos then rejects its own CSRF cookie.
// Server-side calls go over the internal network (compose: http://kratos:4433).
// The browser is sent to the public URL (http://localhost:4433) for flow
// creation and form submission, so Kratos' CSRF cookie lands on `localhost`,
// which the browser also sends to this UI (cookies are not port-scoped).
const INTERNAL = process.env.KRATOS_INTERNAL_URL ?? "http://localhost:4433";
const BROWSER = process.env.KRATOS_BROWSER_URL ?? "http://localhost:4433";

type FlowType = "login" | "registration" | "recovery" | "verification" | "settings";

// No ?flow= yet: bounce the browser through Kratos, which creates the flow
// and redirects back here with ?flow=<id>.
export function startFlow(type: FlowType): never {
  redirect(`${BROWSER}/self-service/${type}/browser`);
}

export async function getFlow(type: FlowType, id: string): Promise<Flow> {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${INTERNAL}/self-service/${type}/flows?id=${id}`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  // Expired / unknown / cookie mismatch: start over.
  if (!res.ok) startFlow(type);
  return res.json();
}

export async function whoami(): Promise<{ identity?: { traits?: Record<string, any> } } | null> {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${INTERNAL}/sessions/whoami`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  return res.ok ? res.json() : null;
}
