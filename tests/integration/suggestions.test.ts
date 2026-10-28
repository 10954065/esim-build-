import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { destinationSuggestions, verificationCountrySuggestions } from "@/server/catalog/suggestions";
import { resetDatabase, seedPricingAndCatalog } from "./helpers";

describe("search suggestions", () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedPricingAndCatalog();
  });

  it("links every active eSIM destination to its page with its flag", async () => {
    const options = await destinationSuggestions();
    expect(options).toContainEqual({ label: "Spain", href: "/esims/spain", code: "ES", kind: "COUNTRY" });
    const region = options.find((o) => o.kind === "REGION");
    if (region) expect(region.hint).toBe("Region");
  });

  it("leaves out destinations staff have disabled", async () => {
    await db.esimDestination.update({ where: { slug: "spain" }, data: { isEnabled: false } });
    expect((await destinationSuggestions()).some((o) => o.href === "/esims/spain")).toBe(false);
    await db.esimDestination.update({ where: { slug: "spain" }, data: { isEnabled: true } });
  });

  it("links verification countries to their number pages", async () => {
    const us = await db.country.findUniqueOrThrow({ where: { code: "US" } });
    expect(await verificationCountrySuggestions()).toContainEqual({ label: us.name, href: `/verification/${us.slug}`, code: "US" });
  });
});
