import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adminInvitation, user } from "@/lib/db/schema";
import { generateRawToken, hashToken } from "./tokens";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | Tx;

export { generateRawToken, hashToken } from "./tokens";

/**
 * Admin invitation service. Shared by:
 *   • `scripts/admin-invite.ts` — operator CLI
 *   • `lib/invitations/actions.ts` — the `/aktywacja` claim action
 *
 * The invitation lifecycle:
 *
 *   invite({ email, name })   → upsert user (role='admin', no account row);
 *                                generate a 32-byte token; write
 *                                admin_invitation(user_id, token_hash) with
 *                                expires_at = now() + 7 days.
 *
 *   lookupUnusedInvitation(token)  → returns the row if the token matches
 *                                     sha256(raw), used_at IS NULL, and
 *                                     expires_at > now(); otherwise null.
 *
 *   markInvitationUsed(id)         → sets used_at = now(). Called from the
 *                                     claim action after the password lands.
 *
 * The partial unique index `admin_invitation_active_uidx` (created in Phase 1)
 * enforces at most one active invitation per user, so `invite()` on a user
 * who already has an active invite must first invalidate the prior row. We do
 * that in one transaction to keep the invariant atomic — the printed URL is
 * the only place the raw token exists, so a partial write would either leave
 * both links dead or leave the operator unable to hand out a fresh one.
 */

const EXPIRY_DAYS = 7;

export type InviteResult = {
  userId: string;
  email: string;
  rawToken: string;
  expiresAt: Date;
};

/**
 * Invite (or re-invite) an admin by email. Idempotent per email:
 *   • new email  → create user (role='admin') + one active invitation.
 *   • known email that is NOT an admin → promote to admin + issue invitation.
 *   • known admin with no credentials → issue a fresh invitation (invalidating
 *     any prior active one).
 *   • known admin who has already claimed (has an `account` credential row) →
 *     still issue a fresh invitation (they can use it to reset their password
 *     via the same claim flow) — but this is a niche path and not tested here.
 *
 * The whole thing runs in one transaction so the partial unique index cannot
 * be tripped by a race between "invalidate old" and "insert new".
 */
export async function invite(input: {
  email: string;
  name: string;
}): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email) throw new Error("invite: email is required");
  if (!name) throw new Error("invite: name is required");

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    // Find or create the invitee's user row.
    const [existing] = await tx
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
      if (existing.role !== "admin") {
        await tx.update(user).set({ role: "admin" }).where(eq(user.id, userId));
      }
    } else {
      // Better Auth's default id generator is a nanoid-shaped string; we
      // mirror that with a crypto UUID so the row is compatible with the
      // adapter's later reads (it treats `id` as an opaque string).
      userId = crypto.randomUUID();
      await tx.insert(user).values({
        id: userId,
        email,
        name,
        role: "admin",
        emailVerified: false,
      });
    }

    // Invalidate any prior active invitation atomically.
    await tx
      .update(adminInvitation)
      .set({ usedAt: now })
      .where(
        and(
          eq(adminInvitation.userId, userId),
          isNull(adminInvitation.usedAt),
        ),
      );

    await tx.insert(adminInvitation).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return { userId, email, rawToken, expiresAt };
  });
}

export type UnusedInvitation = {
  id: string;
  userId: string;
  email: string;
  name: string;
};

/**
 * Look up an unused, unexpired invitation by raw token. Returns `null` for
 * every failure mode (bad token, expired, already used, unknown user) — the
 * caller renders the same 404 either way, so probes cannot enumerate.
 */
export async function lookupUnusedInvitation(
  rawToken: string,
): Promise<UnusedInvitation | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      id: adminInvitation.id,
      userId: adminInvitation.userId,
      expiresAt: adminInvitation.expiresAt,
      usedAt: adminInvitation.usedAt,
      email: user.email,
      name: user.name,
    })
    .from(adminInvitation)
    .innerJoin(user, eq(user.id, adminInvitation.userId))
    .where(eq(adminInvitation.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.usedAt !== null) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;

  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    name: row.name,
  };
}

export async function markInvitationUsed(id: string): Promise<void> {
  await db
    .update(adminInvitation)
    .set({ usedAt: new Date() })
    .where(eq(adminInvitation.id, id));
}

/**
 * Atomically consume an unused, unexpired invitation. Unlike
 * `lookupUnusedInvitation` + `markInvitationUsed`, this cannot race —
 * the `WHERE used_at IS NULL AND expires_at > now()` guard lives inside
 * the same UPDATE that sets `used_at`, and only the winner of a concurrent
 * claim gets a `RETURNING` row.
 *
 * Accepts a `DbOrTx` so the caller can bundle this consume with the password
 * write in a single transaction — if the password write fails, the whole
 * transaction rolls back and the invitation is NOT consumed.
 *
 * Returns the invitation + invitee identity on the winning claim; `null` for
 * every other outcome (bad token, expired, already used, unknown user).
 */
export async function claimUnusedInvitation(
  rawToken: string,
  runner: DbOrTx = db,
): Promise<UnusedInvitation | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [claimed] = await runner
    .update(adminInvitation)
    .set({ usedAt: now })
    .where(
      and(
        eq(adminInvitation.tokenHash, tokenHash),
        isNull(adminInvitation.usedAt),
        gt(adminInvitation.expiresAt, sql`now()`),
      ),
    )
    .returning({
      id: adminInvitation.id,
      userId: adminInvitation.userId,
    });

  if (!claimed) return null;

  const [invitee] = await runner
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, claimed.userId))
    .limit(1);

  if (!invitee) return null;

  return {
    id: claimed.id,
    userId: claimed.userId,
    email: invitee.email,
    name: invitee.name,
  };
}
