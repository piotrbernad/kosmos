import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password || !name) {
    console.error(
      "Missing ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in environment.",
    );
    process.exit(1);
  }

  const existing = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].role !== "admin") {
      await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
      console.log(`Promoted existing user ${email} to admin.`);
    } else {
      console.log(`Admin ${email} already exists — nothing to do.`);
    }
    process.exit(0);
  }

  await auth.api.signUpEmail({ body: { email, password, name } });
  await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
  console.log(`Seeded admin ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
