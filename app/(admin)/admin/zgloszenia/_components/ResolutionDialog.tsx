"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ResolveSchema, type ResolveInput } from "@/lib/issues/validators";
import { resolveIssue } from "@/lib/issues/actions";
import { useResolutionDialog } from "./ResolutionDialogProvider";

/**
 * Modal dialog that captures the mandatory resolution body. Fired from
 * the board's "Rozwiąż" button, the list's actions column, and the
 * admin detail page's status picker. Cancel is a plain state clear —
 * the card never moved (per PRD "Cancelling the dialog after clicking
 * [Rozwiąż] leaves the card in its previous column").
 *
 * The dialog is split in two so a `key` prop on the inner body resets
 * form state cleanly on each open — no `useEffect` + `reset` dance
 * that would trip the "setState-in-effect" lint rule.
 */
export function ResolutionDialog() {
  const { target } = useResolutionDialog();
  if (!target) return null;
  return (
    <ResolutionDialogBody
      key={`${target.id}-${target.expectedUpdatedAt}`}
      id={target.id}
      expectedUpdatedAt={target.expectedUpdatedAt}
    />
  );
}

function ResolutionDialogBody({
  id,
  expectedUpdatedAt,
}: {
  id: string;
  expectedUpdatedAt: string;
}) {
  const { close } = useResolutionDialog();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResolveInput>({
    resolver: zodResolver(ResolveSchema),
    defaultValues: { id, body: "", expectedUpdatedAt },
    mode: "onSubmit",
  });

  async function onSubmit(values: ResolveInput) {
    setServerError(null);
    const result = await resolveIssue(values);
    if (result.ok) {
      close();
      router.refresh();
      toast.success("Zgłoszenie oznaczono jako rozwiązane.");
      return;
    }
    switch (result.reason) {
      case "conflict":
        toast.error(
          "Ktoś już zmienił status tego zgłoszenia. Widok został odświeżony.",
        );
        close();
        router.refresh();
        break;
      case "gone":
        toast.error("Zgłoszenie zostało usunięte.");
        close();
        router.refresh();
        break;
      case "invalid":
        setServerError("Sprawdź treść rozwiązania.");
        break;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolution-dialog-title"
      data-testid="resolution-dialog"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 27, 49, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        // Click outside the panel closes the dialog. The panel below
        // stops propagation so clicks inside are ignored.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="card"
        style={{
          background: "var(--surface-2)",
          borderRadius: "var(--r-card-lg)",
          padding: 32,
          maxWidth: 520,
          width: "100%",
          boxShadow: "0 24px 60px rgba(26, 27, 49, 0.25)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form
          className="stack"
          onSubmit={handleSubmit(onSubmit)}
          style={{ gap: 12 }}
          noValidate
        >
          <div className="stack" style={{ gap: 6 }}>
            <h2
              id="resolution-dialog-title"
              style={{ margin: 0, fontSize: 18 }}
            >
              Oznacz jako rozwiązane
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Napisz krótkie wyjaśnienie, co zostało zrobione. To pojawi się
              w historii zgłoszenia jako ostatnia informacja.
            </p>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="resolution-body">Rozwiązanie</label>
            <textarea
              id="resolution-body"
              rows={5}
              maxLength={2000}
              aria-invalid={errors.body ? "true" : "false"}
              data-testid="resolution-body"
              {...register("body")}
            />
            {errors.body && (
              <p className="error" role="alert" data-testid="resolution-body-error">
                {errors.body.message}
              </p>
            )}
            <p className="muted" style={{ fontSize: 12 }}>
              Minimum 10 znaków, maks. 2000.
            </p>
          </div>

          {serverError && (
            <p className="error" role="alert" data-testid="resolution-server-error">
              {serverError}
            </p>
          )}

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={close}
              disabled={isSubmitting}
              data-testid="resolution-cancel"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={isSubmitting}
              data-testid="resolution-submit"
            >
              {isSubmitting ? "Zapisywanie…" : "Rozwiąż"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
