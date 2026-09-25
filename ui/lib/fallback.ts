// Where to send people who open an auth page directly (UI_FALLBACK_URL, e.g. the company site).
// Only http/https are accepted; anything else counts as unset.
export function fallbackUrl(): string | null {
  try {
    const u = new URL(process.env.UI_FALLBACK_URL ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
