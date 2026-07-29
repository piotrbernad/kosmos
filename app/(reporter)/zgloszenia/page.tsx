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
        <div className="card empty" data-testid="empty-issues">
          <p>Nie masz jeszcze żadnych zgłoszeń.</p>
          <p className="muted">
            Kliknij <strong>Nowe zgłoszenie</strong>, żeby zgłosić problem.
          </p>
        </div>
      ) : (
        <ul className="stack" data-testid="issue-list" style={{ listStyle: "none", padding: 0 }}>
          {issues.map((i) => (
            <li key={i.id}>
              <Link
                href={`/zgloszenia/${i.id}`}
                className="card issue-card"
                data-testid={`issue-row-${i.id}`}
                style={{ display: "block", textDecoration: "none" }}
              >
                <div className="row-between" style={{ alignItems: "flex-start", gap: 16 }}>
                  <div className="stack" style={{ gap: 6 }}>
                    <h2 style={{ margin: 0 }}>{i.title}</h2>
                    <p className="muted" style={{ margin: 0 }}>
                      Utworzono {formatDateTime(i.createdAt)}
                      {i.attachmentCount > 0
                        ? ` · ${i.attachmentCount} załącznik${
                            i.attachmentCount === 1 ? "" : "i"
                          }`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={i.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
