import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyIssue } from "@/lib/dal";
import { IssueIdSchema } from "@/lib/issues/validators";
import { StatusBadge } from "../_components/StatusBadge";
import { IssueFeed } from "../_components/IssueFeed";
import { Screenshots } from "../_components/Screenshots";
import { formatDateTime } from "../_components/formatDateTime";

export default async function ReporterIssueDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // Reject garbage ids at the boundary. Without this a random `/zgloszenia/foo`
  // would blow up inside the DB driver instead of rendering the app's 404.
  const parsed = IssueIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const issue = await getMyIssue(parsed.data);

  return (
    <article className="stack-lg" data-testid="issue-detail">
      <div className="stack" style={{ gap: 4 }}>
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/zgloszenia">← Wróć do listy</Link>
        </p>
        <div className="row-between" style={{ alignItems: "flex-start", gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ margin: 0 }} data-testid="issue-title">
              {issue.title}
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Utworzono {formatDateTime(issue.createdAt)}
            </p>
          </div>
          <StatusBadge status={issue.status} />
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
    </article>
  );
}
