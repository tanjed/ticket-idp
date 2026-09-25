import { NextRequest, NextResponse } from "next/server";
import { COOKIE, open } from "@/lib/ctx-cookie";
import { fallbackUrl } from "@/lib/fallback";

// The auth pages only make sense inside a sign-in that started at /oauth/login (which sets the
// context cookie). Without a valid one: redirect to UI_FALLBACK_URL if set, otherwise a real 403
// with the standard "can't be opened directly" page. POSTs are checked by their own handlers.
export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE)?.value;
  if (req.method !== "GET" || (cookie && open(cookie))) return NextResponse.next();
  const fallback = fallbackUrl();
  if (fallback) return NextResponse.redirect(fallback);
  return NextResponse.rewrite(new URL("/blocked", req.url), { status: 403 });
}

export const config = {
  matcher: ["/login", "/registration", "/recovery", "/verification", "/settings"],
};
