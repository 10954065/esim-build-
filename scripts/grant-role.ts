/**
 * Grant a staff role to an existing, verified account. Run on a trusted machine:
 *   pnpm admin:grant user@example.com admin
 * Roles: user | support | finance | admin. The change is audit-logged and signs the user out.
 */
import "dotenv/config";
import { db } from "../src/server/db";

const ROLES = ["user", "support", "finance", "admin"] as const;

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
    console.error("Usage: pnpm admin:grant <email> <user|support|finance|admin>");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error(`No account for ${email}. The person must register first.`);
  if (!user.emailVerified) throw new Error("The account email is not verified yet.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: role as (typeof ROLES)[number] } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({ data: { actorId: null, actorRole: "cli", action: "user.role_changed", entityType: "user", entityId: user.id, reason: "Granted via CLI", metadata: { from: user.role, to: role } } }),
  ]);
  console.info(`${email} is now ${role}. Staff must enable two-factor authentication before using /admin in production.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
