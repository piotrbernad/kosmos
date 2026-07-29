"use server";

import type { ZodIssue } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { requireAdmin, requireUser } from "@/lib/dal";
import { db } from "@/lib/db/client";
import { issues, issueEvents, issueAttachments } from "@/lib/db/schema";
import type { IssueStatus } from "@/lib/db/schema";
import {
  AddCommentSchema,
  ChangeStatusSchema,
  CreateIssueSchema,
  type AddCommentInput,
  type ChangeStatusInput,
} from "./validators";
import {
  validateAttachments,
  type AllowedContentType,
  ALLOWED_CONTENT_TYPES,
} from "@/lib/attachments/validators";
import { put as blobPut, buildKey } from "@/lib/attachments/store";

/**
 * Discriminated result types. Expected failures (`invalid`, ...) return an
 * `{ ok: false, reason }` payload; genuine failures (DB down, etc.) throw and
 * render `app/error.tsx`. Discriminating on `ok` first, then `reason`, keeps
 * client-side handling exhaustive at the type level.
 *
 * Phase 3 adds `attachment_rejected` — surfaced when a per-file check fails
 * server-side. The result carries the accepted issue id alongside the
 * rejection list only in the `ok: true` branch, because if *any* file was
 * accepted we still want the issue to land.
 */
export type CreateIssueResult =
  | {
      ok: true;
      id: string;
      /** Files that were rejected server-side; other files (if any) landed. */
      rejected?: Array<{ name: string; message: string }>;
    }
  | { ok: false; reason: "invalid"; issues: ZodIssue[] }
  | {
      ok: false;
      reason: "attachment_rejected";
      rejected: Array<{ name: string; message: string }>;
    };

function isAllowedContentType(t: string): t is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(t);
}

/**
 * Create a new issue with title + description + up to five screenshots.
 * Author, timestamps, and the initial `Nowe` status are assigned server-side.
 *
 * Ordering:
 *   1. Parse text fields — bail on invalid.
 *   2. Read `attachment[]` File entries from FormData.
 *   3. `validateAttachments` server-side (client checks were UX only).
 *   4. If **zero** files land AND the client sent files, return
 *      `attachment_rejected` so the reporter sees why nothing uploaded —
 *      without losing the description. If **some** files land, the issue
 *      is created and the rejections come back on the success payload.
 *   5. Upload accepted blobs first (before the DB transaction). Uploads are
 *      idempotent-by-key, so a mid-transaction rollback leaves at most an
 *      orphan blob — cheaper than a two-phase commit for this workload.
 *   6. Insert the issue, attachments, and status seed event in one
 *      transaction so the feed cannot diverge from the row.
 */
export async function createIssue(formData: FormData): Promise<CreateIssueResult> {
  const parsed = CreateIssueSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { ok: false, reason: "invalid", issues: parsed.error.issues };
  }

  const me = await requireUser();

  // Collect File entries. `formData.getAll('attachment[]')` returns strings
  // and Files intermixed depending on how the client encoded them; we only
  // keep the File instances.
  const rawFiles = formData.getAll("attachment[]");
  const files: File[] = [];
  for (const entry of rawFiles) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }

  const { accepted, rejected } = validateAttachments(
    files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
  );

  // Nothing valid, but the reporter did try to upload → bail without
  // touching the DB so the description is preserved for a retry.
  if (files.length > 0 && accepted.length === 0) {
    return {
      ok: false,
      reason: "attachment_rejected",
      rejected: rejected.map((r) => ({ name: r.name, message: r.message })),
    };
  }

  // We need to reference the issue id in the blob key. Generate a
  // placeholder id up front via the DB's `gen_random_uuid()` so blob
  // keys stay predictable; the same id is INSERTed below.
  //
  // In practice: run the transaction, then upload afterwards? No — if
  // uploads fail, we've committed an issue with attachment rows that
  // point at nothing. So: upload first, insert second, and re-map by
  // file identity, not by row id.
  //
  // Simplest correct order: generate uuid in JS, upload with that id in
  // the key, then insert the row with the same id.
  const generatedIssueId = crypto.randomUUID();

  // Pair up accepted files with the original File instances so we can
  // read `.arrayBuffer()`. `accepted` above is a FileLike[] with no body;
  // we filter the original `files` list by matching name+size+type.
  const acceptedFiles: File[] = [];
  const remaining = [...files];
  for (const a of accepted) {
    const idx = remaining.findIndex(
      (f) => f.name === a.name && f.size === a.size && f.type === a.type,
    );
    if (idx !== -1) {
      acceptedFiles.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
  }

  type PreparedAttachment = {
    id: string;
    blobUrl: string;
    blobPathname: string;
    filename: string;
    contentType: AllowedContentType;
    sizeBytes: number;
  };

  const uploaded: PreparedAttachment[] = [];
  for (const file of acceptedFiles) {
    if (!isAllowedContentType(file.type)) continue; // defensive; validated above
    const key = buildKey(generatedIssueId, file.type);
    const body = Buffer.from(await file.arrayBuffer());
    const res = await blobPut(key, body, file.type);
    uploaded.push({
      id: crypto.randomUUID(),
      blobUrl: res.url,
      blobPathname: res.pathname,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(issues).values({
      id: generatedIssueId,
      reporterId: me.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "nowe",
    });

    if (uploaded.length > 0) {
      await tx.insert(issueAttachments).values(
        uploaded.map((u) => ({
          id: u.id,
          issueId: generatedIssueId,
          blobUrl: u.blobUrl,
          blobPathname: u.blobPathname,
          filename: u.filename,
          contentType: u.contentType,
          sizeBytes: u.sizeBytes,
        })),
      );
    }

    await tx.insert(issueEvents).values({
      issueId: generatedIssueId,
      actorId: me.id,
      kind: "status_change",
      payload: { kind: "status_change", from: "nowe", to: "nowe" },
    });
  });

  return {
    ok: true,
    id: generatedIssueId,
    rejected: rejected.length
      ? rejected.map((r) => ({ name: r.name, message: r.message }))
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 — non-resolving status changes and comments.
// ---------------------------------------------------------------------------

export type ChangeStatusResult =
  | { ok: true; updatedAt: string; from: IssueStatus; to: IssueStatus }
  | { ok: false; reason: "conflict" | "gone" | "invalid" };

/**
 * Admin-only. Moves an issue between `nowe` and `w_trakcie`. `rozwiazane`
 * is unreachable here at the schema level — resolution goes through
 * `resolveIssue` in Phase 5 so the mandatory comment is a type-level
 * fact, not a runtime `if`.
 *
 * Concurrency: the UPDATE gates on both `updated_at = expected` and
 * `status <> 'rozwiazane'`. Zero rows means either someone else changed
 * the issue between the admin's read and their action, or the issue was
 * concurrently resolved. Either way we report `conflict` and let the
 * caller `router.refresh()` to re-read.
 *
 * The status change and the audit event go in one transaction so the
 * feed cannot diverge from the row.
 */
export async function changeIssueStatus(
  input: ChangeStatusInput,
): Promise<ChangeStatusResult> {
  const parsed = ChangeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const me = await requireAdmin();
  const { id, to, expectedUpdatedAt } = parsed.data;
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) {
    return { ok: false, reason: "invalid" };
  }

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: issues.status })
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);

    if (!current) return { ok: false, reason: "gone" } as const;

    // Optimistic concurrency check: compare updated_at at millisecond
    // precision. Postgres stores microseconds, but the client's copy
    // of the token round-tripped through an ISO string (JSON has no
    // "timestamp with sub-ms precision"), so a direct `eq` on the raw
    // column would never match. Truncating both sides via `date_trunc`
    // keeps the guard meaningful without depending on driver micros.
    const [row] = await tx
      .update(issues)
      .set({ status: to, updatedAt: sql`now()` })
      .where(
        and(
          eq(issues.id, id),
          sql`date_trunc('milliseconds', ${issues.updatedAt}) = date_trunc('milliseconds', ${expected}::timestamptz)`,
          ne(issues.status, "rozwiazane"),
        ),
      )
      .returning({ updatedAt: issues.updatedAt, status: issues.status });

    if (!row) return { ok: false, reason: "conflict" } as const;

    // No-op transitions still record an event by design elsewhere in the
    // codebase (seed row is a self-transition). For an admin's manual
    // change we treat `to === from` as a no-op and don't clutter the feed.
    if (current.status !== to) {
      await tx.insert(issueEvents).values({
        issueId: id,
        actorId: me.id,
        kind: "status_change",
        payload: { kind: "status_change", from: current.status, to },
      });
    }

    return {
      ok: true as const,
      updatedAt: row.updatedAt.toISOString(),
      from: current.status,
      to: row.status,
    };
  });
}

export type AddCommentResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: "closed" | "invalid" | "gone" };

/**
 * Either side (reporter or admin) can comment while the issue is not
 * resolved. Reporter callers additionally have to own the issue —
 * enforced via the same ownership predicate as `getMyIssue`, so a
 * probe returns `gone` indistinguishably from a missing id.
 *
 * Once the issue is `rozwiazane`, comments are refused with `closed`
 * (PRD: "the composer is replaced by a line saying the discussion is
 * closed"). Phase 5's resolution flow depends on this guard so a
 * comment cannot land after resolution wins the race.
 *
 * `updated_at` is not bumped for comments — that column is the
 * optimistic-concurrency token for the issue's own fields (status,
 * title, description, attachments), not the conversation.
 */
export async function addComment(
  input: AddCommentInput,
): Promise<AddCommentResult> {
  const parsed = AddCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const me = await requireUser();
  const { issueId, body } = parsed.data;

  const ownership =
    me.role === "admin"
      ? eq(issues.id, issueId)
      : and(eq(issues.id, issueId), eq(issues.reporterId, me.id));

  const [current] = await db
    .select({ status: issues.status })
    .from(issues)
    .where(ownership)
    .limit(1);

  if (!current) return { ok: false, reason: "gone" };
  if (current.status === "rozwiazane") return { ok: false, reason: "closed" };

  const eventId = crypto.randomUUID();
  await db.insert(issueEvents).values({
    id: eventId,
    issueId,
    actorId: me.id,
    kind: "comment",
    payload: { kind: "comment", body },
  });

  return { ok: true, eventId };
}
