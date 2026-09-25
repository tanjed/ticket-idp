import { acceptLogout } from "@/lib/hydra";

// Hydra's urls.logout. Only Hydra's session is left to end (Kratos sessions are revoked at login).
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("logout_challenge");
  if (!challenge) return new Response("Missing logout_challenge", { status: 400 });
  const { redirect_to } = await acceptLogout(challenge);
  return Response.redirect(redirect_to, 303);
}
