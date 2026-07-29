"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ResolutionDialog } from "./ResolutionDialog";

/**
 * Context + provider for the shared resolution dialog. Every "Rozwiąż"
 * button — board card, list row, admin detail page — calls
 * `openResolutionDialog(id, expectedUpdatedAt)`, which arms the dialog.
 * The dialog itself renders inside the provider so board and list share
 * one instance, and cancelling never mutates the underlying card.
 */
export type ResolutionDialogContextValue = {
  open: (id: string, expectedUpdatedAt: string) => void;
  /** Whether a target has been armed — used by the dialog. */
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
      <ResolutionDialog />
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
