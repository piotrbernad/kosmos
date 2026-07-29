import { test, expect, type BrowserContext } from "@playwright/test";

/**
 * Privacy vertical (Phase 2 slice): one user cannot see another user's issue.
 *
 * The PRD's success metric requires "a signed-in `user` provably cannot read
 * another user's issue through *any* surface". Phase 2's surface is the issue
 * detail page (`/zgloszenia/[id]`); other surfaces (attachments API, admin
 * queue, status action) get their own asserts in later phases.
 *
 * Same code for "doesn't exist" and "you don't own it" per PRD — both render
 * the app's not-found page, never a "forbidden" copy.
 */

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

test("user B cannot read user A's issue by direct URL", async ({ browser }) => {
  // Two isolated browser contexts so cookies do not cross.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    await registerInContext(ctxA, "userA");
    await registerInContext(ctxB, "userB");

    // User A files an issue and captures its id from the URL.
    const pageA = await ctxA.newPage();
    await pageA.goto("/zgloszenia/nowe");
    await pageA.getByLabel("Tytuł").fill("Prywatna sprawa");
    await pageA.getByLabel("Opis").fill("Nic do zobaczenia dla B.");
    await pageA.getByRole("button", { name: "Utwórz zgłoszenie" }).click();
    await pageA.waitForURL(/\/zgloszenia\/[0-9a-f-]{36}$/);
    const usersAIssueUrl = pageA.url();
    const issueId = usersAIssueUrl.match(/\/zgloszenia\/([0-9a-f-]{36})/)?.[1];
    expect(issueId, "captured user A's issue id").toBeTruthy();

    // User B tries to open user A's issue.
    const pageB = await ctxB.newPage();
    const response = await pageB.goto(`/zgloszenia/${issueId}`);
    expect(response?.status(), "not-found status").toBe(404);
    // Renders our own not-found page (Polish copy, no "forbidden" wording).
    await expect(pageB.locator("body")).not.toContainText("Prywatna sprawa");
    await expect(pageB.locator("body")).not.toContainText(/forbidden|zabroniony/i);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("a garbage id renders not-found rather than blowing up", async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    await registerInContext(ctx, "junkid");
    const page = await ctx.newPage();
    const response = await page.goto("/zgloszenia/not-a-uuid");
    expect(response?.status()).toBe(404);
  } finally {
    await ctx.close();
  }
});
