import { container } from "@/lib/di";
import { EmailVerificationApiController } from "@/lib/controllers/email-verification-api";

const api = () => container.resolve(EmailVerificationApiController);

export const OPTIONS = (req: Request) => api().options(req);
export const GET = (req: Request) => api().status(req);
