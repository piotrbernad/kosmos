"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CreateIssueSchema, type CreateIssueInput } from "@/lib/issues/validators";
import { createIssue } from "@/lib/issues/actions";

/**
 * Client-side create form. The Zod resolver keeps the UX-side check aligned
 * with the server contract — the server re-validates because "client-side
 * check is a convenience rather than a guarantee" (PRD).
 *
 * Attachments (Phase 3) will be a sibling field in the same form.
 */
export function CreateIssueForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateIssueInput>({
    resolver: zodResolver(CreateIssueSchema),
    defaultValues: { title: "", description: "" },
    mode: "onSubmit",
  });

  async function onSubmit(values: CreateIssueInput) {
    setSubmitting(true);
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("description", values.description);
    const res = await createIssue(fd);
    if (!res.ok) {
      setSubmitting(false);
      toast.error("Nie udało się utworzyć zgłoszenia. Sprawdź formularz.");
      return;
    }
    // Land on the new issue's detail page. `router.refresh()` isn't needed
    // here — we're navigating to a new server-rendered route.
    router.push(`/zgloszenia/${res.id}`);
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
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
        <p className="muted" style={{ fontSize: 12 }}>
          Krótkie podsumowanie problemu (3–200 znaków).
        </p>
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
        <p className="muted" style={{ fontSize: 12 }}>
          Co robiłeś, czego się spodziewałeś, co się stało zamiast tego (do 5000 znaków).
        </p>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Wysyłanie…" : "Utwórz zgłoszenie"}
        </button>
      </div>
    </form>
  );
}
