"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BoardCard } from "@/lib/issues/dto";
import type { IssueStatus } from "@/lib/db/schema";
import { changeIssueStatus } from "@/lib/issues/actions";
import {
  applyOptimistic,
  commitOptimistic,
  revertOptimistic,
} from "./optimisticReducer";

/**
 * Shared optimistic state for the admin queue. Both Board and Lista get
 * their card list from `byStatus(status)` here — same source, same
 * predicates, so a status change on the board is instantly reflected on
 * the list after the user flicks the view switcher.
 *
 * `advance(id, expectedUpdatedAt, to)` applies the transition locally
 * before the round-trip and reverts on failure. `to` is typed
 * `'nowe' | 'w_trakcie'` — resolution is not this hook's job (Phase 5).
 */
export type OptimisticIssue = BoardCard;

type PendingMap = Record<string, boolean>;

export function useOptimisticIssues(serverIssues: BoardCard[]) {
  const router = useRouter();
  const [override, setOverride] = useState<Record<string, BoardCard>>({});
  const [pending, setPending] = useState<PendingMap>({});
  const [, startTransition] = useTransition();

  const merged = useMemo<BoardCard[]>(() => {
    return serverIssues.map((i) => override[i.id] ?? i);
  }, [serverIssues, override]);

  const byStatus = useCallback(
    (status: IssueStatus) => merged.filter((i) => i.status === status),
    [merged],
  );

  const advance = useCallback(
    async (
      id: string,
      expectedUpdatedAt: string,
      to: Exclude<IssueStatus, "rozwiazane">,
    ): Promise<void> => {
      const existing = merged.find((i) => i.id === id);
      if (!existing) return;
      if (existing.status === to) return;
      if (existing.status === "rozwiazane") return;

      // Optimistic apply.
      setOverride((prev) => applyOptimistic(prev, existing, to));
      setPending((prev) => ({ ...prev, [id]: true }));

      try {
        const result = await changeIssueStatus({
          id,
          to,
          expectedUpdatedAt,
        });

        if (result.ok) {
          setOverride((prev) => commitOptimistic(prev, id, result.updatedAt));
          startTransition(() => {
            router.refresh();
          });
        } else {
          setOverride((prev) => revertOptimistic(prev, id));
          toast.error(reasonToPl(result.reason));
          startTransition(() => {
            router.refresh();
          });
        }
      } catch (err) {
        setOverride((prev) => revertOptimistic(prev, id));
        toast.error("Nie udało się zapisać zmiany statusu.");
        if (process.env.NODE_ENV !== "production") console.error(err);
      } finally {
        setPending((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [merged, router],
  );

  return {
    issues: merged,
    byStatus,
    advance,
    isPending: (id: string) => Boolean(pending[id]),
  };
}

function reasonToPl(reason: "conflict" | "gone" | "invalid"): string {
  switch (reason) {
    case "conflict":
      return "Ktoś już zmienił status tego zgłoszenia. Widok został odświeżony.";
    case "gone":
      return "Zgłoszenie zostało usunięte.";
    case "invalid":
      return "Nieprawidłowe dane.";
  }
}
