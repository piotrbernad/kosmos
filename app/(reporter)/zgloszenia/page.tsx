import Link from "next/link";
import { listMyIssues } from "@/lib/dal";
import { StatusBadge } from "./_components/StatusBadge";
import { formatDateTime } from "./_components/formatDateTime";

export default async function ReporterIssuesPage() {
  const issues = await listMyIssues();

  return (
    <section className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Moje zgłoszenia</h1>
          <p className="muted">
            Zgłoszenia, które utworzyłeś. Nowe pojawiają się na górze listy.
          </p>
        </div>
        <Link href="/zgloszenia/nowe" className="btn btn-primary">
          Nowe zgłoszenie
        </Link>
      </div>

      {issues.length === 0 ? (
        <div className="empty" data-testid="empty-issues">
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>
            Brak zgłoszeń
          </div>
          <p className="muted" style={{ margin: "10px 0 24px" }}>
            Nie masz jeszcze żadnych zgłoszeń. Opisz problem — odpowiemy w
            panelu.
          </p>
          <Link href="/zgloszenia/nowe" className="btn btn-primary">
            Utwórz pierwsze zgłoszenie
          </Link>
        </div>
      ) : (
        <ul
          className="stack"
          data-testid="issue-list"
          style={{ listStyle: "none", padding: 0, gap: 14 }}
        >
          {issues.map((i) => (
            <li key={i.id}>
              <Link
                href={`/zgloszenia/${i.id}`}
                className="issue-card"
                data-testid={`issue-row-${i.id}`}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{i.title}</div>
                  <div className="meta">
                    Utworzono {formatDateTime(i.createdAt)}
                    {i.attachmentCount > 0
                      ? ` · ${i.attachmentCount} załącznik${
                          i.attachmentCount === 1 ? "" : "i"
                        }`
                      : ""}
                  </div>
                </div>
                <StatusBadge status={i.status} />
                <span className="issue-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
