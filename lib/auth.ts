import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/**
 * Better Auth instance. Notes:
 * - `emailAndPassword.enabled: true` — scrypt hashing built in.
 * - `admin({ defaultRole: 'user' })` — adds a `role` column and enforcement
 *   primitives; self-registration always writes `role='user'`.
 * - `nextCookies()` MUST be the last plugin so cookies set inside Server
 *   Actions actually stick to the response.
 * - Sessions are database-backed by default (no JWT), so a role change is
 *   visible on the next `auth.api.getSession` call.
 * - `requireEmailVerification` stays off — the system sends no email.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [admin({ defaultRole: "user" }), nextCookies()],
});

export type Auth = typeof auth;
