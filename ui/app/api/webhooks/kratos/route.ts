import { EVENTS, publishEvent, type EventName } from "@/lib/events";

// The one webhook Kratos calls (hooks and courier). Body: { event, data }, shaped by
// chart/config/kratos/*.jsonnet. Validates and publishes to Kafka; 5xx on failure so the
// courier retries. Internal only: the ingress must not route it, and requests addressed to the
// UI's public host are refused.
export async function POST(req: Request) {
  // Kratos calls the internal service name; refuse anything addressed to the public host.
  if (req.headers.get("host") === new URL(process.env.PUBLIC_UI_URL ?? "http://invalid").host) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const event = body?.event as EventName | null | undefined;

  // Courier messages with no event (e.g. unknown-account notices): ack, so they aren't retried.
  if (event == null) return Response.json({ ok: true, ignored: true });
  if (!EVENTS.includes(event) || typeof body.data !== "object" || body.data === null) {
    return new Response("Bad event", { status: 400 });
  }

  try {
    await publishEvent(event, body.data);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[webhook] could not publish ${event}:`, (e as Error).message);
    return new Response("Event bus unavailable", { status: 503 });
  }
}
