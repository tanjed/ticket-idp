import { container } from "@/lib/di";
import { InternalController } from "@/lib/controllers/internal";

export const GET = (req: Request) => container.resolve(InternalController).identityByPhone(req);
