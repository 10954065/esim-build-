/**
 * Re-encrypt stored activation codes and SMS with the current DATA_ENCRYPTION_KEY after a key
 * rotation. Run on a trusted machine with the production environment:
 *   DATA_ENCRYPTION_KEY=<new> DATA_ENCRYPTION_KEYS_PREVIOUS=<old> pnpm data:reencrypt
 * Safe to rerun. Remove the old key only when a run reports nothing left to re-encrypt.
 * Full procedure: docs/SECURITY.md, "Rotating the data encryption key".
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { reencryptStoredData } from "../src/server/key-rotation";

async function main() {
  const r = await reencryptStoredData();
  console.info(`Scanned ${r.scanned} encrypted values: ${r.reencrypted} re-encrypted, ${r.unreadable} unreadable.`);
  if (r.unreadable > 0) {
    console.error("Some values could not be decrypted with any configured key. Keep every old key configured and investigate before removing one.");
    process.exitCode = 2;
  } else if (r.reencrypted === 0) {
    console.info("Every stored value uses the current key. The previous key can be removed from DATA_ENCRYPTION_KEYS_PREVIOUS.");
  } else {
    console.info("Run once more to confirm nothing is left before removing the previous key.");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
