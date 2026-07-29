import type { IssueFeedEvent } from "@/lib/issues/dto";
import type { IssueStatus } from "@/lib/db/schema";
import { formatDateTime } from "./formatDateTime";

/**
 * Shared feed renderer used by both the reporter and admin detail pages.
 * Phase 2 only handles `status_change` (the seed row created on issue
 * creation). Comments arrive in Phase 4 and resolution in Phase 5 — those
 * kinds get their own branches below rather than a generic renderer, because
 * each has its own copy in Polish and its own visual weight.
 */
export function IssueFeed({ events }: { events: IssueFeedEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="muted" data-testid="feed-empty">
        Brak aktywności.
      </p>
    );
  }

  return (
    <ol
      className="stack"
      data-testid="issue-feed"
      style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}
    >
      {events.map((e) => (
        <li key={e.id} data-testid={`feed-event-${e.kind}`}>
          <FeedEntry event={e} />
        </li>
      ))}
    </ol>
  );
}

function FeedEntry({ event }: { event: IssueFeedEvent }) {
  const metaText = `${event.actor.name} · ${formatDateTime(event.createdAt)}`;

  switch (event.payload.kind) {
    case "status_change": {
      // Self-transition on creation (from === to === 'nowe') means
      // "issue was filed". Any other pair is a real move. Both render as a
      // lightweight inline "system" row rather than a full card.
      const { from, to } = event.payload;
      const isSeed = from === to;
      const text = isSeed
        ? "Utworzono zgłoszenie"
        : `Zmieniono status: ${statusLabel(from)} → ${statusLabel(to)}`;
      return (
        <div className="feed-system">
          <span className="dot" aria-hidden="true" />
          <div className="feed-meta">
            {text} · {metaText}
          </div>
        </div>
      );
    }
    case "comment":
      return (
        <div className="feed-item">
          <div className="feed-body" style={{ whiteSpace: "pre-wrap" }}>
            {event.payload.body}
          </div>
          <div className="feed-meta">{metaText}</div>
        </div>
      );
    case "edit":
      return (
        <div className="feed-system">
          <span className="dot" aria-hidden="true" />
          <div className="feed-meta">
            Zaktualizowano zgłoszenie (
            {event.payload.fields.map(fieldLabel).join(", ")}) · {metaText}
          </div>
        </div>
      );
    case "resolution":
      return (
        <div className="feed-resolution">
          <div className="feed-label">Rozwiązanie</div>
          <div className="feed-body" style={{ whiteSpace: "pre-wrap" }}>
            {event.payload.body}
          </div>
          <div className="feed-meta">{metaText}</div>
        </div>
      );
  }
}

function statusLabel(status: IssueStatus): string {
  switch (status) {
    case "nowe":
      return "Nowe";
    case "w_trakcie":
      return "W trakcie";
    case "rozwiazane":
      return "Rozwiązane";
  }
}

function fieldLabel(field: "title" | "description" | "attachments"): string {
  switch (field) {
    case "title":
      return "tytuł";
    case "description":
      return "opis";
    case "attachments":
      return "załączniki";
  }
}
