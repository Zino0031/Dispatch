import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getHardwareId } from "./identity.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const tokenFile = resolve(process.env.KIOSK_TOKEN_FILE ?? ".kiosk-token");
const storedToken = await readFile(tokenFile, "utf8")
  .then((contents) => contents.trim())
  .catch(() => "");

export const config = {
  serverUrl: required("SERVER_URL"),
  kioskId: process.env.KIOSK_ID?.trim() || getHardwareId(),
  kioskToken: process.env.KIOSK_TOKEN?.trim() || storedToken,
  tokenFile,
  tempDir: process.env.TEMP_DIR ?? "./temp",
  maxDownloadBytes: Number(process.env.MAX_DOWNLOAD_BYTES ?? 50 * 1024 * 1024),
  downloadTimeoutMs: Number(process.env.DOWNLOAD_TIMEOUT_MS ?? 60_000),
};