"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { editIssue } from "@/lib/issues/actions";
import { AttachmentField } from "@/app/(reporter)/zgloszenia/nowe/AttachmentField";
import type { IssueAttachmentSummary } from "@/lib/issues/dto";
import { z } from "zod";

/**
 * Reporter-side edit form. Distinct from `CreateIssueForm` because:
 *   • it edits existing text (defaultValues aren't empty)
 *   • it needs to track which existing attachments to *remove*
 *   • it posts to `editIssue`, not `createIssue`
 *
 * The attachment field composes: existing attachments render with a
 * "Usuń" toggle; new attachments use the same `<AttachmentField>` as
 * the create form. Server enforces the 5-cap counting survivors, so
 * a client-side over-count still bounces per-file.
 */

// Local schema: same shape as EditIssueSchema minus the `id` /
// `expectedUpdatedAt` (passed as props, not form fields).
const FormSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(3, "Tytuł: minimum 3 znaków.").max(200, "Tytuł: maksymalnie 200 znaków.")),
  description: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Opis jest wymagany.").max(5000, "Opis: maksymalnie 5000 znaków.")),
});
type FormValues = z.infer<typeof FormSchema>;

export function EditIssueForm({
  id,
  initialTitle,
  initialDescription,
  expectedUpdatedAt,
  existingAttachments,
}: {
  id: string;
  initialTitle: string;
  initialDescription: string;
  expectedUpdatedAt: string;
  existingAttachments: IssueAttachmentSummary[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { title: initialTitle, description: initialDescription },
    mode: "onSubmit",
  });

  const toggleRemove = (attachmentId: string) => {
    setRemoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(attachmentId)) next.delete(attachmentId);
      else next.add(attachmentId);
      return next;
    });
  };

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("title", values.title);
    fd.set("description", values.description);
    fd.set("expectedUpdatedAt", expectedUpdatedAt);
    for (const rid of removeIds) fd.append("remove[]", rid);
    for (const file of newFiles) fd.append("attachment[]", file);

    const res = await editIssue(fd);
    if (!res.ok) {
      setSubmitting(false);
      switch (res.reason) {
        case "attachment_rejected":
          toast.error(
            `Załączniki odrzucone: ${res.rejected
              .map((r) => `${r.name} — ${r.message}`)
              .join("; ")}`,
          );
          return;
        case "locked":
          toast.error("Zgłoszenie zostało rozwiązane i nie można go edytować.");
          router.push(`/zgloszenia/${id}`);
          return;
        case "conflict":
          toast.error(
            "Zgłoszenie zostało w międzyczasie zaktualizowane. Odśwież stronę i spróbuj ponownie.",
          );
          router.refresh();
          return;
        case "gone":
          toast.error("Zgłoszenie zostało usunięte.");
          router.push("/zgloszenia");
          return;
        case "invalid":
          toast.error("Sprawdź formularz — dane są nieprawidłowe.");
          return;
      }
      return;
    }
    if (res.rejected && res.rejected.length > 0) {
      toast.warning(
        `Część załączników pominięto: ${res.rejected
          .map((r) => `${r.name} — ${r.message}`)
          .join("; ")}`,
      );
    }
    // Push to the detail page. The RSC render happens on navigation, so
    // no extra `router.refresh()` — that would re-fetch the *current*
    // (edit) route and race the push.
    router.push(`/zgloszenia/${id}`);
  }

  const survivingCount =
    existingAttachments.filter((a) => !removeIds.has(a.id)).length;

  return (
    <form
      className="stack-lg"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-testid="edit-issue-form"
    >
      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="title">Tytuł</label>
        <input
          id="title"
          type="text"
          autoComplete="off"
          maxLength={200}
          aria-invalid={errors.title ? "true" : "false"}
          {...register("title")}
        />
        {errors.title && (
          <p className="error" role="alert">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="description">Opis</label>
        <textarea
          id="description"
          rows={8}
          maxLength={5000}
          aria-invalid={errors.description ? "true" : "false"}
          {...register("description")}
        />
        {errors.description && (
          <p className="error" role="alert">
            {errors.description.message}
          </p>
        )}
      </div>

      {existingAttachments.length > 0 && (
        <div className="stack" style={{ gap: 8 }} data-testid="existing-attachments">
          <label>Istniejące załączniki</label>
          <ul
            className="row"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {existingAttachments.map((a) => {
              const marked = removeIds.has(a.id);
              return (
                <li
                  key={a.id}
                  className="card"
                  data-testid={`existing-attachment-${a.id}`}
                  style={{
                    padding: 8,
                    width: 160,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    opacity: marked ? 0.5 : 1,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/attachments/${a.id}`}
                    alt={a.filename}
                    style={{
                      width: "100%",
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 4,
                      filter: marked ? "grayscale(1)" : undefined,
                    }}
                  />
                  <span
                    title={a.filename}
                    style={{
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.filename}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => toggleRemove(a.id)}
                    style={{ fontSize: 12, padding: "2px 6px" }}
                    data-testid={`existing-attachment-${a.id}-toggle`}
                    aria-pressed={marked}
                  >
                    {marked ? "Przywróć" : "Usuń"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted" style={{ fontSize: 12 }}>
            {survivingCount} istniejący{survivingCount === 1 ? "" : "ch"} po zapisie.
          </p>
        </div>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <label>Dodaj załączniki</label>
        <AttachmentField onChange={setNewFiles} disabled={submitting} />
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          className="btn"
          onClick={() => router.push(`/zgloszenia/${id}`)}
          disabled={submitting}
          data-testid="edit-cancel"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          data-testid="edit-submit"
        >
          {submitting ? "Zapisywanie…" : "Zapisz zmiany"}
        </button>
      </div>
    </form>
  );
}
