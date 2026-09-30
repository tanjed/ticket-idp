import { redirect } from "next/navigation";
import StatusPage from "@/components/status-page";
import { Config } from "@/lib/config";
import { container } from "@/lib/di";

export const dynamic = "force-dynamic";

// Hydra's urls.post_logout_redirect: where the browser lands after a logout. Apps end their own
// session and start Hydra's logout without an id_token_hint (which would put the ID token in the
// browser), so Hydra can't send people back to a specific app. Go to UI_FALLBACK_URL if set.
export default function SignedOut() {
  const fallback = container.resolve(Config).fallbackUrl;
  if (fallback) redirect(fallback);
  return (
    <StatusPage tone="check" title="You've been signed out">
      You can close this page.
    </StatusPage>
  );
}
