// Cluster-internal endpoints (the Kratos webhook, /api/internal/*) are called on the UI's service
// name, never on its public host. The ingress must not route them; this refuses them anyway.
export function refusePublicHost(req: Request): Response | null {
  if (req.headers.get("host") === new URL(process.env.PUBLIC_UI_URL ?? "http://invalid").host) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
