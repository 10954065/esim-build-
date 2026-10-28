import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { refreshExchangeRate } from "@/server/pricing/fx-refresh";
import { getFreshRate } from "@/server/pricing/service";
import { createUser, resetDatabase } from "./helpers";

const PUBLISHED = 1793145751;

function feedFetch(ghs: number) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ result: "success", base_code: "USD", time_last_update_unix: PUBLISHED, rates: { USD: 1, GHS: ghs } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("automatic exchange rate refresh", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("stores the feed rate as an automatic rate that pricing then uses", async () => {
    const fetchImpl = feedFetch(11.643541);
    const result = await refreshExchangeRate({ base: "USD", quote: "GHS", fetchImpl });

    expect(result).toMatchObject({ status: "updated", rate: "11.643541" });
    expect(fetchImpl).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/USD", expect.anything());
    const row = await db.exchangeRate.findFirstOrThrow({ where: { baseCurrency: "USD", quoteCurrency: "GHS" } });
    expect(row.createdById).toBeNull();
    expect(row.source).toContain("exchangerate-api.com");
    expect((await getFreshRate("USD", "GHS"))?.rate).toBe("11.643541");
  });

  it("leaves a fresh rate entered by staff alone", async () => {
    const admin = await createUser({ role: "admin" });
    await db.exchangeRate.create({ data: { baseCurrency: "USD", quoteCurrency: "GHS", rate: "12.00", source: "manual", createdById: admin.id } });
    const fetchImpl = feedFetch(11.64);

    expect(await refreshExchangeRate({ base: "USD", quote: "GHS", fetchImpl })).toMatchObject({ status: "skipped", reason: "manual-override" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await getFreshRate("USD", "GHS"))?.rate).toBe("12");
  });

  it("refuses an implausible jump and keeps the previous rate", async () => {
    await db.exchangeRate.create({ data: { baseCurrency: "USD", quoteCurrency: "GHS", rate: "11.64", source: "exchangerate-api.com" } });

    await expect(refreshExchangeRate({ base: "USD", quote: "GHS", fetchImpl: feedFetch(116.4) })).rejects.toThrow(/implausible/i);
    expect(await db.exchangeRate.count()).toBe(1);
    expect((await getFreshRate("USD", "GHS"))?.rate).toBe("11.64");
  });

  it("stores nothing when the feed is down", async () => {
    const fetchImpl = vi.fn(async () => new Response("Service Unavailable", { status: 503 }));
    await expect(refreshExchangeRate({ base: "USD", quote: "GHS", fetchImpl })).rejects.toThrow(/503/);
    expect(await db.exchangeRate.count()).toBe(0);
  });

  it("does nothing when supplier and checkout currencies match", async () => {
    const fetchImpl = feedFetch(1);
    expect(await refreshExchangeRate({ base: "USD", quote: "USD", fetchImpl })).toMatchObject({ status: "skipped", reason: "same-currency" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
