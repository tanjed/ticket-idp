import { container } from "@/lib/di";
import { InviteController } from "@/lib/controllers/invite";

export const POST = (req: Request) => container.resolve(InviteController).submit(req);
