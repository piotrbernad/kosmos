import Link from "next/link";
import { CreateIssueForm } from "./CreateIssueForm";

export default function NewIssuePage() {
  return (
    <section className="stack-lg">
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/zgloszenia">← Wróć do listy</Link>
        </p>
        <h1 style={{ marginTop: 8 }}>Nowe zgłoszenie</h1>
        <p className="muted">
          Opisz problem możliwie krótko i konkretnie. Dodaj zrzuty ekranu,
          jeśli pomogą zrozumieć, co się stało.
        </p>
      </div>
      <div className="card">
        <CreateIssueForm />
      </div>
    </section>
  );
}
