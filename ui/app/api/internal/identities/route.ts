import { refusePublicHost } from "@/lib/internal";
import { identityIdByPhone } from "@/lib/kratos-api";

// Internal (Authz): the identity id for a phone, so Authz can refuse to invite someone who
// already belongs to a company. 404 when there is none.
export async function GET(req: Request) {
  const refused = refusePublicHost(req);
  if (refused) return refused;

  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return new Response("Bad phone", { status: 400 });
  const id = await identityIdByPhone(phone);
  return id ? Response.json({ id }) : new Response("Not found", { status: 404 });
}
