import "server-only";
import { db, type Tx } from "@/server/db";

/**
 * In-app notifications, created only from confirmed server-side state changes. Bodies never
 * contain OTP codes, SMS text or activation details.
 */
export async function notify(
  client: Tx | typeof db,
  input: { userId: string; type: string; title: string; body: string; link?: string; dedupeKey?: string },
): Promise<void> {
  await client.notification.createMany({
    data: [{ userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null, dedupeKey: input.dedupeKey ?? null }],
    skipDuplicates: true,
  });
}
