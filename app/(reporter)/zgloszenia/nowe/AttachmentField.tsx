"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_ATTACHMENTS_PER_ISSUE,
  MAX_BYTES_PER_ATTACHMENT,
  validateAttachments,
  ALLOWED_CONTENT_TYPES,
} from "@/lib/attachments/validators";

/**
 * Drag-and-drop + file picker for issue attachments.
 *
 * The parent form pulls the current file list off this component via
 * the `onChange` callback and appends each entry to its own FormData as
 * `attachment[]`. The field itself is uncontrolled from the RHF point
 * of view — RHF only owns `title` and `description`.
 *
 * Rejection is per-file and inline (PRD: "the file is rejected inline
 * with a Polish reason, the description and other files remain").
 */

type FileEntry = { id: string; file: File; previewUrl: string };
type Rejection = { name: string; message: string };

export type AttachmentFieldProps = {
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

const ALLOWED_ACCEPT = ALLOWED_CONTENT_TYPES.join(",");
const MB = MAX_BYTES_PER_ATTACHMENT / (1024 * 1024);

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentField({ onChange, disabled }: AttachmentFieldProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_ATTACHMENTS_PER_ISSUE - entries.length;

  useEffect(() => {
    onChange(entries.map((e) => e.file));
  }, [entries, onChange]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const { accepted, rejected } = validateAttachments(
        list.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        entries.length,
      );

      // Pair accepted FileLike results back to original File instances.
      const acceptedFiles: File[] = [];
      const remainingList = [...list];
      for (const a of accepted) {
        const idx = remainingList.findIndex(
          (f) => f.name === a.name && f.size === a.size && f.type === a.type,
        );
        if (idx !== -1) {
          acceptedFiles.push(remainingList[idx]);
          remainingList.splice(idx, 1);
        }
      }

      const newEntries: FileEntry[] = acceptedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setEntries((prev) => [...prev, ...newEntries]);
      setRejections(
        rejected.map((r) => ({ name: r.name, message: r.message })),
      );
    },
    [entries.length],
  );

  function removeEntry(id: string) {
    setEntries((prev) => {
      const removed = prev.find((e) => e.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      addFiles(event.target.files);
    }
    // Reset so picking the same file twice fires onChange again.
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
    }
  }

  const zoneClass = useMemo(() => {
    const base = "attachment-drop";
    return isDragOver ? `${base} attachment-drop-hover` : base;
  }, [isDragOver]);

  return (
    <div className="stack" style={{ gap: 8 }} data-testid="attachment-field">
      <label htmlFor="attachment-input">Załączniki</label>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Do {MAX_ATTACHMENTS_PER_ISSUE} obrazów (PNG, JPG, WebP, GIF), maks.{" "}
        {MB} MB każdy. Przeciągnij pliki lub wybierz z dysku.
      </p>

      <div
        className={zoneClass}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-disabled={disabled}
        style={{
          border: "1px dashed var(--border, #d0d0d0)",
          padding: 16,
          borderRadius: 8,
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          background: isDragOver ? "#f0f7ff" : "transparent",
        }}
        data-testid="attachment-dropzone"
      >
        <input
          id="attachment-input"
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_ACCEPT}
          onChange={onPick}
          disabled={disabled}
          style={{ display: "none" }}
          data-testid="attachment-input"
        />
        <p style={{ margin: 0 }}>
          {remaining > 0
            ? `Kliknij lub upuść pliki tutaj (${remaining} pozostał${
                remaining === 1 ? "o" : "y"
              })`
            : `Osiągnięto limit ${MAX_ATTACHMENTS_PER_ISSUE} plików.`}
        </p>
      </div>

      {rejections.length > 0 && (
        <ul
          className="stack"
          style={{ gap: 4, listStyle: "none", padding: 0, margin: 0 }}
          data-testid="attachment-rejections"
        >
          {rejections.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className="error"
              style={{ fontSize: 12 }}
              role="alert"
              data-testid="attachment-rejection"
            >
              {r.name}: {r.message}
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <ul
          className="row"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            gap: 8,
            flexWrap: "wrap",
          }}
          data-testid="attachment-list"
        >
          {entries.map((e) => (
            <li
              key={e.id}
              className="card"
              style={{
                padding: 8,
                width: 140,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
              data-testid="attachment-preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.previewUrl}
                alt={e.file.name}
                style={{
                  width: "100%",
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 4,
                }}
              />
              <span
                title={e.file.name}
                style={{
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.file.name}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                {humanSize(e.file.size)}
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => removeEntry(e.id)}
                style={{ fontSize: 12, padding: "2px 6px" }}
                data-testid="attachment-remove"
                aria-label={`Usuń załącznik ${e.file.name}`}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
