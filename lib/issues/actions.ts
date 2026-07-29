"use server";

import type { ZodIssue } from "zod";
import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db/client";
import { issues, issueEvents } from "@/lib/db/schema";
import { CreateIssueSchema } from "./validators";

/**
 * Discriminated result types. Expected failures (`invalid`, ...) return an
 * `{ ok: false, reason }` payload; genuine failures (DB down, etc.) throw and
 * render `app/error.tsx`. Discriminating on `ok` first, then `reason`, keeps
 * client-side handling exhaustive at the type level.
 *
 * Phase 2 supports text-only input. `attachment_rejected` is added in Phase 3.
 */
export type CreateIssueResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid"; issues: ZodIssue[] };

/**
 * Create a new issue with just title + description. Author, timestamps, and
 * the initial `Nowe` status are assigned server-side — the reporter never
 * picks them.
 *
 * The status seed and the issue insert live in one transaction so the feed
 * cannot diverge from the issue's current status.
 *
 * Contract:
 * - `formData.title`: 3–200 chars (trimmed)
 * - `formData.description`: 1–5000 chars (trimmed)
 *
 * FormData is used (rather than a typed input object) so this signature can
 * grow to accept `File[]` in Phase 3 without a breaking change.
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

  const newId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(issues)
      .values({
        reporterId: me.id,
        title: parsed.data.title,
        description: parsed.data.description,
        // status defaults to `nowe`, but insert it explicitly so the seed
        // event and the row agree by construction.
        status: "nowe",
      })
      .returning({ id: issues.id });

    await tx.insert(issueEvents).values({
      issueId: inserted.id,
      actorId: me.id,
      kind: "status_change",
      // First row: from an implicit pre-existence to the initial state. We
      // reuse the same shape as later transitions so `<IssueFeed>` renders
      // the "Utworzono zgłoszenie" line without a second branch.
      payload: { kind: "status_change", from: "nowe", to: "nowe" },
    });

    return inserted.id;
  });

  return { ok: true, id: newId };
}
