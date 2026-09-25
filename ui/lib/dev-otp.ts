// LOCAL DEV ONLY: with DEV_STATIC_OTP set, that code is swapped for the real one Kratos
// queued (Kratos can't use a fixed code).
const STATIC = process.env.DEV_STATIC_OTP;
const ADMIN = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";

export async function resolveOtp(code: string): Promise<string> {
  if (!STATIC || code !== STATIC) return code;
  try {
    const list = await fetch(`${ADMIN}/admin/courier/messages?page_size=20`, { cache: "no-store" });
    const msgs: { id: string; template_type: string }[] = await list.json();
    const m = msgs.find((x) => /^(verification|recovery)_code/.test(x.template_type));
    if (!m) return code;
    const res = await fetch(`${ADMIN}/admin/courier/messages/${m.id}`, { cache: "no-store" });
    return ((await res.json()).body ?? "").match(/\b\d{6}\b/)?.[0] ?? code;
  } catch {
    return code;
  }
}
