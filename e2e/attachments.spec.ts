import { test, expect, type BrowserContext } from "@playwright/test";
import { Buffer } from "node:buffer";

/**
 * Attachment vertical: upload valid images, prove they're gated per-user.
 *
 * Every image loads through `/api/attachments/[id]`. That URL is the
 * one the PRD requires to be un-probeable — the underlying blob URL
 * is public by design.
 *
 * The unit tests for `validateAttachments` already cover the
 * mime/size/count matrix; here we prove the whole pipeline
 * (upload → DB → gate → render) works end-to-end.
 */

const PORT = Number(process.env.PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;

// 1x1 transparent PNG (67 bytes). Big enough to pass the size > 0 check.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000100000005000101" +
    "0d0a2db40000000049454e44ae426082",
  "hex",
);

// PDF header — validators reject on mime `application/pdf`, so we just
// need something the browser tags with that MIME (Playwright uses the
// buffer's `mimeType`).
const TINY_PDF = Buffer.from("%PDF-1.4\n%EOF\n", "utf-8");

async function registerInContext(context: BrowserContext, tag: string) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "hunter2hunter2";
  const name = `${tag} test`;
  const res = await context.request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  });
  expect(res.ok(), `sign-up failed: ${res.status()}`).toBeTruthy();
  return { email, password, name };
}

test("reporter uploads 3 valid images; each /api/attachments/[id] returns 200 for owner", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  try {
    await registerInContext(ctx, "att-owner");
    const page = await ctx.newPage();

    await page.goto("/zgloszenia/nowe");
    await page.getByLabel("Tytuł").fill("Ze zrzutami ekranu");
    await page
      .getByLabel("Opis")
      .fill("Trzy obrazy w załączniku dla dowodu przepływu.");

    // Attach 3 images via the hidden file input.
    await page
      .getByTestId("attachment-input")
      .setInputFiles([
        { name: "one.png", mimeType: "image/png", buffer: TINY_PNG },
        { name: "two.png", mimeType: "image/png", buffer: TINY_PNG },
        { name: "three.png", mimeType: "image/png", buffer: TINY_PNG },
      ]);

    await expect(page.getByTestId("attachment-preview")).toHaveCount(3);

    await page.getByRole("button", { name: "Utwórz zgłoszenie" }).click();
    await page.waitForURL(/\/zgloszenia\/[0-9a-f-]{36}$/);

    // Grid rendered with 3 gated links
    await expect(page.getByTestId("issue-screenshots")).toBeVisible();
    const linkCount = await page.getByTestId("attachment-link").count();
    expect(linkCount).toBe(3);

    // Each `/api/attachments/[id]` fetch must succeed for the owner.
    // We drive that through the browser context so cookies are attached.
    const hrefs = await page
      .getByTestId("attachment-link")
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));

    for (const href of hrefs) {
      const response = await ctx.request.get(href, { maxRedirects: 0 });
      // Local dev streams (200); a real Vercel Blob deployment would
      // 302 — accept both here so this test isn't backend-specific.
      expect([200, 302, 303, 307]).toContain(response.status());
    }
  } finally {
    await ctx.close();
  }
});

test("user B's GET /api/attachments/[id] on user A's attachment returns 404", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    await registerInContext(ctxA, "att-a");
    await registerInContext(ctxB, "att-b");

    // A uploads
    const pageA = await ctxA.newPage();
    await pageA.goto("/zgloszenia/nowe");
    await pageA.getByLabel("Tytuł").fill("Tylko dla A");
    await pageA.getByLabel("Opis").fill("Załącznik prywatny");
    await pageA
      .getByTestId("attachment-input")
      .setInputFiles([
        { name: "secret.png", mimeType: "image/png", buffer: TINY_PNG },
      ]);
    await pageA.getByRole("button", { name: "Utwórz zgłoszenie" }).click();
    await pageA.waitForURL(/\/zgloszenia\/[0-9a-f-]{36}$/);

    // Grab the attachment URL from A's detail page.
    const attachmentUrls = await pageA
      .getByTestId("attachment-link")
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    expect(attachmentUrls.length).toBe(1);
    const attachmentUrl = attachmentUrls[0]!;

    // B fetches it via their own cookie'd context → 404
    const attachmentPath = attachmentUrl.replace(BASE, "");
    const response = await ctxB.request.get(attachmentPath, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("rejects a 6th image, an 11 MB image, and a PDF while keeping the good ones", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  try {
    await registerInContext(ctx, "att-mix");
    const page = await ctx.newPage();

    await page.goto("/zgloszenia/nowe");
    await page.getByLabel("Tytuł").fill("Mieszany zestaw plików");
    await page
      .getByLabel("Opis")
      .fill("Kilka poprawnych, kilka do odrzucenia.");

    // Comfortably over the per-file cap (4 MB) to exercise the `too_large`
    // rejection path.
    const oversize = Buffer.alloc(10 * 1024 * 1024 + 1, 0);

    // Attach 5 good + a PDF + an oversize + a 6th good image.
    // The 6th good image should be rejected as `too_many` after the
    // first 5 are accepted.
    await page.getByTestId("attachment-input").setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "two.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "three.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "four.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "five.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "six.png", mimeType: "image/png", buffer: TINY_PNG }, // too_many
      { name: "doc.pdf", mimeType: "application/pdf", buffer: TINY_PDF }, // bad_type
      { name: "big.png", mimeType: "image/png", buffer: oversize }, // too_large
    ]);

    // 5 accepted previews, at least 3 rejection messages
    await expect(page.getByTestId("attachment-preview")).toHaveCount(5);
    const rejectionCount = await page.getByTestId("attachment-rejection").count();
    expect(rejectionCount).toBeGreaterThanOrEqual(3);

    // Description survives — the field still holds the original text.
    await expect(page.getByLabel("Opis")).toHaveValue(
      "Kilka poprawnych, kilka do odrzucenia.",
    );

    // Submit — the 5 valid files land, and the issue is created.
    await page.getByRole("button", { name: "Utwórz zgłoszenie" }).click();
    await page.waitForURL(/\/zgloszenia\/[0-9a-f-]{36}$/);

    // Detail page shows 5 attachments.
    await expect(page.getByTestId("attachment-link")).toHaveCount(5);
  } finally {
    await ctx.close();
  }
});
