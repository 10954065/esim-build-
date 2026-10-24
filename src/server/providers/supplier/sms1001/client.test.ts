import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SupplierError } from "../errors";
import { Sms1001Client } from "./client";

function clientReturning(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { client: new Sms1001Client({ baseUrl: "https://api.test/v1", apiKey: "k_test", timeoutMs: 1000, fetchImpl }), calls };
}

async function errorOf(p: Promise<unknown>): Promise<SupplierError> {
  try {
    await p;
  } catch (e) {
    return e as SupplierError;
  }
  throw new Error("expected rejection");
}

const schema = z.object({ ok: z.boolean() });

describe("Sms1001Client", () => {
  it("sends the bearer key in a header (never the query string) and unwraps the envelope", async () => {
    const { client, calls } = clientReturning(200, { success: true, data: { ok: true } });
    await expect(client.request("GET", "/x", { schema, query: { a: 1 } })).resolves.toEqual({ ok: true });
    expect(new Headers(calls[0]!.init.headers).get("Authorization")).toBe("Bearer k_test");
    expect(calls[0]!.url).not.toContain("apiKey");
  });

  it.each([
    [400, "INVALID_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "UNAUTHORIZED"],
    [402, "INSUFFICIENT_BALANCE"],
    [404, "NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [502, "PROVIDER_FAILED"],
    [503, "UNAVAILABLE"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const { client } = clientReturning(status, { success: false, error: "nope" });
    const err = await errorOf(client.request("POST", "/x", { schema, mutating: true }));
    expect(err.kind).toBe(kind);
  });

  it("detects out-of-stock 400 responses", async () => {
    const { client } = clientReturning(400, { success: false, error: "No numbers available for this service" });
    expect((await errorOf(client.request("POST", "/x", { schema, mutating: true }))).kind).toBe("PRODUCT_UNAVAILABLE");
  });

  it("treats 500 on a mutating call as UNCERTAIN (order may exist)", async () => {
    const { client } = clientReturning(500, "oops");
    const err = await errorOf(client.request("POST", "/esims/order", { schema, mutating: true }));
    expect(err.kind).toBe("UNCERTAIN");
    expect(err.uncertain).toBe(true);
  });

  it("treats an unparseable success body on a mutating call as UNCERTAIN", async () => {
    const { client } = clientReturning(201, { success: true, data: { unexpected: 1 } });
    expect((await errorOf(client.request("POST", "/x", { schema, mutating: true }))).kind).toBe("UNCERTAIN");
  });

  it("treats network failures as UNCERTAIN for mutations and UNAVAILABLE for reads", async () => {
    const failing = new Sms1001Client({
      baseUrl: "https://api.test/v1",
      apiKey: "k",
      timeoutMs: 1000,
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    expect((await errorOf(failing.request("POST", "/x", { schema, mutating: true }))).kind).toBe("UNCERTAIN");
    expect((await errorOf(failing.request("GET", "/x", { schema }))).kind).toBe("UNAVAILABLE");
  });

  it("carries the 402 `required` amount", async () => {
    const { client } = clientReturning(402, { success: false, error: "Insufficient balance", required: 3.5 });
    const err = await errorOf(client.request("POST", "/x", { schema, mutating: true }));
    expect(err.details.required).toBe("3.5");
  });
});
