"use client";

import { useState } from "react";
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
 * Cap on the number of resolved cards rendered up front in the board's
 * `Rozwiązane` column. Anything past this is hidden behind
 * "Pokaż pozostałe" so a queue with hundreds of closed issues doesn't
 * blow up the layout. 20 per the outline's open-questions default.
 */
export const RESOLVED_INITIAL_CAP = 20;

/**
 * Three-column board keyed on status. Cards carry their own action
 * buttons for non-resolving transitions; the "Rozwiąż" button always
 * goes through the shared `ResolutionDialogProvider`.
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
    <div className="board" data-testid="admin-board">
      {COLUMNS.map(({ status, label }) => {
        const cards = byStatus(status);
        return (
          <section
            key={status}
            className="board-col"
            data-testid={`board-column-${status}`}
          >
            <header
              className="board-col-head"
              data-testid={`board-column-${status}-head`}
            >
              <span className="col-dot" data-status={status} aria-hidden="true" />
              <span className="col-label">{label}</span>
              <span
                className="col-count"
                data-testid={`board-column-${status}-count`}
              >
                {cards.length}
              </span>
            </header>
            <div className="stack" style={{ gap: 12 }}>
              {cards.length === 0 ? (
                <p className="muted" style={{ fontSize: 14, padding: "8px 6px", color: "var(--faint)" }}>
                  Brak zgłoszeń
                </p>
              ) : status === "rozwiazane" ? (
                <ResolvedColumnBody
                  cards={cards}
                  advance={advance}
                  isPending={isPending}
                />
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

/**
 * Renders the `Rozwiązane` column body with a "show more" affordance
 * once the list grows past `RESOLVED_INITIAL_CAP`. Local state — no
 * URL/cookie persistence — because the queue view already cookies its
 * board/list choice; adding another key here is more surface than the
 * value.
 */
function ResolvedColumnBody({
  cards,
  advance,
  isPending,
}: {
  cards: BoardCard[];
  advance: (
    id: string,
    expectedUpdatedAt: string,
    to: Exclude<IssueStatus, "rozwiazane">,
  ) => Promise<void>;
  isPending: (id: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cap = RESOLVED_INITIAL_CAP;
  const hidden = Math.max(0, cards.length - cap);
  const visible = expanded ? cards : cards.slice(0, cap);

  return (
    <>
      {visible.map((c) => (
        <IssueCard
          key={c.id}
          card={c}
          advance={advance}
          isPending={isPending(c.id)}
        />
      ))}
      {hidden > 0 && !expanded && (
        <button
          type="button"
          className="btn btn-sm"
          data-testid="board-resolved-show-more"
          onClick={() => setExpanded(true)}
        >
          Pokaż pozostałe ({hidden})
        </button>
      )}
    </>
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
      className="board-card"
      data-testid={`board-card-${card.id}`}
      data-status={card.status}
      style={{ opacity: isPending ? 0.7 : 1 }}
    >
      <Link
        href={`/admin/zgloszenia/${card.id}`}
        data-testid={`board-card-${card.id}-title`}
        className="bc-title"
        style={{ display: "block" }}
      >
        {card.title}
      </Link>
      <div className="bc-meta">
        {card.reporter.name}
        {card.attachmentCount > 0
          ? ` · ${card.attachmentCount} załącznik${card.attachmentCount === 1 ? "" : "i"}`
          : ""}{" "}
        · {formatDateTime(card.createdAt)}
      </div>

      {!isResolved && (
        <div className="bc-actions">
          {card.status === "nowe" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid={`board-card-${card.id}-start`}
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
              data-testid={`board-card-${card.id}-back`}
              disabled={isPending}
              onClick={() => advance(card.id, card.updatedAt, "nowe")}
            >
              Cofnij do „Nowe”
            </button>
          )}
          <button
            type="button"
            className={
              card.status === "w_trakcie"
                ? "btn btn-success btn-sm"
                : "btn btn-sm"
            }
            data-testid={`board-card-${card.id}-resolve`}
            disabled={isPending}
            onClick={() => resolveDialog.open(card.id, card.updatedAt)}
          >
            Rozwiąż
          </button>
        </div>
      )}
    </article>
  );
}
