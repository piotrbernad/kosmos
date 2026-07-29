import type { EventPayload, IssueStatus } from "./validators";

/**
 * DTO shapes returned by the DAL. The DAL never hands raw Drizzle rows to
 * Server Components or Server Actions — this file is the seam where fields
 * that shouldn't cross the RSC serialization boundary get dropped, and where
 * dates get normalised to ISO strings so the client can parse them without
 * re-hydration surprises.
 *
 * Phase 2 covers the reporter's list + detail. Admin DTOs (list card,
 * detail with `Zgłaszający`) arrive with Phase 4.
 */

export type IssueListItem = {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
};

export type IssueFeedEvent = {
  id: string;
  kind: EventPayload["kind"];
  payload: EventPayload;
  actor: { id: string; name: string };
  createdAt: string;
};

export type IssueAttachmentSummary = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type IssueDetailForReporter = {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  attachments: IssueAttachmentSummary[];
  events: IssueFeedEvent[];
};

// ---------------------------------------------------------------------------
// Row shapes we accept as input. Keeping them as narrow, structural types
// means mappers work equally well with `db.query.*` results and with
// hand-built objects in unit tests.
// ---------------------------------------------------------------------------

type IssueRow = {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  createdAt: Date;
  updatedAt: Date;
};

type IssueAttachmentRow = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

type IssueEventRow = {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: Date;
  actor: { id: string; name: string } | null;
};

type IssueRowWithChildren = IssueRow & {
  attachments: IssueAttachmentRow[];
  events: IssueEventRow[];
};

/**
 * Reporter list card. Includes attachment count so the list can hint at
 * screenshots without opening the detail page. Also used later as the
 * base for the admin's list row + board card (Phase 4).
 */
export function toReporterListItem(
  row: IssueRow & { attachmentCount: number },
): IssueListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachmentCount: row.attachmentCount,
  };
}

/**
 * Reporter detail. Excludes `reporterId` (redundant — the reporter is the
 * viewer here) and any admin-only field (`Zgłaszający`, added by
 * `toIssueDetailForAdmin` in Phase 4).
 */
export function toIssueDetailForReporter(
  row: IssueRowWithChildren,
): IssueDetailForReporter {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    events: row.events.map(toFeedEvent),
  };
}

function toFeedEvent(row: IssueEventRow): IssueFeedEvent {
  // Actor is nullable in the join type only because the LEFT JOIN column
  // is nullable at the type level; in practice the FK guarantees a row.
  const actor = row.actor ?? { id: "unknown", name: "—" };
  return {
    id: row.id,
    kind: row.kind as EventPayload["kind"],
    payload: row.payload as EventPayload,
    actor,
    createdAt: row.createdAt.toISOString(),
  };
}
