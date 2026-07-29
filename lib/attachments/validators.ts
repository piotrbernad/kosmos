/**
 * Attachment validation. Called from **both** sides:
 *   - the client form uses it to reject files before the FormData is built,
 *     so the reporter sees rejections inline without a round-trip
 *   - the Server Action calls it again as the source of truth (PRD:
 *     "the client-side check is a convenience rather than a guarantee")
 *
 * Rejection is per-file, not per-form. A single bad file must not
 * discard the description or the other, accepted attachments — that is
 * an explicit PRD requirement.
 */

export const MAX_ATTACHMENTS_PER_ISSUE = 5;
export const MAX_BYTES_PER_ATTACHMENT = 10 * 1024 * 1024; // 10 MB

// Note: browsers report `image/jpeg` for both `.jpg` and `.jpeg`.
export const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export type RejectionReason =
  | "too_many"
  | "too_large"
  | "bad_type"
  | "empty";

export type FileLike = {
  name: string;
  size: number;
  type: string;
};

export type ValidationResult<T extends FileLike> = {
  accepted: T[];
  rejected: Array<{ name: string; why: RejectionReason; message: string }>;
};

/** Polish user-facing copy for each reason. */
export function reasonMessage(why: RejectionReason): string {
  switch (why) {
    case "too_many":
      return `Można dodać maksymalnie ${MAX_ATTACHMENTS_PER_ISSUE} załączników.`;
    case "too_large":
      return `Plik jest większy niż ${MAX_BYTES_PER_ATTACHMENT / (1024 * 1024)} MB.`;
    case "bad_type":
      return "Dozwolone są tylko obrazy PNG, JPG, WebP lub GIF.";
    case "empty":
      return "Plik jest pusty.";
  }
}

function isAllowedContentType(t: string): t is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(t);
}

/**
 * Split an input list of `File`-like items into accepted vs rejected.
 * The 5-file cap is enforced by position: the first 5 valid files pass,
 * anything beyond is rejected with `too_many` — that way if the user
 * drops in 7 files, they see 5 accepted + 2 rejected rather than "all 7
 * rejected".
 *
 * `existingCount` is passed so an issue-edit flow can respect the
 * per-issue total (not just the per-batch total). For a plain create,
 * pass 0.
 */
export function validateAttachments<T extends FileLike>(
  files: T[],
  existingCount = 0,
): ValidationResult<T> {
  const accepted: T[] = [];
  const rejected: ValidationResult<T>["rejected"] = [];

  let running = existingCount;

  for (const f of files) {
    const name = f.name || "(bez nazwy)";

    if (!isAllowedContentType(f.type)) {
      rejected.push({ name, why: "bad_type", message: reasonMessage("bad_type") });
      continue;
    }
    if (f.size <= 0) {
      rejected.push({ name, why: "empty", message: reasonMessage("empty") });
      continue;
    }
    if (f.size > MAX_BYTES_PER_ATTACHMENT) {
      rejected.push({ name, why: "too_large", message: reasonMessage("too_large") });
      continue;
    }
    if (running >= MAX_ATTACHMENTS_PER_ISSUE) {
      rejected.push({ name, why: "too_many", message: reasonMessage("too_many") });
      continue;
    }

    accepted.push(f);
    running += 1;
  }

  return { accepted, rejected };
}

/**
 * Map a content type to a file extension. Used by the store's key builder
 * so URLs preserve `.png` / `.webp` / etc. — helpful when a blob URL is
 * shared out of band or opened by an image viewer that sniffs by extension.
 */
export function extensionForContentType(t: AllowedContentType): string {
  switch (t) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}

/**
 * Build a blob-store key. Pure function so it can be unit-tested and
 * called from both the store and its tests without pulling in the
 * `server-only` boundary.
 *
 * The `slug` argument is injected rather than computed here so this
 * module stays free of Node imports; the store passes a `randomBytes`-
 * based value.
 */
export function makeAttachmentKey(
  issueId: string,
  contentType: AllowedContentType,
  slug: string,
): string {
  return `issues/${issueId}/${slug}.${extensionForContentType(contentType)}`;
}
