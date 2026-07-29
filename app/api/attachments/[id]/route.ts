import { NextResponse, type NextRequest } from "next/server";
import { getAttachmentForCurrentUser } from "@/lib/dal";
import { IssueIdSchema } from "@/lib/issues/validators";
import { readLocal, isVercelBlobConfigured } from "@/lib/attachments/store";

/**
 * Gated attachment stream/redirect.
 *
 *   1. Validate the id shape (reject garbage before hitting the DB).
 *   2. Call `getAttachmentForCurrentUser` — this runs `requireUser`
 *      internally and applies the admin-OR-reporter predicate.
 *   3. On a miss (nonexistent id, wrong owner, non-admin), 404.
 *   4. Otherwise:
 *      - production / when `BLOB_READ_WRITE_TOKEN` is set: 302 redirect
 *        to the CDN URL. The blob URL is public — that's fine, because
 *        it's unguessable and only leaks after this gate has passed.
 *        The **URL of this handler** is what must be gated, per PRD.
 *      - local dev without a Blob token: stream the file directly from
 *        the on-disk fallback so images render without a Vercel account.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  const parsed = IssueIdSchema.safeParse(id);
  if (!parsed.success) {
    return new NextResponse(null, { status: 404 });
  }

  const attachment = await getAttachmentForCurrentUser(parsed.data);
  if (!attachment) {
    return new NextResponse(null, { status: 404 });
  }

  if (isVercelBlobConfigured()) {
    // 302 so the browser fetches directly from the CDN; keeps this
    // handler off the hot path for the actual bytes.
    return NextResponse.redirect(attachment.blobUrl, 302);
  }

  // Local dev fallback: read + stream.
  const file = await readLocal(attachment.blobPathname);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.body.byteLength),
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
