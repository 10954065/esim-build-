import { describe, expect, it } from "vitest";
import { suggest, type SuggestOption } from "./suggest";

const opt = (label: string, code: string | null = null): SuggestOption => ({ label, href: `/x/${label.toLowerCase()}`, code });

const OPTIONS = [
  opt("Spain", "ES"),
  opt("South Africa", "ZA"),
  opt("United Kingdom", "GB"),
  opt("United States", "US"),
  opt("United Arab Emirates", "AE"),
  opt("Côte d'Ivoire", "CI"),
  opt("Europe (33 areas)"),
  opt("Ghana", "GH"),
  opt("Afghanistan", "AF"),
];

const labels = (q: string, limit?: number) => suggest(OPTIONS, q, limit).map((o) => o.label);

describe("suggest", () => {
  it("returns nothing for an empty or blank query", () => {
    expect(labels("")).toEqual([]);
    expect(labels("   ")).toEqual([]);
  });

  it("ranks names that start with the query before names that only contain it", () => {
    expect(labels("af")).toEqual(["Afghanistan", "South Africa"]);
  });

  it("matches the start of any word", () => {
    expect(labels("arab")).toEqual(["United Arab Emirates"]);
    expect(labels("king")).toEqual(["United Kingdom"]);
  });

  it("ignores case and accents", () => {
    expect(labels("COTE")).toEqual(["Côte d'Ivoire"]);
    expect(labels("côte d")).toEqual(["Côte d'Ivoire"]);
  });

  it("matches ISO codes and common short names", () => {
    expect(labels("gh")[0]).toBe("Ghana");
    expect(labels("uk")).toEqual(["United Kingdom"]);
    expect(labels("usa")).toEqual(["United States"]);
    expect(labels("uae")).toEqual(["United Arab Emirates"]);
  });

  it("keeps regional destinations searchable by name", () => {
    expect(labels("euro")).toEqual(["Europe (33 areas)"]);
  });

  it("caps the number of suggestions", () => {
    expect(labels("a", 3)).toHaveLength(3);
  });
});
