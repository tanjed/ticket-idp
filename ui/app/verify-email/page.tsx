import StatusPage from "@/components/status-page";
import { verifyEmailToken } from "@/lib/email-token";
import { markEmailVerified } from "@/lib/email-verification";
import { getClient } from "@/lib/hydra";

export const dynamic = "force-dynamic";

// From the emailed link, any device: no session needed.
export default async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? verifyEmailToken(token) : ({ ok: false, reason: "invalid" } as const);
  const done = result.ok && (await markEmailVerified(result.payload.sub, result.payload.email));

  // For a client app: back to its redirect URI.
  const cid = result.ok ? result.payload.cid : undefined;
  const returnTo = done && cid ? await getClient(cid).then((c) => c.redirect_uris?.[0] ?? null).catch(() => null) : null;

  const action = returnTo ? { href: returnTo, label: "Return to app" } : undefined;
  if (done) {
    return <StatusPage tone="check" title="Email verified" action={action}>Thanks, your email address is verified.</StatusPage>;
  }
  const expired = !result.ok && result.reason === "expired";
  return (
    <StatusPage tone="alert" title="Link not valid">
      {expired ? "This link has expired." : "This verification link is invalid or no longer applies to your account."}{" "}
      Log in and request a new one from your account page.
    </StatusPage>
  );
}
