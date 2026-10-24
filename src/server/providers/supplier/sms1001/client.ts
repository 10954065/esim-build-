import type { z } from "zod";
import { logger } from "@/server/logger";
import { SupplierError, type SupplierErrorKind } from "../errors";
import { envelope, errorEnvelope } from "./schemas";

/**
 * Thin HTTP client for the 1001SMS Reseller API v2.
 * - Auth: `Authorization: Bearer <key>` (never the query-string form).
 * - Every response is validated; unexpected shapes become INVALID_RESPONSE, or
 *   UNCERTAIN for mutating calls (the supplier may have executed them).
 */

export interface Sms1001ClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

type Method = "GET" | "POST" | "PUT" | "PATCH";

interface RequestOptions<S extends z.ZodTypeAny> {
  schema: S;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  /** Mutating calls that create or change supplier state (orders, cancels). */
  mutating?: boolean;
}

const log = logger.child({ component: "sms1001-client" });

function statusToKind(status: number, mutating: boolean, message: string): SupplierErrorKind {
  if (status === 400) {
    return /stock|no numbers|unavailable|not available|sold out/i.test(message) ? "PRODUCT_UNAVAILABLE" : "INVALID_REQUEST";
  }
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 402) return "INSUFFICIENT_BALANCE";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  // Documented: "502 provider failed (charge refunded)" — a definite, retryable failure.
  if (status === 502) return "PROVIDER_FAILED";
  if (status === 503) return "UNAVAILABLE";
  if (status >= 500) return mutating ? "UNCERTAIN" : "UNAVAILABLE";
  return "INVALID_REQUEST";
}

export class Sms1001Client {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: Sms1001ClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async request<S extends z.ZodTypeAny>(method: Method, path: string, opts: RequestOptions<S>): Promise<z.output<S>> {
    const mutating = opts.mutating ?? false;
    const url = new URL(this.config.baseUrl.replace(/\/$/, "") + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: "no-store",
      });
    } catch (cause) {
      const kind: SupplierErrorKind = mutating ? "UNCERTAIN" : "UNAVAILABLE";
      log.warn("supplier request failed before response", { method, path, kind, durationMs: Date.now() - started });
      throw new SupplierError(kind, "Supplier request did not complete (network error or timeout)", { cause });
    }

    const durationMs = Date.now() - started;
    let json: unknown = null;
    const text = await response.text().catch(() => "");
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const parsedErr = errorEnvelope.safeParse(json);
      const message = parsedErr.success && parsedErr.data.error ? parsedErr.data.error : `HTTP ${response.status}`;
      const kind = statusToKind(response.status, mutating, message);
      log.warn("supplier request rejected", { method, path, status: response.status, kind, durationMs });
      throw new SupplierError(kind, message.slice(0, 300), {
        httpStatus: response.status,
        details: parsedErr.success && parsedErr.data.required !== undefined ? { required: String(parsedErr.data.required) } : {},
      });
    }

    const parsed = envelope(opts.schema).safeParse(json);
    if (!parsed.success) {
      log.error("supplier response failed validation", {
        method,
        path,
        status: response.status,
        issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
      });
      throw new SupplierError(
        mutating ? "UNCERTAIN" : "INVALID_RESPONSE",
        "Supplier response did not match the documented format",
        { httpStatus: response.status },
      );
    }
    log.debug("supplier request ok", { method, path, status: response.status, durationMs });
    return (parsed.data as { data: z.output<S> }).data;
  }
}
