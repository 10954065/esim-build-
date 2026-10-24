import "server-only";
import { z } from "zod";
import { db } from "@/server/db";

/**
 * Typed, non-secret runtime settings stored in SystemSetting. Admins can change these
 * without a deploy. Secrets never live here — they stay in environment variables.
 */

export const SETTINGS = {
  "pricing.fxMaxAgeHours": { schema: z.number().int().min(1).max(24 * 30), default: 24, label: "Max exchange-rate age (hours)" },
  "catalog.esimPackagesTtlMinutes": { schema: z.number().int().min(5).max(10080), default: 360, label: "eSIM package refresh interval (minutes)" },
  "catalog.offersTtlMinutes": { schema: z.number().int().min(1).max(1440), default: 10, label: "Verification/rental offer refresh interval (minutes)" },
  "orders.paymentWindowMinutes": { schema: z.number().int().min(5).max(1440), default: 60, label: "Unpaid order expiry (minutes)" },
  "verification.autoRefundOnExpiry": { schema: z.boolean(), default: true, label: "Auto-refund expired activations with no SMS (after supplier refund)" },
  "rentals.reminderHoursBefore": { schema: z.number().int().min(1).max(168), default: 24, label: "Rental expiry reminder (hours before)" },
  "limits.maxOrdersPerUserPerDay": { schema: z.number().int().min(1).max(1000), default: 20, label: "Max orders per customer per day" },
  "limits.maxActiveVerificationsPerUser": { schema: z.number().int().min(1).max(100), default: 5, label: "Max concurrent verification sessions per customer" },
  "store.purchasesEnabled": { schema: z.boolean(), default: true, label: "Accept new purchases" },
  "store.announcement": { schema: z.string().max(280), default: "", label: "Site-wide announcement (empty to hide)" },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  const def = SETTINGS[key];
  if (!row) return def.default as SettingValue<K>;
  const parsed = def.schema.safeParse(row.value);
  return (parsed.success ? parsed.data : def.default) as SettingValue<K>;
}

export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  const rows = await db.systemSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingKey, unknown>;
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    const parsed = SETTINGS[key].schema.safeParse(byKey.get(key));
    out[key] = parsed.success ? parsed.data : SETTINGS[key].default;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(key: K, value: unknown, updatedById: string): Promise<SettingValue<K>> {
  const parsed = SETTINGS[key].schema.parse(value) as SettingValue<K>;
  await db.systemSetting.upsert({
    where: { key },
    update: { value: parsed as never, updatedById },
    create: { key, value: parsed as never, updatedById },
  });
  return parsed;
}
