import { redirect } from "next/navigation";
import { Config } from "@/lib/config";
import { container } from "@/lib/di";
import StatusPage from "./status-page";

// An auth page opened without a sign-in in progress: go to UI_FALLBACK_URL if there is one,
// otherwise say the page can't be opened directly (deliberately generic: no app names, no reasons).
export default function Blocked() {
  const fallback = container.resolve(Config).fallbackUrl;
  if (fallback) redirect(fallback);
  return (
    <StatusPage tone="lock" title="This page can't be opened directly">
      Please go back to the app you were signing in to and start again.
    </StatusPage>
  );
}
