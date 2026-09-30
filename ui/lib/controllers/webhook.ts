import { inject, singleton } from "../di";
import { EVENTS, EventPublisher, type EventName } from "../events";

// The one webhook Kratos calls (hooks and courier): a bridge from Kratos to Kafka, nothing more.
// Body: { event, data }, shaped by chart/config/kratos/*.jsonnet. Validates and publishes; 5xx
// on failure so the courier retries. Internal only: the ingress must never route it.
@singleton()
export class KratosWebhookController {
  constructor(@inject(EventPublisher) private readonly events: EventPublisher) {}

  async handle(req: Request): Promise<Response> {
    const body = await req.json().catch(() => null);
    const event = body?.event as EventName | null | undefined;

    // Courier messages with no event (e.g. unknown-account notices): ack, so they aren't retried.
    if (event == null) return Response.json({ ok: true, ignored: true });
    if (!EVENTS.includes(event) || typeof body.data !== "object" || body.data === null) {
      return new Response("Bad event", { status: 400 });
    }

    try {
      await this.events.publish(event, body.data);
      return Response.json({ ok: true });
    } catch (e) {
      console.error(`[webhook] could not publish ${event}:`, (e as Error).message);
      return new Response("Event bus unavailable", { status: 503 });
    }
  }
}
