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
      style={{ listStyle: "none", padding: 0, margin: 0 }}
    >
      {events.map((e) => (
        <li key={e.id} data-testid={`feed-event-${e.kind}`} className="card" style={{ padding: 12 }}>
          <FeedEntry event={e} />
        </li>
      ))}
    </ol>
  );
}

function FeedEntry({ event }: { event: IssueFeedEvent }) {
  const meta = (
    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
      {event.actor.name} · {formatDateTime(event.createdAt)}
    </p>
  );

  switch (event.payload.kind) {
    case "status_change": {
      // Self-transition on creation (from === to === 'nowe') means
      // "issue was filed". Any other pair is a real move.
      const { from, to } = event.payload;
      const isSeed = from === to;
      return (
        <div className="stack" style={{ gap: 4 }}>
          <p style={{ margin: 0 }}>
            {isSeed
              ? "Utworzono zgłoszenie."
              : `Zmieniono status: ${statusLabel(from)} → ${statusLabel(to)}.`}
          </p>
          {meta}
        </div>
      );
    }
    case "comment":
      return (
        <div className="stack" style={{ gap: 6 }}>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{event.payload.body}</p>
          {meta}
        </div>
      );
    case "edit":
      return (
        <div className="stack" style={{ gap: 4 }}>
          <p style={{ margin: 0 }}>
            Zaktualizowano zgłoszenie ({event.payload.fields.map(fieldLabel).join(", ")}).
          </p>
          {meta}
        </div>
      );
    case "resolution":
      return (
        <div className="stack" style={{ gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Rozwiązanie</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{event.payload.body}</p>
          {meta}
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
