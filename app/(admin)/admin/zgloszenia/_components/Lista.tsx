"use client";

import Link from "next/link";
import type { BoardCard } from "@/lib/issues/dto";
import type { IssueStatus } from "@/lib/db/schema";
import { StatusBadge } from "@/app/(reporter)/zgloszenia/_components/StatusBadge";
import { formatDateTime } from "@/app/(reporter)/zgloszenia/_components/formatDateTime";
import { useResolutionDialog } from "./ResolutionDialogProvider";

/**
 * Table view. Same actions as the board's cards, in a compact actions
 * column. Rows for `rozwiazane` render a plain badge — no per-row
 * picker — since that state is terminal (Phase 5's affordance is a
 * dialog, not a re-open path).
 */
export function Lista({
  issues,
  advance,
  isPending,
}: {
  issues: BoardCard[];
  advance: (
    id: string,
    expectedUpdatedAt: string,
    to: Exclude<IssueStatus, "rozwiazane">,
  ) => Promise<void>;
  isPending: (id: string) => boolean;
}) {
  if (issues.length === 0) {
    return (
      <div className="empty" data-testid="lista-empty">
        <p className="muted" style={{ margin: 0 }}>
          Brak zgłoszeń
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "8px 8px 12px" }}>
      <table
        data-testid="admin-lista"
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <thead>
          <tr>
            <Th style={{ width: "30%" }}>Zgłoszenie</Th>
            <Th style={{ width: "15%" }}>Zgłaszający</Th>
            <Th style={{ width: "13%" }}>Status</Th>
            <Th style={{ width: "15%" }}>Utworzono</Th>
            <Th style={{ width: "8%" }}>Zał.</Th>
            <Th style={{ width: "19%", textAlign: "right" }}>Akcje</Th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <Row key={i.id} card={i} advance={advance} isPending={isPending(i.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        padding: "16px 18px",
        textAlign: "left",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--muted)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Row({
  card,
  advance,
  isPending,
}: {
  card: BoardCard;
  advance: (
    id: string,
    expectedUpdatedAt: string,
    to: Exclude<IssueStatus, "rozwiazane">,
  ) => Promise<void>;
  isPending: boolean;
}) {
  const resolveDialog = useResolutionDialog();
  const isResolved = card.status === "rozwiazane";

  return (
    <tr
      data-testid={`lista-row-${card.id}`}
      data-status={card.status}
      style={{ opacity: isPending ? 0.7 : 1 }}
    >
      <Td style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
        <Link
          href={`/admin/zgloszenia/${card.id}`}
          data-testid={`lista-row-${card.id}-title`}
          style={{ color: "inherit" }}
        >
          {card.title}
        </Link>
      </Td>
      <Td style={{ color: "var(--body)" }}>{card.reporter.name}</Td>
      <Td>
        <StatusBadge status={card.status} />
      </Td>
      <Td style={{ color: "var(--muted)" }}>{formatDateTime(card.createdAt)}</Td>
      <Td style={{ color: "var(--muted)" }}>{card.attachmentCount || "—"}</Td>
      <Td style={{ textAlign: "right" }}>
        {!isResolved ? (
          <div
            className="row"
            style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}
          >
            {card.status === "nowe" && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid={`lista-row-${card.id}-start`}
                disabled={isPending}
                onClick={() => advance(card.id, card.updatedAt, "w_trakcie")}
              >
                Rozpocznij →
              </button>
            )}
            {card.status === "w_trakcie" && (
              <button
                type="button"
                className="btn btn-sm"
                data-testid={`lista-row-${card.id}-back`}
                disabled={isPending}
                onClick={() => advance(card.id, card.updatedAt, "nowe")}
              >
                Cofnij
              </button>
            )}
            <button
              type="button"
              className="btn btn-success btn-sm"
              data-testid={`lista-row-${card.id}-resolve`}
              disabled={isPending}
              onClick={() => resolveDialog.open(card.id, card.updatedAt)}
            >
              Rozwiąż
            </button>
          </div>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>—</span>
        )}
      </Td>
    </tr>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "14px 18px",
        borderTop: "1.5px solid var(--border-3)",
        fontSize: 14,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
