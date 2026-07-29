# Deploying to Vercel

This app runs on Vercel with Marketplace-provisioned Postgres and Blob storage.
Everything below assumes you have the Vercel CLI installed (`npm i -g vercel@latest`)
and are authenticated (`vercel login`).

## One-time setup

### 1. Link the repo to a Vercel project

From the repo root:

```bash
vercel link
```

Pick the team scope and either create a new project or link an existing one.
Framework is auto-detected as Next.js — no manual config needed.

### 2. Provision Marketplace Postgres

From the project's Vercel dashboard → **Storage** → **Create Database** →
**Marketplace** → **Neon** (or any Marketplace Postgres provider). Attach it to
this project.

This automatically injects `DATABASE_URL` into every environment (Development,
Preview, Production).

### 3. Provision Vercel Blob

Same dashboard, **Storage** → **Create** → **Blob**. Attach it to the project.
This injects `BLOB_READ_WRITE_TOKEN` automatically. Reads pass through the
gated route `/api/attachments/[id]`, not the raw blob URL.

### 4. Set the remaining env vars

Only three secrets aren't provisioned by integrations:

```bash
vercel env add BETTER_AUTH_SECRET production
# paste `openssl rand -base64 32`

vercel env add APP_URL production
# https://<your-canonical-domain>

# One-shot admin bootstrap credentials — remove after step 6.
vercel env add ADMIN_EMAIL production
vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_NAME production
```

Repeat for `preview` if you want the preview builds to have their own admin
(usually you don't — preview branches can share the same DB or run against a
throwaway one).

Sync locally so you can run scripts against the same env:

```bash
vercel env pull .env.production.local
```

### 5. First deploy

```bash
vercel --prod
```

The `vercel-build` script (`drizzle-kit migrate && next build`) runs the
schema migration against the provisioned Postgres before Next.js builds, so
the first deploy stands the database up automatically. Migrations are
idempotent via drizzle-kit's migrations table, so subsequent deploys skip
already-applied migrations.

### 6. Seed the first admin

The seed script writes directly to the DB, so it needs `DATABASE_URL` +
`BETTER_AUTH_SECRET` + `ADMIN_*` set. Run it locally against the production
DB you just pulled:

```bash
# Uses .env.production.local from step 4.
env $(grep -v '^#' .env.production.local | xargs) npm run admin:seed
```

Then **remove the `ADMIN_*` env vars from Vercel** — they're one-shot secrets
and the seed script is idempotent, so leaving them adds no value and does
leak a bootstrap password into the environment.

```bash
vercel env rm ADMIN_PASSWORD production
vercel env rm ADMIN_EMAIL production
vercel env rm ADMIN_NAME production
```

## Ongoing operations

### Invite additional admins

Once seeded, use the CLI-driven invitation flow (Phase 6):

```bash
vercel env pull .env.production.local
env $(grep -v '^#' .env.production.local | xargs) \
  npm run admin:invite -- --email jane@example.com --name "Jane Doe"
```

The command prints a single-use, 7-day `${APP_URL}/aktywacja?token=...` URL.
Hand it to the invitee out-of-band (Signal, in-person, etc.); no email is sent.

### Deploy a preview

Pushed branches get preview deploys automatically. To trigger from the CLI:

```bash
vercel        # deploys current branch as a preview
```

Preview deploys share the same production Postgres unless you connect a
separate preview DB in the dashboard. For a UAT-style setup, provision a
second Marketplace Postgres and scope it to the `preview` environment only.

### Roll back

```bash
vercel rollback <deployment-url>
```

**Caveat**: `drizzle-kit migrate` only rolls forward. If a deploy adds a
migration, rolling back the code does *not* roll back the schema — the older
code will still see the newer columns. For this app the migrations are
additive (new tables, new columns with defaults), so rollback is safe; keep
that in mind if you add a destructive migration later.

## Local development against the production DB

Occasionally useful for debugging. `vercel env pull` writes
`.env.production.local`, then:

```bash
env $(grep -v '^#' .env.production.local | xargs) npm run dev
```

Or, cleaner, use `vercel dev` which pulls the same env automatically.
