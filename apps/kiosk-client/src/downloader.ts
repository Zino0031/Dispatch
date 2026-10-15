import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { config } from "./config.js";
import { freeBytes } from "./disk.js";

/**
 * Capped HTTP(S) download → temp file mode 0o600 (docs/GUIDELINES.md).
 * HTTP/S only, redirect: "error", honors MAX_DOWNLOAD_BYTES +
 * DOWNLOAD_TIMEOUT_MS. Caller deletes the file in `finally` (both raw and
 * converted paths). Pre-checks disk space so a full disk fails fast with a
 * human message instead of a partial file.
 */
export async function downloadFile(fileUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    throw new Error("DOCUMENT_DOWNLOAD_FAILED: not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("DOCUMENT_DOWNLOAD_FAILED: only HTTP(S) download is supported");
  }

  fs.mkdirSync(config.tempDir, { recursive: true });
  if (freeBytes(config.tempDir) < config.maxDownloadBytes + 8 * 1024 * 1024) {
    throw new Error("Kiosk is low on disk space — free space and resend the job");
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), config.downloadTimeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "error",
      // Kiosk credential headers for the token-gated file proxy (issue #10).
      headers: { "x-kiosk-id": config.kioskId, "x-kiosk-token": config.kioskToken },
    });
  } catch (e) {
    throw new Error(
      `DOCUMENT_DOWNLOAD_FAILED: ${e instanceof Error ? e.message : "fetch failed"}`,
      { cause: e },
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok || !res.body) {
    throw new Error(`DOCUMENT_DOWNLOAD_FAILED: backend responded ${res.status}`);
  }

  const dest = path.join(config.tempDir, `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}.bin`);
  const out = createWriteStream(dest, { mode: 0o600 });
  let bytes = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > config.maxDownloadBytes) {
        throw new Error("DOCUMENT_DOWNLOAD_FAILED: file exceeds 50 MB limit");
      }
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    out.end();
    await finished(out);
  } catch (e) {
    out.destroy();
    fs.rmSync(dest, { force: true });
    throw e;
  }
  return dest;
}

/** Best-effort cleanup — temp dir must be empty after success AND failure. */
export function removeTempFile(p: string): void {
  fs.rmSync(p, { force: true });
}
