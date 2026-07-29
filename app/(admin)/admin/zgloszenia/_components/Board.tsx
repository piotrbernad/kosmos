"use client";

import Link from "next/link";
import type { BoardCard } from "@/lib/issues/dto";
import type { IssueStatus } from "@/lib/db/schema";
import { formatDateTime } from "@/app/(reporter)/zgloszenia/_components/formatDateTime";
import { useResolutionDialog } from "./ResolutionDialogProvider";

const COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: "nowe", label: "Nowe" },
  { status: "w_trakcie", label: "W trakcie" },
  { status: "rozwiazane", label: "Rozwiązane" },
];

/**
 * Three-column board keyed on status. Cards carry their own action
 * buttons for non-resolving transitions; resolving is present but
 * disabled and tooltipped, wired up in Phase 5.
 *
 * Drag-and-drop is deliberately not used — see the TDD:
 * "Drag-and-drop is not used. Cards carry two action buttons."
 */
export function Board({
  byStatus,
  advance,
  isPending,
}: {
  byStatus: (s: IssueStatus) => BoardCard[];
  advance: (
    id: string,
    expectedUpdatedAt: string,
    to: Exclude<IssueStatus, "rozwiazane">,
  ) => Promise<void>;
  isPending: (id: string) => boolean;
}) {
  return (
    <div
      className="board"
      data-testid="admin-board"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      {COLUMNS.map(({ status, label }) => {
        const cards = byStatus(status);
        return (
          <section
            key={status}
            className="stack"
            data-testid={`board-column-${status}`}
            style={{
              background: "#f1f5f9",
              borderRadius: 12,
              padding: 12,
              gap: 8,
            }}
          >
            <header
              className="row-between"
              style={{ padding: "4px 6px 8px" }}
              data-testid={`board-column-${status}-head`}
            >
              <strong style={{ fontSize: 14 }}>{label}</strong>
              <span
                className="muted"
                data-testid={`board-column-${status}-count`}
                style={{ fontSize: 12, background: "#fff", padding: "1px 8px", borderRadius: 999 }}
              >
                {cards.length}
              </span>
            </header>
            <div className="stack" style={{ gap: 8 }}>
              {cards.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, padding: "8px 6px" }}>
                  Brak zgłoszeń.
                </p>
              ) : (
                cards.map((c) => (
                  <IssueCard
                    key={c.id}
                    card={c}
                    advance={advance}
                    isPending={isPending(c.id)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IssueCard({
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
    <article
      className="card"
      data-testid={`board-card-${card.id}`}
      data-status={card.status}
      style={{
        padding: 12,
        background: "#fff",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <div className="stack" style={{ gap: 8 }}>
        <Link
          href={`/admin/zgloszenia/${card.id}`}
          data-testid={`board-card-${card.id}-title`}
          style={{ textDecoration: "none", color: "inherit", fontWeight: 500 }}
        >
          {card.title}
        </Link>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {card.reporter.name}
          {card.attachmentCount > 0 ? ` · ${card.attachmentCount} załącznik${card.attachmentCount === 1 ? "" : "i"}` : ""}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {formatDateTime(card.createdAt)}
        </p>

        {!isResolved && (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {card.status === "nowe" && (
              <button
                type="button"
                className="btn"
                data-testid={`board-card-${card.id}-start`}
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
                data-testid={`board-card-${card.id}-back`}
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
              data-testid={`board-card-${card.id}-resolve`}
              // Enabled in Phase 5; kept present with an explanatory title now.
              disabled
              title="Rozwiązanie wymaga wpisania krótkiego wyjaśnienia — dostępne wkrótce."
              onClick={() => resolveDialog.open(card.id, card.updatedAt)}
              style={{ padding: "4px 10px", fontSize: 13 }}
            >
              Rozwiąż
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
