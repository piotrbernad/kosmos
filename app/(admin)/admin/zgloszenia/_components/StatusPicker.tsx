"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IssueStatus } from "@/lib/db/schema";
import { changeIssueStatus } from "@/lib/issues/actions";
import { useResolutionDialog } from "./ResolutionDialogProvider";

const OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "nowe", label: "Nowe" },
  { value: "w_trakcie", label: "W trakcie" },
  { value: "rozwiazane", label: "Rozwiązane" },
];

/**
 * Admin's status control on the detail page. Same rules as the board
 * buttons: `rozwiazane` routes through the resolution dialog (stubbed
 * in Phase 4, wired to a real form in Phase 5); non-resolving transitions
 * fire `changeIssueStatus` directly.
 */
export function StatusPicker({
  issueId,
  status,
  expectedUpdatedAt,
}: {
  issueId: string;
  status: IssueStatus;
  expectedUpdatedAt: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dialog = useResolutionDialog();

  if (status === "rozwiazane") {
    // Terminal — no picker at all, per PRD.
    return null;
  }

  const change = (to: IssueStatus) => {
    if (to === status) return;
    if (to === "rozwiazane") {
      // Route through the resolution dialog. Cancel is a plain state
      // clear on the dialog, so the picker's `value` stays on `status`
      // (React controlled select) — nothing to revert here.
      dialog.open(issueId, expectedUpdatedAt);
      return;
    }
    startTransition(async () => {
      const result = await changeIssueStatus({
        id: issueId,
        to,
        expectedUpdatedAt,
      });
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(
          result.reason === "conflict"
            ? "Ktoś już zmienił status tego zgłoszenia. Widok został odświeżony."
            : "Nie udało się zmienić statusu.",
        );
        router.refresh();
      }
    });
  };

  return (
    <div
      style={{ width: 210, flex: "none" }}
      data-testid="status-picker-wrapper"
    >
      <label htmlFor="status-picker" style={{ marginBottom: 8 }}>
        Status
      </label>
      <select
        id="status-picker"
        data-testid="status-picker"
        value={status}
        disabled={pending}
        onChange={(e) => change(e.target.value as IssueStatus)}
        style={{ height: 46, fontWeight: 600, cursor: "pointer" }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
