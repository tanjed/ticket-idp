import { container } from "@/lib/di";
import { AuthController } from "@/lib/controllers/auth";

export const POST = (req: Request) => container.resolve(AuthController).submitRegistration(req);
