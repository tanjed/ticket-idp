import { container } from "@/lib/di";
import { OAuthController } from "@/lib/controllers/oauth";

export const GET = (req: Request) => container.resolve(OAuthController).logout(req);
