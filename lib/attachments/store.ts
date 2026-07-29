import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { put as blobPut, del as blobDel } from "@vercel/blob";
import type { AllowedContentType } from "./validators";
import { makeAttachmentKey } from "./validators";

/**
 * Attachment storage. Two backends behind one interface:
 *
 *   - `@vercel/blob` when `BLOB_READ_WRITE_TOKEN` is set — used on Vercel
 *     and locally after `vercel link` + `vercel env pull`.
 *   - a local filesystem fallback rooted at `.blob-storage/` when the
 *     token is empty. This exists purely so `npm run e2e` works out of
 *     the box without provisioning a real Blob store; production always
 *     runs the Vercel backend.
 *
 * The interface is deliberately small: `put(...)` returns `{ url, pathname }`
 * and `del(pathname)` removes. `blob_url` is what we persist in the DB and
 * what the gated `/api/attachments/[id]` route will 302-redirect to.
 *
 * The fallback URL points at `/__blob/<pathname>` served by a local dev
 * route so images actually render. On Vercel this file is never hit
 * because the token is always set.
 */

export type PutResult = {
  url: string;
  pathname: string;
};

const LOCAL_ROOT = path.join(process.cwd(), ".blob-storage");
const LOCAL_URL_PREFIX = "/local-blob/";

function isVercelBlobConfigured(): boolean {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  return typeof t === "string" && t.length > 0;
}

/**
 * Generate a URL-safe random slug for the blob key. We prefer this over
 * a nanoid dependency — the entropy is the same, and one fewer package
 * in the tree is one fewer thing to keep pinned.
 */
function slug(): string {
  return randomBytes(12).toString("base64url");
}

export function buildKey(issueId: string, contentType: AllowedContentType): string {
  return makeAttachmentKey(issueId, contentType, slug());
}

/**
 * Store a file. Returns the URL to persist in `issue_attachments.blob_url`
 * and the pathname (for `del`).
 */
export async function put(
  key: string,
  body: Buffer,
  contentType: AllowedContentType,
): Promise<PutResult> {
  if (isVercelBlobConfigured()) {
    const res = await blobPut(key, body, {
      access: "public",
      contentType,
      // Blob adds a random suffix by default so re-uploading the same key
      // doesn't collide. We already inject entropy in `slug()`, so a
      // deterministic pathname is fine.
      addRandomSuffix: false,
    });
    return { url: res.url, pathname: res.pathname };
  }

  // Local dev / test fallback
  const fullPath = path.join(LOCAL_ROOT, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, body);
  return { url: `${LOCAL_URL_PREFIX}${key}`, pathname: key };
}

/**
 * Delete a stored blob. Best-effort: if the underlying object is already
 * gone, we swallow the error — the DB row is the source of truth for
 * whether an attachment exists from the app's point of view.
 */
export async function del(pathname: string): Promise<void> {
  if (isVercelBlobConfigured()) {
    try {
      await blobDel(pathname);
    } catch {
      // ignore
    }
    return;
  }

  const fullPath = path.join(LOCAL_ROOT, pathname);
  try {
    await fs.promises.unlink(fullPath);
  } catch {
    // ignore
  }
}

/**
 * Local-only helper for the dev-mode blob route handler. Reads the
 * stored bytes for streaming back to the browser. Only used when the
 * Vercel token is absent — on Vercel we 302 to the CDN URL directly.
 */
export async function readLocal(pathname: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (isVercelBlobConfigured()) return null;
  // Path traversal guard: reject anything that would escape LOCAL_ROOT.
  const fullPath = path.resolve(LOCAL_ROOT, pathname);
  if (!fullPath.startsWith(path.resolve(LOCAL_ROOT) + path.sep)) return null;
  try {
    const body = await fs.promises.readFile(fullPath);
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "application/octet-stream";
    return { body, contentType };
  } catch {
    return null;
  }
}

export { LOCAL_URL_PREFIX, isVercelBlobConfigured };
