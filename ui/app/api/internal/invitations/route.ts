import { container } from "@/lib/di";
import { InternalController } from "@/lib/controllers/internal";

export const POST = (req: Request) => container.resolve(InternalController).sendInvitation(req);
