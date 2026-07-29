"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Stub provider for the resolution dialog. Phase 4 wires the *plumbing*
 * — every "Rozwiąż" button on the board / list / detail page goes
 * through `openResolutionDialog(id, updatedAt)` — but there is no
 * dialog UI yet. The actual RHF+Zod form and the `resolveIssue`
 * server-action call land in Phase 5.
 *
 * Keeping the provider here (rather than inlining a `no-op` on the
 * buttons) means Phase 5 only has to swap the body — the call sites
 * already know how to trigger it.
 */
export type ResolutionDialogContextValue = {
  open: (id: string, expectedUpdatedAt: string) => void;
  /** Whether a target has been armed — used by Phase 5's dialog. */
  target: { id: string; expectedUpdatedAt: string } | null;
  close: () => void;
};

const Ctx = createContext<ResolutionDialogContextValue | null>(null);

export function ResolutionDialogProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<{ id: string; expectedUpdatedAt: string } | null>(
    null,
  );

  const open = useCallback((id: string, expectedUpdatedAt: string) => {
    setTarget({ id, expectedUpdatedAt });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return (
    <Ctx.Provider value={{ open, target, close }}>
      {children}
      {/* Phase 5 renders <ResolutionDialog /> here. */}
    </Ctx.Provider>
  );
}

export function useResolutionDialog(): ResolutionDialogContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fail loudly rather than silently — if a button ends up outside
    // the provider we want that visible in dev.
    throw new Error(
      "useResolutionDialog must be used within <ResolutionDialogProvider>",
    );
  }
  return ctx;
}
