"use server";

import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { account } from "@/lib/db/schema";
import { ClaimSchema, type ClaimInput } from "./validators";
import { lookupUnusedInvitation, markInvitationUsed } from "./service";

/**
 * Result of `claimInvitation`. Success carries the email that was used to
 * sign the user in, so the client can `router.push('/admin/zgloszenia')`
 * with confidence that the session cookie is set on the response.
 *
 * `expired_or_used` collapses every "the URL no longer works" reason into
 * one shape: unknown token, tampered token, expired invitation, and already
 * used invitation all render the same 404 on the page. Callers should not
 * try to distinguish — that would let a probe learn which tokens ever
 * existed.
 */
export type ClaimResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired_or_used" };

/**
 * Claim an admin invitation and sign the invitee in.
 *
 * Steps:
 *   1. Parse input (token + password).
 *   2. Look up an unused, unexpired invitation matching sha256(token).
 *   3. Write the credential:
 *        • If the user already has a `credential` account row (rare, but
 *          the flow supports it), UPDATE its `password`.
 *        • Otherwise, INSERT a new `credential` account row with the hashed
 *          password.
 *      Better Auth's own `setPassword` endpoint requires the caller to be
 *      signed in (`sensitiveSessionMiddleware`), which is impossible for a
 *      first-time invitee. We use Better Auth's `hashPassword` from
 *      `better-auth/crypto` so the hash is 100% compatible with the sign-in
 *      path — same scrypt parameters, same envelope format.
 *   4. Mark the invitation used.
 *   5. Sign the user in via `auth.api.signInEmail`; the `nextCookies()`
 *      plugin (last in the auth plugins list) makes the Set-Cookie stick
 *      on the Server Action response.
 *
 * Failure modes:
 *   • Invalid input shape → `invalid`.
 *   • Anything about the lookup that isn't a straight hit → `expired_or_used`.
 *   • Anything about auth (bad hash, sign-in mismatch) rethrows to
 *     `app/error.tsx`. Those failures are genuine bugs, not a probe.
 */
export async function claimInvitation(input: ClaimInput): Promise<ClaimResult> {
  const parsed = ClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const { token, password } = parsed.data;

  const invitation = await lookupUnusedInvitation(token);
  if (!invitation) return { ok: false, reason: "expired_or_used" };

  // Hash the password with Better Auth's own hasher so the sign-in step
  // below produces the same envelope shape it would recognize on a normal
  // login. This is the same hasher `sign-up` and `setPassword` use
  // internally.
  const passwordHash = await hashPassword(password);

  const [existingAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, invitation.userId),
        eq(account.providerId, "credential"),
      ),
    )
    .limit(1);

  if (existingAccount) {
    await db
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, existingAccount.id));
  } else {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: invitation.userId,
      providerId: "credential",
      userId: invitation.userId,
      password: passwordHash,
    });
  }

  await markInvitationUsed(invitation.id);

  // Sign the invitee in. `nextCookies()` (last in the plugin array in
  // lib/auth.ts) makes the Set-Cookie header returned by signInEmail
  // land on the Server Action response.
  await auth.api.signInEmail({
    body: { email: invitation.email, password },
    // Header the auth handler expects; the plugin picks the cookie out.
    headers: new Headers(),
    asResponse: false,
  });

  return { ok: true, email: invitation.email };
}
