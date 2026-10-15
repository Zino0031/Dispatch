import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseKioskCredentials(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("KIOSK_CREDENTIALS must be a JSON object of kioskId → token");
    }

    const credentials: Record<string, string> = {};
    for (const [kioskId, token] of Object.entries(parsed)) {
      if (typeof token !== "string" || token.length === 0) {
        throw new Error(`Invalid token for kiosk "${kioskId}"`);
      }
      credentials[kioskId] = token;
    }
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("KIOSK_CREDENTIALS must be valid JSON");
    }
    throw error;
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:4000",
  corsOrigin: required("CORS_ORIGIN", "http://localhost:3000"),
  adminToken: required("ADMIN_TOKEN", "dev-admin-token-change-me"),
  kioskEnrollmentToken: required(
    "KIOSK_ENROLLMENT_TOKEN",
    "dev-enrollment-token-change-me",
  ),
  autoEnrollKiosks: process.env.AUTO_ENROLL_KIOSKS === "true",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "print-documents",
  printDocumentRetentionHours: Number(
    process.env.PRINT_DOCUMENT_RETENTION_HOURS ?? 24,
  ),
};

if (
  config.supabaseServiceRoleKey &&
  config.supabaseServiceRoleKey.startsWith("sb_publishable_")
) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY contains a publishable key. Use the server-only secret key from Supabase Project Settings > API.",
  );
}

const extraCorsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;
  const [a, b] = octets;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (extraCorsOrigins.includes(origin)) return true;
  try {
    const hostname = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
    return isPrivateIPv4(hostname);
  } catch {
    return false;
  }
}

export function kioskRoom(kioskId: string): string {
  return `kiosk:${kioskId}`;
}

export function jobRoom(printJobId: string): string {
  return `job:${printJobId}`;
}
