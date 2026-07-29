import { test, expect } from "@playwright/test";

/**
 * Reporter vertical slice (text-only): create → list → detail.
 *
 * Each test registers a fresh user inline. That's slower than a saved
 * storageState per role, but it keeps every scenario self-contained (no
 * shared state, no fixture ordering).
 */

async function registerFresh(page: import("@playwright/test").Page, tag = "reporter") {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "hunter2hunter2";
  const name = `${tag} ${Date.now()}`;
  await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  });
  return { email, password, name };
}

test.describe("reporter flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerFresh(page, "reporter");
  });

  test("create an issue, see it in the list, open its detail", async ({ page }) => {
    await page.goto("/zgloszenia");
    await expect(page.getByTestId("empty-issues")).toBeVisible();

    // Create
    await page.getByRole("link", { name: "Nowe zgłoszenie" }).first().click();
    await expect(page).toHaveURL(/\/zgloszenia\/nowe$/);

    const title = `Coś nie działa ${Date.now()}`;
    const description = "Kliknąłem przycisk i nic się nie stało.";
    await page.getByLabel("Tytuł").fill(title);
    await page.getByLabel("Opis").fill(description);
    await page.getByRole("button", { name: "Utwórz zgłoszenie" }).click();

    // Land on detail
    await page.waitForURL(/\/zgloszenia\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("issue-title")).toHaveText(title);
    await expect(page.getByTestId("issue-description")).toContainText(description);
    await expect(page.getByTestId("status-nowe")).toBeVisible();
    // Seed feed row exists
    await expect(page.getByTestId("feed-event-status_change")).toBeVisible();
    await expect(page.getByTestId("issue-feed")).toContainText("Utworzono zgłoszenie");

    // Return to list — the new issue is the first (and only) row
    await page.getByRole("link", { name: "← Wróć do listy" }).click();
    await expect(page).toHaveURL(/\/zgloszenia$/);
    const list = page.getByTestId("issue-list");
    await expect(list).toBeVisible();
    await expect(list.getByText(title)).toBeVisible();
    await expect(list.getByTestId("status-nowe").first()).toBeVisible();
  });

  test("form rejects a too-short title client-side without submitting", async ({ page }) => {
    await page.goto("/zgloszenia/nowe");
    await page.getByLabel("Tytuł").fill("ab");
    await page.getByLabel("Opis").fill("opis");
    await page.getByRole("button", { name: "Utwórz zgłoszenie" }).click();

    // Client-side Zod resolver refuses to submit; we stay on the form.
    await expect(page).toHaveURL(/\/zgloszenia\/nowe$/);
    // Scope to `.error` so we don't clash with Next's `#__next-route-announcer__`
    // which also carries role="alert".
    await expect(page.locator("p.error").first()).toBeVisible();
    await expect(page.locator("p.error").first()).toContainText("Tytuł");
  });
});
