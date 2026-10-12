import { container } from "@/lib/di";
import { TokenHookController } from "@/lib/controllers/token-hook";

export const POST = (req: Request) => container.resolve(TokenHookController).hook(req);
