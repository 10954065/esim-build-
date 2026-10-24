import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEsim, getVerification } from "@/server/customer/queries";
import { encryptField } from "@/server/crypto";
import { db } from "@/server/db";
import { reencryptStoredData } from "@/server/key-rotation";
import { storeMessages } from "@/server/verification/service";
import { checkoutAndPay, drainJobs, resetDatabase, seedPricingAndCatalog } from "./helpers";

const saved = { current: process.env.DATA_ENCRYPTION_KEY, previous: process.env.DATA_ENCRYPTION_KEYS_PREVIOUS };
const oldKey = randomBytes(32).toString("base64");
const newKey = randomBytes(32).toString("base64");

describe("data encryption key rotation (real database)", () => {
  let esim: { userId: string; id: string };
  let sms: { userId: string; verificationId: string; id: string };

  beforeAll(async () => {
    process.env.DATA_ENCRYPTION_KEY = oldKey;
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = "";
    await resetDatabase();
    await seedPricingAndCatalog();
    const esimOrder = await checkoutAndPay({ supplierProductCode: "SBX-ES-1GB-7D" });
    const numberOrder = await checkoutAndPay({ type: "VERIFICATION", isActive: true, stockCount: { gt: 0 }, service: { slug: { not: "demo-fail" } } });
    await drainJobs();

    const e = await db.esimActivation.findFirstOrThrow({ where: { userId: esimOrder.user.id } });
    esim = { userId: e.userId, id: e.id };
    const v = await db.verificationActivation.findFirstOrThrow({ where: { userId: numberOrder.user.id } });
    await storeMessages({ verificationId: v.id, userId: v.userId, supplierId: v.supplierId }, [
      { supplierMessageId: "rotation-1", sender: "Google", text: "G-123456 is your code", code: "123456", receivedAt: new Date() },
    ]);
    const m = await db.incomingSmsMessage.findFirstOrThrow({ where: { verificationId: v.id } });
    sms = { userId: v.userId, verificationId: v.id, id: m.id };
  });

  afterAll(() => {
    process.env.DATA_ENCRYPTION_KEY = saved.current;
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = saved.previous ?? "";
  });

  it("moves every stored secret to the new key, stays readable throughout, and is safe to rerun", async () => {
    process.env.DATA_ENCRYPTION_KEY = newKey;
    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = oldKey;
    expect((await getEsim(esim.userId, esim.id))?.activationCode).toMatch(/^LPA:1\$/);

    // eSIM activation code + SMS body + SMS code (the sandbox eSIM has no QR URL). Batch size 1 exercises paging.
    expect(await reencryptStoredData(1)).toEqual({ scanned: 3, reencrypted: 3, unreadable: 0 });
    expect(await reencryptStoredData()).toEqual({ scanned: 3, reencrypted: 0, unreadable: 0 });

    process.env.DATA_ENCRYPTION_KEYS_PREVIOUS = "";
    expect((await getEsim(esim.userId, esim.id))?.activationCode).toMatch(/^LPA:1\$/);
    expect((await getVerification(sms.userId, sms.verificationId))?.messages[0]?.code).toBe("123456");
  });

  it("reports values no configured key can read and leaves them untouched", async () => {
    const stray = encryptField("lost", randomBytes(32));
    await db.incomingSmsMessage.update({ where: { id: sms.id }, data: { codeEnc: stray } });
    const r = await reencryptStoredData();
    expect(r.unreadable).toBe(1);
    expect((await db.incomingSmsMessage.findUniqueOrThrow({ where: { id: sms.id } })).codeEnc).toBe(stray);
  });
});
