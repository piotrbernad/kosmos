import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  issues,
  issueAttachments,
  issueEvents,
  user,
} from "@/lib/db/schema";
import {
  toBoardCard,
  toIssueDetailForAdmin,
  toIssueDetailForReporter,
  toReporterListItem,
  type BoardCard,
  type IssueDetailForAdmin,
  type IssueDetailForReporter,
  type IssueListItem,
} from "@/lib/issues/dto";

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

// ---------------------------------------------------------------------------
// Issue reads. Ownership lives in the Drizzle `where` clause — for `user`
// role that means "reporterId = me", for `admin` role that means "no filter"
// (admins see everything). Same names on both sides so a mis-import is
// obvious in review.
// ---------------------------------------------------------------------------

/**
 * The reporter's own issues, newest first. Admin callers see nothing here —
 * they belong on `listAllIssues` (Phase 4). We call `notFound()` on admin
 * calls rather than returning silently so a mis-route is loud in tests.
 */
export const listMyIssues = cache(async (): Promise<IssueListItem[]> => {
  const me = await requireUser();
  if (me.role === "admin") notFound();

  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      attachmentCount: sql<number>`count(${issueAttachments.id})::int`,
    })
    .from(issues)
    .leftJoin(issueAttachments, eq(issueAttachments.issueId, issues.id))
    .where(eq(issues.reporterId, me.id))
    .groupBy(issues.id)
    .orderBy(desc(issues.createdAt));

  return rows.map(toReporterListItem);
});

/**
 * A single issue by id, gated on ownership. The ownership predicate lives
 * in the `WHERE` — for role `user` the query is `id = $ AND reporter_id = me`,
 * for role `admin` it is unfiltered on reporter. Either way, `notFound()` on
 * no row so "you don't own this" and "this doesn't exist" are indistinguishable
 * (per PRD: URLs cannot be probed).
 */
export const getMyIssue = cache(
  async (id: string): Promise<IssueDetailForReporter> => {
    const me = await requireUser();

    const ownership =
      me.role === "admin"
        ? eq(issues.id, id)
        : and(eq(issues.id, id), eq(issues.reporterId, me.id));

    const row = await db.query.issues.findFirst({
      where: ownership,
    });
    if (!row) notFound();

    const [attachmentRows, eventRows] = await Promise.all([
      db
        .select({
          id: issueAttachments.id,
          filename: issueAttachments.filename,
          contentType: issueAttachments.contentType,
          sizeBytes: issueAttachments.sizeBytes,
        })
        .from(issueAttachments)
        .where(eq(issueAttachments.issueId, row.id)),
      db
        .select({
          id: issueEvents.id,
          kind: issueEvents.kind,
          payload: issueEvents.payload,
          createdAt: issueEvents.createdAt,
          actorId: user.id,
          actorName: user.name,
        })
        .from(issueEvents)
        .leftJoin(user, eq(user.id, issueEvents.actorId))
        .where(eq(issueEvents.issueId, row.id))
        .orderBy(issueEvents.createdAt),
    ]);

    return toIssueDetailForReporter({
      ...row,
      attachments: attachmentRows,
      events: eventRows.map((e) => ({
        id: e.id,
        kind: e.kind,
        payload: e.payload,
        createdAt: e.createdAt,
        actor: e.actorId ? { id: e.actorId, name: e.actorName ?? "—" } : null,
      })),
    });
  },
);

// ---------------------------------------------------------------------------
// Admin surface. Both helpers `requireAdmin()` first so a mis-import from a
// reporter route 404s instead of leaking data.
// ---------------------------------------------------------------------------

/**
 * Full queue for the admin — every reporter's issue, newest first, with
 * attachment count and the reporter's name/email so the queue's `Zgłaszający`
 * column has something to show.
 */
export const listAllIssues = cache(async (): Promise<BoardCard[]> => {
  await requireAdmin();

  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      attachmentCount: sql<number>`count(distinct ${issueAttachments.id})::int`,
      reporterId: user.id,
      reporterName: user.name,
      reporterEmail: user.email,
    })
    .from(issues)
    .leftJoin(issueAttachments, eq(issueAttachments.issueId, issues.id))
    .innerJoin(user, eq(user.id, issues.reporterId))
    .groupBy(issues.id, user.id, user.name, user.email)
    .orderBy(desc(issues.createdAt));

  return rows.map((r) =>
    toBoardCard({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      attachmentCount: r.attachmentCount,
      reporter: {
        id: r.reporterId,
        name: r.reporterName ?? "—",
        email: r.reporterEmail ?? "",
      },
    }),
  );
});

/**
 * Admin-side single-issue read. Unlike `getMyIssue` there is no ownership
 * filter — the admin sees any issue by id. Still `notFound()` on miss so a
 * random UUID looks the same as a real one to a probe.
 */
export const getAnyIssue = cache(
  async (id: string): Promise<IssueDetailForAdmin> => {
    await requireAdmin();

    const row = await db.query.issues.findFirst({
      where: eq(issues.id, id),
    });
    if (!row) notFound();

    const [attachmentRows, eventRows, reporterRows] = await Promise.all([
      db
        .select({
          id: issueAttachments.id,
          filename: issueAttachments.filename,
          contentType: issueAttachments.contentType,
          sizeBytes: issueAttachments.sizeBytes,
        })
        .from(issueAttachments)
        .where(eq(issueAttachments.issueId, row.id)),
      db
        .select({
          id: issueEvents.id,
          kind: issueEvents.kind,
          payload: issueEvents.payload,
          createdAt: issueEvents.createdAt,
          actorId: user.id,
          actorName: user.name,
        })
        .from(issueEvents)
        .leftJoin(user, eq(user.id, issueEvents.actorId))
        .where(eq(issueEvents.issueId, row.id))
        .orderBy(issueEvents.createdAt),
      db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, row.reporterId))
        .limit(1),
    ]);

    const reporter = reporterRows[0] ?? {
      id: row.reporterId,
      name: "—",
      email: "",
    };

    return toIssueDetailForAdmin({
      ...row,
      attachments: attachmentRows,
      events: eventRows.map((e) => ({
        id: e.id,
        kind: e.kind,
        payload: e.payload,
        createdAt: e.createdAt,
        actor: e.actorId ? { id: e.actorId, name: e.actorName ?? "—" } : null,
      })),
      reporter,
    });
  },
);

/**
 * Attachment gate — the DAL half of `/api/attachments/[id]`. Runs the
 * same admin-OR-reporter predicate as `getMyIssue`; on any miss
 * (nonexistent id, wrong owner, non-admin) returns `null` so the route
 * handler can render a plain 404 without leaking existence.
 *
 * We deliberately do **not** call `notFound()` here — the caller is a
 * Route Handler, which returns a `Response` rather than throwing render
 * control back up. Route Handlers can call `notFound()` too, but a
 * plain `null` keeps this function usable from tests without a Next.js
 * dispatcher.
 */
export type AttachmentForServe = {
  id: string;
  issueId: string;
  blobUrl: string;
  blobPathname: string;
  contentType: string;
  filename: string;
};

export const getAttachmentForCurrentUser = cache(
  async (id: string): Promise<AttachmentForServe | null> => {
    const me = await requireUser();

    const [row] = await db
      .select({
        id: issueAttachments.id,
        issueId: issueAttachments.issueId,
        blobUrl: issueAttachments.blobUrl,
        blobPathname: issueAttachments.blobPathname,
        contentType: issueAttachments.contentType,
        filename: issueAttachments.filename,
        reporterId: issues.reporterId,
      })
      .from(issueAttachments)
      .innerJoin(issues, eq(issues.id, issueAttachments.issueId))
      .where(eq(issueAttachments.id, id))
      .limit(1);

    if (!row) return null;
    if (me.role !== "admin" && row.reporterId !== me.id) return null;

    return {
      id: row.id,
      issueId: row.issueId,
      blobUrl: row.blobUrl,
      blobPathname: row.blobPathname,
      contentType: row.contentType,
      filename: row.filename,
    };
  },
);
