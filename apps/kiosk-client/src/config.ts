import fs from "node:fs";
import path from "node:path";
import { getHardwareId } from "./identity.js";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const KIOSK_TOKEN_FILE = env("KIOSK_TOKEN_FILE", ".kiosk-token");

function loadToken(): string {
  if (process.env.KIOSK_TOKEN) return process.env.KIOSK_TOKEN;
  try {
    return fs.readFileSync(KIOSK_TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

/** Persist auto-enrolled token with mode 0o600 (docs/SOCKET_PROTOCOL.md). Never logged. */
export function saveToken(token: string): void {
  const dir = path.dirname(KIOSK_TOKEN_FILE);
  if (dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KIOSK_TOKEN_FILE, token, { mode: 0o600 });
}

export const config = {
  serverUrl: env("SERVER_URL", "http://localhost:4000"),
  kioskId: env("KIOSK_ID") || getHardwareId(),
  get kioskToken(): string {
    return loadToken();
  },
  tokenFile: KIOSK_TOKEN_FILE,
  tempDir: env("TEMP_DIR", "./temp"),
  maxDownloadBytes: Number(env("MAX_DOWNLOAD_BYTES", String(50 * 1024 * 1024))),
  downloadTimeoutMs: Number(env("DOWNLOAD_TIMEOUT_MS", "60000")),
  // DRY_RUN simulates the print pipeline (real CUPS/LibreOffice path lands in #6-8).
  dryRun: env("DRY_RUN", "true") !== "false",
};
