import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Auth bootstrap. Runs before the rest of the suite as a Playwright
 * "setup" project (see playwright.config.ts) and produces two
 * `storageState` files:
 *
 *   e2e/.auth/user.json  — a fresh per-run reporter
 *   e2e/.auth/admin.json — the seeded admin (via `npm run admin:seed`)
 *
 * The admin setup shells out to `npm run admin:seed` so the tests use
 * the same idempotent path as the operator. Credentials come from
 * ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env.local — the same
 * three variables the seed script itself reads.
 */

const authDir = path.join(process.cwd(), "e2e", ".auth");
const userFile = path.join(authDir, "user.json");
const adminFile = path.join(authDir, "admin.json");

setup("authenticate as reporter", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const email = `reporter-${Date.now()}@example.com`;
  const password = "hunter2hunter2";
  const name = "Reporter Testowy";

  // Use `page.request` so the sign-up response's Set-Cookie lands on the
  // same cookie jar as the browser context (the top-level `request`
  // fixture has its own jar and the cookie would not follow).
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  });
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  await page.goto("/zgloszenia");
  await expect(page).toHaveURL(/\/zgloszenia$/);

  await page.context().storageState({ path: userFile });
});

setup("authenticate as admin", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail || !adminPassword || !adminName) {
    throw new Error(
      "ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME must be set in .env.local for the admin setup.",
    );
  }

  // Idempotent — run the same command the operator would run.
  try {
    execFileSync("npm", ["run", "admin:seed"], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  } catch (err) {
    console.error("admin:seed failed", err);
    throw err;
  }

  // Now sign in and capture the storage state.
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: adminEmail, password: adminPassword },
  });
  expect(
    res.ok(),
    `admin sign-in failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();

  await page.goto("/admin/zgloszenia");
  await expect(page).toHaveURL(/\/admin\/zgloszenia$/);

  await page.context().storageState({ path: adminFile });
});
