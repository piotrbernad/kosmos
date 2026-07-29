"use client";

import { useState } from "react";
import type { BoardCard } from "@/lib/issues/dto";
import { Board } from "./Board";
import { Lista } from "./Lista";
import { ResolutionDialogProvider } from "./ResolutionDialogProvider";
import { setQueueView } from "./setQueueView";
import type { QueueView } from "./queueView";
import { useOptimisticIssues } from "./useOptimisticIssues";

/**
 * Top-level client wrapper for the admin queue. Owns the view switcher
 * and the optimistic-issues hook, and mounts the `ResolutionDialogProvider`
 * so buttons in both views share one dialog target (Phase 5 wires the
 * dialog body itself).
 */
export function QueueClient({
  issues,
  initialView,
}: {
  issues: BoardCard[];
  initialView: QueueView;
}) {
  const [view, setView] = useState<QueueView>(initialView);
  const { byStatus, advance, isPending } = useOptimisticIssues(issues);

  const switchView = (next: QueueView) => {
    if (next === view) return;
    setView(next);
    // Fire-and-forget cookie write — a failure only affects the next
    // reload's default and there is no user-facing error to surface.
    void setQueueView(next);
  };

  return (
    <ResolutionDialogProvider>
      <div
        className="queue-switch"
        role="tablist"
        aria-label="Widok kolejki"
        data-testid="queue-view-switcher"
      >
        <ViewTab active={view === "tablica"} onClick={() => switchView("tablica")}>
          Tablica
        </ViewTab>
        <ViewTab active={view === "lista"} onClick={() => switchView("lista")}>
          Lista
        </ViewTab>
      </div>

      {view === "tablica" ? (
        <Board byStatus={byStatus} advance={advance} isPending={isPending} />
      ) : (
        <Lista
          issues={byStatus("nowe")
            .concat(byStatus("w_trakcie"))
            .concat(byStatus("rozwiazane"))}
          advance={advance}
          isPending={isPending}
        />
      )}
    </ResolutionDialogProvider>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      type="button"
      onClick={onClick}
      data-testid={`view-tab-${active ? "active" : "inactive"}`}
    >
      {children}
    </button>
  );
}
