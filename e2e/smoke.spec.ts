import { test, expect } from "@playwright/test";

test("register → auto-login → land on empty /zgloszenia", async ({ page }) => {
  const email = `smoke-${Date.now()}@example.com`;
  const password = "hunter2hunter2";
  const name = "Smoke Test";

  await page.goto("/rejestracja");
  await expect(page.getByRole("heading", { name: "Załóż konto" })).toBeVisible();

  await page.getByLabel("Imię i nazwisko").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Hasło/).fill(password);
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await page.waitForURL(/\/zgloszenia$/);
  await expect(page.getByRole("heading", { name: "Moje zgłoszenia" })).toBeVisible();
  await expect(page.getByTestId("empty-issues")).toBeVisible();
});
