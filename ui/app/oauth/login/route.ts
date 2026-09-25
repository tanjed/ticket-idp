import { setCtx } from "@/lib/ctx";
import { acceptLogin, getLoginRequest } from "@/lib/hydra";
import { to } from "@/lib/handlers";

// Hydra's urls.login, the only entry point to authentication: validates the challenge
// and pins it to this browser in the encrypted context cookie.
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("login_challenge");
  if (!challenge) return new Response("Missing login_challenge", { status: 400 });

  const login = await getLoginRequest(challenge).catch(() => null);
  if (!login) return new Response("Unknown or expired login request", { status: 400 });

  // Remembered login: no credentials needed.
  if (login.skip) {
    const { redirect_to } = await acceptLogin(challenge, { subject: login.subject });
    return Response.redirect(redirect_to, 303);
  }

  await setCtx({ ch: challenge });
  const signup = new URL(login.request_url).searchParams.get("screen_hint") === "signup";
  return to(signup ? "/registration" : "/login");
}
