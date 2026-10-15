const PORT = Number(process.env.PORT ?? 4000);

const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isLocalhost = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const isPrivateLan = (origin: string): boolean => {
  const m = /^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.exec(origin);
  if (!m) return false;
  const [a, b] = m[1].split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

/** Allowlist + localhost + private-LAN origins (docs/OPERATIONS.md). */
export function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return true;
  return CORS_ORIGIN.includes(origin) || isLocalhost(origin) || isPrivateLan(origin);
}

export const config = { PORT, CORS_ORIGIN };
