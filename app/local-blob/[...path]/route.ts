import { NextResponse, type NextRequest } from "next/server";
import { readLocal, isVercelBlobConfigured } from "@/lib/attachments/store";

/**
 * Local dev-only pass-through for the on-disk blob fallback.
 *
 * When `BLOB_READ_WRITE_TOKEN` is set, we never hit this route — the
 * gated `/api/attachments/[id]` route 302s directly to the Vercel Blob
 * CDN URL. Without the token, `store.put()` writes to
 * `.blob-storage/<key>` and returns `/local-blob/<key>` as the `blob_url`
 * so images have somewhere to load from during development.
 *
 * This route is **not** gated by DAL — it serves whatever is in the
 * fallback store. That is intentional: on production this file's
 * behavior is a no-op (404 as soon as we see the token is set), and
 * locally the fallback URLs are only referenced from server-rendered
 * pages that themselves went through the DAL. The gated URL surface
 * the PRD cares about is `/api/attachments/[id]` — this route is a
 * dev-mode static server, equivalent to the way Vercel Blob's public
 * CDN URLs work in production.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (isVercelBlobConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  const { path } = await ctx.params;
  const key = path.join("/");
  const file = await readLocal(key);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.body.byteLength),
      // The public URL is not sensitive per-se — the DAL is the gate —
      // but there's no reason to let a shared proxy cache it either.
      "cache-control": "no-store",
    },
  });
}
