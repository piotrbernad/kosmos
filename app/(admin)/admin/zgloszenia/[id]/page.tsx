import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnyIssue } from "@/lib/dal";
import { IssueIdSchema } from "@/lib/issues/validators";
import { IssueFeed } from "@/app/(reporter)/zgloszenia/_components/IssueFeed";
import { Screenshots } from "@/app/(reporter)/zgloszenia/_components/Screenshots";
import { formatDateTime } from "@/app/(reporter)/zgloszenia/_components/formatDateTime";
import { CommentComposer } from "@/app/(reporter)/zgloszenia/_components/CommentComposer";
import { StatusBadge } from "@/app/(reporter)/zgloszenia/_components/StatusBadge";
import { StatusPicker } from "../_components/StatusPicker";
import { ResolutionDialogProvider } from "../_components/ResolutionDialogProvider";

/**
 * Admin's copy of the issue detail. Same layout as the reporter's page
 * plus:
 *   • the status badge is a `<StatusPicker>` (so triage never requires a
 *     round-trip to the queue),
 *   • a `Zgłaszający` row surfaces who reported it,
 *   • the comment composer is present regardless of who owns the issue.
 *
 * Attachments and the feed are the same components as the reporter side.
 */
export default async function AdminIssueDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const parsed = IssueIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const issue = await getAnyIssue(parsed.data);
  const isResolved = issue.status === "rozwiazane";

  return (
    <ResolutionDialogProvider>
      <article className="stack-lg" data-testid="admin-issue-detail">
        <div className="stack" style={{ gap: 4 }}>
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/admin/zgloszenia">← Wróć do kolejki</Link>
          </p>
          <div className="row-between" style={{ alignItems: "flex-start", gap: 16 }}>
            <div className="stack" style={{ gap: 6 }}>
              <h1 style={{ margin: 0 }} data-testid="issue-title">
                {issue.title}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Utworzono {formatDateTime(issue.createdAt)}
              </p>
              <p className="muted" style={{ margin: 0 }} data-testid="issue-reporter">
                <strong style={{ fontWeight: 500 }}>Zgłaszający:</strong>{" "}
                {issue.reporter.name}{" "}
                <span style={{ opacity: 0.6 }}>({issue.reporter.email})</span>
              </p>
            </div>
            {isResolved ? (
              <span data-testid="status-terminal-badge">
                <StatusBadge status={issue.status} />
              </span>
            ) : (
              <StatusPicker
                issueId={issue.id}
                status={issue.status}
                expectedUpdatedAt={issue.updatedAt}
              />
            )}
          </div>
        </div>

        <section className="card stack" data-testid="issue-description">
          <h2 style={{ marginTop: 0 }}>Opis</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{issue.description}</p>
        </section>

        <Screenshots attachments={issue.attachments} />

        <section className="stack">
          <h2>Aktywność</h2>
          <IssueFeed events={issue.events} />
        </section>

        <section className="card stack" data-testid="composer-section">
          {isResolved ? (
            <p className="muted" data-testid="discussion-closed" style={{ margin: 0 }}>
              Dyskusja zakończona.
            </p>
          ) : (
            <CommentComposer issueId={issue.id} />
          )}
        </section>
      </article>
    </ResolutionDialogProvider>
  );
}
