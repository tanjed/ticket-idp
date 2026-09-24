import { whoami } from "@/lib/kratos";

export const dynamic = "force-dynamic";

// Kratos' default_browser_return_url lands here after login / registration.
export default async function Home() {
  const session = await whoami();
  const name = session?.identity?.traits?.name;

  return (
    <main className="page">
      {session ? (
        <>
          <h1>Welcome{name?.first ? `, ${name.first}` : ""}</h1>
          <p className="lead">You are signed in.</p>
        </>
      ) : (
        <>
          <h1>Shohoz Account</h1>
          <p className="switch"><a href="/login">Log In</a> · <a href="/registration">Sign up</a></p>
        </>
      )}
    </main>
  );
}
