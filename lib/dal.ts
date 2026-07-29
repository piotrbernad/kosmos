import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Data Access Layer — the security boundary for the whole app.
 *
 * Every Server Component, Server Action, and Route Handler that touches
 * per-user data begins by calling one of these. `React.cache` memoizes the
 * result across a single render pass so a page rendering N components decrypts
 * the session cookie once.
 *
 * Phase 1 ships only the auth guards; read/list helpers land in Phase 2+.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
};

async function readSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as { id: string; email: string; name: string; role?: string | null };
  const role: "user" | "admin" = u.role === "admin" ? "admin" : "user";
  return { id: u.id, email: u.email, name: u.name, role };
}

/**
 * Redirects to /logowanie if there is no session. Returns the session user
 * otherwise. Callable from Server Components, Server Actions, and Route
 * Handlers.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await readSessionUser();
  if (!user) redirect("/logowanie");
  return user;
});

/**
 * Same as `requireUser`, but 404s (not 403 — the PRD's privacy boundary is
 * expressed as absence) if the caller is not an admin.
 */
export const requireAdmin = cache(async (): Promise<SessionUser> => {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
});

/**
 * Returns the session user without redirecting. Useful for `/` where we want
 * to route by role and for the login/register pages that should redirect an
 * already-signed-in user forward.
 */
export const getSessionUserOrNull = cache(async (): Promise<SessionUser | null> => {
  return readSessionUser();
});
