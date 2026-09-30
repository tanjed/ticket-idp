import { container } from "@/lib/di";
import { KratosWebhookController } from "@/lib/controllers/webhook";

export const POST = (req: Request) => container.resolve(KratosWebhookController).handle(req);
