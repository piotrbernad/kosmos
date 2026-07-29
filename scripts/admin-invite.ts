import { invite } from "@/lib/invitations/service";

/**
 * `npm run admin:invite -- --email jane@example.com --name "Jane Doe"`
 *
 * Prints the activation URL to stdout. The operator hands the URL to the
 * invitee out-of-band (Slack, Signal, whatever) — the system sends no email.
 *
 * Idempotent per email: re-running for the same address invalidates any
 * prior active invitation atomically (see `invite()` in
 * `lib/invitations/service.ts` — the writes run in one transaction that
 * respects the `admin_invitation_active_uidx` partial unique index).
 */

type Args = { email?: string; name?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") {
      args.email = argv[++i];
    } else if (arg === "--name") {
      args.name = argv[++i];
    } else if (arg.startsWith("--email=")) {
      args.email = arg.slice("--email=".length);
    } else if (arg.startsWith("--name=")) {
      args.name = arg.slice("--name=".length);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email || !args.name) {
    console.error(
      'Usage: npm run admin:invite -- --email <address> --name "<full name>"',
    );
    process.exit(2);
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.error("APP_URL is not set. Aborting.");
    process.exit(1);
  }

  const result = await invite({ email: args.email, name: args.name });

  const url = `${appUrl.replace(/\/+$/, "")}/aktywacja?token=${result.rawToken}`;
  console.log(url);
  console.log(
    `\nWaży do: ${result.expiresAt.toISOString()} (7 dni od teraz). Link jest jednorazowy.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
