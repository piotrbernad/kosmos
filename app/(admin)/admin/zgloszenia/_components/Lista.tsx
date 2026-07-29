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
      <div className="card empty" data-testid="lista-empty">
        <p>Brak zgłoszeń.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table
        data-testid="admin-lista"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ background: "#f8fafc", textAlign: "left" }}>
            <Th>Zgłoszenie</Th>
            <Th>Zgłaszający</Th>
            <Th>Status</Th>
            <Th>Utworzono</Th>
            <Th>Załączniki</Th>
            <Th style={{ textAlign: "right" }}>Akcje</Th>
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
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: "#64748b",
        borderBottom: "1px solid #e2e8f0",
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
      <Td>
        <Link
          href={`/admin/zgloszenia/${card.id}`}
          data-testid={`lista-row-${card.id}-title`}
          style={{ textDecoration: "none", color: "inherit", fontWeight: 500 }}
        >
          {card.title}
        </Link>
      </Td>
      <Td>{card.reporter.name}</Td>
      <Td>
        <StatusBadge status={card.status} />
      </Td>
      <Td>{formatDateTime(card.createdAt)}</Td>
      <Td>{card.attachmentCount || "—"}</Td>
      <Td style={{ textAlign: "right" }}>
        {!isResolved ? (
          <div
            className="row"
            style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}
          >
            {card.status === "nowe" && (
              <button
                type="button"
                className="btn"
                data-testid={`lista-row-${card.id}-start`}
                disabled={isPending}
                onClick={() => advance(card.id, card.updatedAt, "w_trakcie")}
                style={{ padding: "4px 10px", fontSize: 13 }}
              >
                Rozpocznij →
              </button>
            )}
            {card.status === "w_trakcie" && (
              <button
                type="button"
                className="btn"
                data-testid={`lista-row-${card.id}-back`}
                disabled={isPending}
                onClick={() => advance(card.id, card.updatedAt, "nowe")}
                style={{ padding: "4px 10px", fontSize: 13 }}
              >
                Cofnij do „Nowe”
              </button>
            )}
            <button
              type="button"
              className="btn"
              data-testid={`lista-row-${card.id}-resolve`}
              disabled={isPending}
              onClick={() => resolveDialog.open(card.id, card.updatedAt)}
              style={{ padding: "4px 10px", fontSize: 13 }}
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
        padding: "10px 12px",
        borderBottom: "1px solid #f1f5f9",
        fontSize: 14,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
