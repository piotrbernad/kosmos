import { cookies } from "next/headers";
import { listAllIssues } from "@/lib/dal";
import { QueueClient } from "./_components/QueueClient";
import { QUEUE_VIEW_COOKIE, type QueueView } from "./_components/queueView";

export default async function AdminQueuePage() {
  const cookieStore = await cookies();
  const issues = await listAllIssues();

  const cookieValue = cookieStore.get(QUEUE_VIEW_COOKIE)?.value;
  const initialView: QueueView = cookieValue === "lista" ? "lista" : "tablica";

  return (
    <section className="stack-lg">
      <div>
        <h1>Wszystkie zgłoszenia</h1>
        <p className="muted" data-testid="admin-queue-subtitle">
          Zgłoszenia od wszystkich użytkowników · {countLabel(issues.length)}
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="card empty" data-testid="admin-empty">
          <p>Brak zgłoszeń w systemie.</p>
        </div>
      ) : (
        <QueueClient issues={issues} initialView={initialView} />
      )}
    </section>
  );
}

function countLabel(n: number): string {
  if (n === 0) return "brak zgłoszeń";
  if (n === 1) return "1 zgłoszenie";
  // Polish plural: 2-4 → "zgłoszenia", 5+ → "zgłoszeń" (with the 12-14 exception).
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${n} zgłoszenia`;
  }
  return `${n} zgłoszeń`;
}
