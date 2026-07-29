import { randomBytes, createHash } from "node:crypto";

/**
 * Pure token helpers, split out of `service.ts` so unit tests can import
 * them without pulling in `server-only`, the DB client, or the auth stack.
 *
 * Raw tokens are 32 bytes (~256 bits of entropy) base64url-encoded — the
 * URL-safe encoding drops padding so the printed URL stays clean. We store
 * only the sha256 hex hash of the raw token; the raw value only ever exists
 * in the URL printed by `admin:invite` and in the invitee's browser.
 */

const TOKEN_BYTES = 32;

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateRawToken(): string {
  return toBase64Url(randomBytes(TOKEN_BYTES));
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
