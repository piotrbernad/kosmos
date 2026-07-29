import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Auth bootstrap for later phases. Phase 1 does not depend on saved
 * storageState (smoke.spec.ts registers a fresh user inline), but this file
 * ships so Phases 2+ can `test.use({ storageState: 'e2e/.auth/user.json' })`
 * without a follow-up scaffolding step.
 *
 * We seed a per-run reporter account with a unique email and store its
 * session cookies. The admin storageState is written by later phases after
 * `npm run admin:seed` has been wired.
 */

const authDir = path.join(process.cwd(), "e2e", ".auth");
const userFile = path.join(authDir, "user.json");

setup("authenticate as reporter", async ({ page, request }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const email = `reporter-${Date.now()}@example.com`;
  const password = "hunter2hunter2";
  const name = "Reporter Testowy";

  // Prefer API round-trip over UI for speed.
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  });
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  // Confirm the cookie is now attached and lands us on /zgloszenia.
  await page.goto("/zgloszenia");
  await expect(page).toHaveURL(/\/zgloszenia$/);

  await page.context().storageState({ path: userFile });
});
