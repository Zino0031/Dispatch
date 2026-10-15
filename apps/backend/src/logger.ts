/** Minimal structured JSON logger (issue #14).
 * Every line carries kioskId/printJobId/event where available; token-ish
 * fields are redacted and must never appear in logs (docs/GUIDELINES.md). */

type Level = "info" | "warn" | "error";

const SENSITIVE = /token|secret|password|authorization/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Token-shaped values under sensitive keys are never logged; ids and
      // other routine values pass through for correlation (issue #14).
      out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>): void => emit("error", msg, fields),
};
