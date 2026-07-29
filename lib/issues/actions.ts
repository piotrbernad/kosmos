"use server";

import type { ZodIssue } from "zod";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db/client";
import { issues, issueEvents, issueAttachments } from "@/lib/db/schema";
import { CreateIssueSchema } from "./validators";
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
