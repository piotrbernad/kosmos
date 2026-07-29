import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyIssue } from "@/lib/dal";
import { IssueIdSchema } from "@/lib/issues/validators";
import { EditIssueForm } from "./EditIssueForm";

/**
 * Reporter's edit form. Locked once the issue is `rozwiazane` — we
 * `notFound()` in that case so a bookmarked URL indistinguishably 404s.
 * The DAL already applies the ownership predicate, so a wrong-owner /
 * non-existent id also 404s.
 */
export default async function EditIssuePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const parsed = IssueIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const issue = await getMyIssue(parsed.data);

  // Terminal-state lock: no editing after resolution.
  if (issue.status === "rozwiazane") notFound();

  return (
    <section className="stack-lg">
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/zgloszenia/${issue.id}`}>← Wróć do zgłoszenia</Link>
        </p>
        <h1 style={{ marginTop: 8 }}>Edytuj zgłoszenie</h1>
        <p className="muted">
          Popraw tytuł, opis lub zestaw załączników. Zmiany pojawią się
          w historii zgłoszenia.
        </p>
      </div>
      <div className="card">
        <EditIssueForm
          id={issue.id}
          initialTitle={issue.title}
          initialDescription={issue.description}
          expectedUpdatedAt={issue.updatedAt}
          existingAttachments={issue.attachments}
        />
      </div>
    </section>
  );
}
