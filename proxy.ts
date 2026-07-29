import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-out visitors on protected paths are redirected to /logowanie.
 *
 * This is NOT a security check. It's an ergonomics redirect that avoids
 * rendering a "please sign in" wall on every protected page. Real
 * authorization lives in lib/dal.ts — `requireUser` / `requireAdmin` —
 * which every Server Component, Server Action, and Route Handler calls
 * as its first act.
 *
 * We deliberately do NOT call the DB or Better Auth here. Proxy runs on
 * every request including prefetches; database lookups in proxy would be
 * both expensive and easily bypassed (see CVE-2025-29927 for what happens
 * when middleware becomes the security perimeter).
 *
 * The cookie check here is a "did we ever set a session cookie" hint only.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Best-effort session cookie presence check. Better Auth uses cookies
  // prefixed with `better-auth.` (and `__Secure-` in prod). We look for
  // any of them without validating; the DAL will re-check for real.
  const hasSessionCookie = request.cookies.getAll().some((c) => {
    const name = c.name.toLowerCase();
    return name.includes("better-auth.session_token") || name.includes("session_token");
  });

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/logowanie";
    // Preserve the target so we can bounce the user back after sign-in
    // (login page reads ?next=…).
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * matcher values must be statically analysable (Next 16). We protect the two
 * app segments and let the auth pages and API handlers through unconditionally.
 */
export const config = {
  matcher: ["/zgloszenia/:path*", "/admin/:path*"],
};
