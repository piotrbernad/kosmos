import type { IssueStatus } from "@/lib/db/schema";

const LABELS: Record<IssueStatus, string> = {
  nowe: "Nowe",
  w_trakcie: "W trakcie",
  rozwiazane: "Rozwiązane",
};

const STYLES: Record<IssueStatus, React.CSSProperties> = {
  nowe: { background: "#e0f2fe", color: "#075985", borderColor: "#bae6fd" },
  w_trakcie: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" },
  rozwiazane: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span
      className="badge"
      data-testid={`status-${status}`}
      data-status={status}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid",
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...STYLES[status],
      }}
    >
      {LABELS[status]}
    </span>
  );
}
