import type { BoardCard } from "@/lib/issues/dto";
import type { IssueStatus } from "@/lib/db/schema";

/**
 * Pure state transitions for the optimistic-issues hook. Extracted so
 * they can be unit-tested without React or a DOM environment.
 *
 * Invariants:
 *   • `applyOptimistic` never mutates the input map.
 *   • `commitOptimistic` replaces the entry with the server-truth
 *     updatedAt token (so the next action carries a fresh token).
 *   • `revertOptimistic` returns a map with the entry dropped — the
 *     server row wins on the next render.
 *   • Transitions to `rozwiazane` are refused here: resolution is
 *     Phase 5's job and always goes through the resolution dialog,
 *     never through this reducer.
 */

export type OverrideMap = Record<string, BoardCard>;

export function applyOptimistic(
  overrides: OverrideMap,
  base: BoardCard,
  to: Exclude<IssueStatus, "rozwiazane">,
): OverrideMap {
  if (base.status === "rozwiazane") return overrides;
  if (base.status === to) return overrides;
  return { ...overrides, [base.id]: { ...base, status: to } };
}

export function commitOptimistic(
  overrides: OverrideMap,
  id: string,
  serverUpdatedAt: string,
): OverrideMap {
  const existing = overrides[id];
  if (!existing) return overrides;
  return {
    ...overrides,
    [id]: { ...existing, updatedAt: serverUpdatedAt },
  };
}

export function revertOptimistic(overrides: OverrideMap, id: string): OverrideMap {
  if (!(id in overrides)) return overrides;
  const next = { ...overrides };
  delete next[id];
  return next;
}
