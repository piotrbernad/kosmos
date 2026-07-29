import type { IssueStatus } from "@/lib/db/schema";

const LABELS: Record<IssueStatus, string> = {
  nowe: "Nowe",
  w_trakcie: "W trakcie",
  rozwiazane: "Rozwiązane",
};

/**
 * Status pill. Colors are driven by `.badge[data-status=…]` in globals.css so
 * the whole app shares one source of truth for the status palette.
 */
export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className="badge" data-testid={`status-${status}`} data-status={status}>
      {LABELS[status]}
    </span>
  );
}
