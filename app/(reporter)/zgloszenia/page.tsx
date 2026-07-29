import Link from "next/link";

export default function ReporterIssuesPage() {
  // Real list arrives in Phase 2. Phase 1 only proves the plumbing works.
  return (
    <section className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Moje zgłoszenia</h1>
          <p className="muted">Tu pojawią się zgłoszenia, które utworzysz.</p>
        </div>
        <Link href="/zgloszenia/nowe" className="btn btn-primary">
          Nowe zgłoszenie
        </Link>
      </div>
      <div className="card empty" data-testid="empty-issues">
        <p>Nie masz jeszcze żadnych zgłoszeń.</p>
        <p className="muted">
          Kliknij <strong>Nowe zgłoszenie</strong>, żeby zgłosić problem.
        </p>
      </div>
    </section>
  );
}
