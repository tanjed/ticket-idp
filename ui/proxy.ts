import { NextRequest, NextResponse } from "next/server";
import { Config } from "@/lib/config";
import { COOKIE, CookieCipher } from "@/lib/ctx-cookie";
import { container } from "@/lib/di";

// The auth pages only make sense inside a sign-in that started at /oauth/login (which sets the
// context cookie). Without a valid one: redirect to UI_FALLBACK_URL if set, otherwise a real 403
// with the standard "can't be opened directly" page. POSTs are checked by their own handlers.
export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE)?.value;
  if (req.method !== "GET" || (cookie && container.resolve(CookieCipher).open(cookie))) return NextResponse.next();
  const fallback = container.resolve(Config).fallbackUrl;
  if (fallback) return NextResponse.redirect(fallback);
  return NextResponse.rewrite(new URL("/blocked", req.url), { status: 403 });
}

export const config = {
  matcher: ["/login", "/registration", "/recovery", "/verification", "/settings", "/company"],
};
