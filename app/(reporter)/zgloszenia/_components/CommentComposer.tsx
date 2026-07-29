"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addComment } from "@/lib/issues/actions";

/**
 * Text-only composer used by both the reporter and admin detail pages.
 * Hidden entirely once the issue is `rozwiazane` — the caller decides
 * whether to render this or the "Dyskusja zakończona" line, so this
 * component never needs to know about lock state beyond acting on the
 * server's `closed` reason.
 */
export function CommentComposer({ issueId }: { issueId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;

    startTransition(async () => {
      const result = await addComment({ issueId, body: trimmed });
      if (result.ok) {
        setBody("");
        router.refresh();
      } else if (result.reason === "closed") {
        toast.error(
          "Dyskusja jest zakończona — nie można już dodawać komentarzy.",
        );
        router.refresh();
      } else {
        toast.error("Nie udało się dodać komentarza.");
      }
    });
  };

  return (
    <form
      className="stack"
      data-testid="comment-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ gap: 8 }}
    >
      <label htmlFor={`comment-${issueId}`}>Dodaj komentarz</label>
      <textarea
        id={`comment-${issueId}`}
        name="body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={pending}
        placeholder="Napisz komentarz…"
        data-testid="comment-textarea"
      />
      <div className="row-between">
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Komentarze są widoczne dla obu stron.
        </p>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || body.trim().length === 0}
          data-testid="comment-submit"
        >
          {pending ? "Wysyłanie…" : "Dodaj komentarz"}
        </button>
      </div>
    </form>
  );
}
