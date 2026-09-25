import Blocked from "@/components/blocked";

export const dynamic = "force-dynamic";

// proxy.ts rewrites gated pages here, with a 403.
export default function BlockedPage() {
  return <Blocked />;
}
