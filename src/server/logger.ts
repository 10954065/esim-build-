/**
 * Minimal structured JSON logger with recursive redaction.
 * Sensitive values (OTP codes, SMS text, activation codes, phone numbers, secrets)
 * are never written to logs. Safe to import from server code and scripts.
 */

type Level = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const REDACT_KEYS = [
  "password",
  "secret",
  "token",
  "authorization",
  "apikey",
  "activationcode",
  "lpa",
  "qrcodeurl",
  "code",
  "message",
  "text",
  "body",
  "phonenumber",
  "phone",
  "iccid",
  "cookie",
  "email",
  "to",
];

function normalize(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, "");
}

function shouldRedact(key: string): boolean {
  const k = normalize(key);
  return REDACT_KEYS.some((r) => k === r || (r.length > 3 && k.endsWith(r)));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shouldRedact(k) && v !== null && v !== undefined ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  return { error: String(err) };
}

function write(level: Level, msg: string, fields: LogFields): void {
  if (process.env.LOG_SILENT === "1") return;
  if (level === "debug" && process.env.LOG_LEVEL !== "debug") return;
  const { err, ...rest } = fields;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(redact(rest) as LogFields),
    ...(err !== undefined ? serializeError(err) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export function createLogger(base: LogFields = {}): Logger {
  return {
    debug: (msg, f = {}) => write("debug", msg, { ...base, ...f }),
    info: (msg, f = {}) => write("info", msg, { ...base, ...f }),
    warn: (msg, f = {}) => write("warn", msg, { ...base, ...f }),
    error: (msg, f = {}) => write("error", msg, { ...base, ...f }),
    child: (f) => createLogger({ ...base, ...f }),
  };
}

export const logger = createLogger({ service: "marketplace" });

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
