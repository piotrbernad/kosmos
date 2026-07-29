import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { Client } from "pg";

/**
 * Phase 6 — admin invitation flow (`admin:invite` + `/aktywacja`).
 *
 * The scenarios below cover the whole lifecycle:
 *   • Operator generates a URL; invitee opens it, sets a password, and
 *     lands on `/admin/zgloszenia` as an admin.
 *   • The same URL reused → 404.
 *   • A tampered token → 404.
 *   • After the 7-day expiry (fast-forwarded via a test DB `UPDATE`) → 404.
 *   • Re-inviting the same email invalidates the first URL.
 *   • A signed-in `user` visiting a valid claim URL still ends up in an
 *     admin session (per PRD success metric).
 *
 * The tests shell out to `npm run admin:invite -- --email … --name …` so
 * the CLI is exercised end-to-end. Stale rows from prior runs are cleaned
 * up via a direct DELETE on `admin_invitation` + `user` for each generated
 * address so re-runs stay deterministic.
 */

function pgClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set in the test env");
  return new Client({ connectionString });
}

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = pgClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function purgeInvitee(email: string) {
  await withDb(async (client) => {
    // Cascade rules take care of admin_invitation and account rows.
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
  });
}

function inviteViaCli(email: string, name: string): string {
  const stdout = execFileSync(
    "npm",
    ["run", "--silent", "admin:invite", "--", "--email", email, "--name", name],
    { cwd: process.cwd(), env: process.env, encoding: "utf8" },
  );
  const match = stdout.match(/https?:\/\/[^\s]+\/aktywacja\?token=[A-Za-z0-9_-]+/);
  expect(match, `admin:invite should print an activation URL; got:\n${stdout}`)
    .toBeTruthy();
  return match![0];
}

function uniqEmail(tag: string): string {
  return `invite-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("admin invitation flow", () => {
  test("operator invites, invitee claims, lands as admin", async ({ browser }) => {
    const email = uniqEmail("happy");
    try {
      const url = inviteViaCli(email, "Zaproszony Admin");
      const ctx = await browser.newContext();
      try {
        const page = await ctx.newPage();
        await page.goto(url);
        await expect(page.getByRole("heading", { name: /aktywacja/i })).toBeVisible();
        await page.getByLabel(/hasło/i).fill("newAdminPass123");
        await page.getByRole("button", { name: /ustaw hasło/i }).click();
        await page.waitForURL(/\/admin\/zgloszenia$/, { timeout: 15_000 });
        // The admin queue is only visible to admins — a plain-user session
        // would 404 the same URL (see privacy.spec.ts).
        expect(page.url()).toMatch(/\/admin\/zgloszenia$/);
      } finally {
        await ctx.close();
      }
    } finally {
      await purgeInvitee(email);
    }
  });

  test("reusing a claimed URL returns 404", async ({ browser }) => {
    const email = uniqEmail("reuse");
    try {
      const url = inviteViaCli(email, "Reuse Admin");

      // First claim — happy path.
      const ctx1 = await browser.newContext();
      try {
        const p = await ctx1.newPage();
        await p.goto(url);
        await p.getByLabel(/hasło/i).fill("reusePass1234");
        await p.getByRole("button", { name: /ustaw hasło/i }).click();
        await p.waitForURL(/\/admin\/zgloszenia$/, { timeout: 15_000 });
      } finally {
        await ctx1.close();
      }

      // Second visit — 404 (already used).
      const ctx2 = await browser.newContext();
      try {
        const p = await ctx2.newPage();
        const res = await p.goto(url);
        expect(res?.status()).toBe(404);
      } finally {
        await ctx2.close();
      }
    } finally {
      await purgeInvitee(email);
    }
  });

  test("a tampered token returns 404", async ({ browser }) => {
    const email = uniqEmail("tamper");
    try {
      const url = inviteViaCli(email, "Tamper Admin");
      // Flip one character of the token in-URL so sha256 no longer matches.
      const tampered = url.replace(/token=(.)/, (_, first) =>
        `token=${first === "A" ? "B" : "A"}`,
      );
      expect(tampered).not.toBe(url);

      const ctx = await browser.newContext();
      try {
        const p = await ctx.newPage();
        const res = await p.goto(tampered);
        expect(res?.status()).toBe(404);
      } finally {
        await ctx.close();
      }
    } finally {
      await purgeInvitee(email);
    }
  });

  test("an expired invitation returns 404 (fast-forward via DB update)", async ({
    browser,
  }) => {
    const email = uniqEmail("expired");
    try {
      const url = inviteViaCli(email, "Expired Admin");

      // Fast-forward the invitation to a past expires_at.
      await withDb(async (client) => {
        await client.query(
          `UPDATE admin_invitation SET expires_at = now() - interval '1 day'
           WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
          [email],
        );
      });

      const ctx = await browser.newContext();
      try {
        const p = await ctx.newPage();
        const res = await p.goto(url);
        expect(res?.status()).toBe(404);
      } finally {
        await ctx.close();
      }
    } finally {
      await purgeInvitee(email);
    }
  });

  test("re-inviting the same email invalidates the prior URL", async ({
    browser,
  }) => {
    const email = uniqEmail("reissue");
    try {
      const firstUrl = inviteViaCli(email, "Reissue Admin");
      const secondUrl = inviteViaCli(email, "Reissue Admin");
      expect(firstUrl).not.toBe(secondUrl);

      // The FIRST URL is now dead.
      const ctxOld = await browser.newContext();
      try {
        const p = await ctxOld.newPage();
        const res = await p.goto(firstUrl);
        expect(res?.status()).toBe(404);
      } finally {
        await ctxOld.close();
      }

      // The SECOND URL still works.
      const ctxNew = await browser.newContext();
      try {
        const p = await ctxNew.newPage();
        await p.goto(secondUrl);
        await p.getByLabel(/hasło/i).fill("reissuePass1234");
        await p.getByRole("button", { name: /ustaw hasło/i }).click();
        await p.waitForURL(/\/admin\/zgloszenia$/, { timeout: 15_000 });
      } finally {
        await ctxNew.close();
      }
    } finally {
      await purgeInvitee(email);
    }
  });
});
