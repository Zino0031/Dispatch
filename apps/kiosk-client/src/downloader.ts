import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function downloadDocument(
  url: string,
  destinationDir: string,
  jobId: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<string> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Document URL must use HTTP or HTTPS");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Document download failed with HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error("Document exceeds the configured size limit");
  }

  const body = await response.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > maxBytes) {
    throw new Error("Document is empty or exceeds the configured size limit");
  }

  await mkdir(destinationDir, { recursive: true });
  const extension = join(parsedUrl.pathname).match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ".document";
  const destination = join(destinationDir, `${jobId}${extension}`);
  await writeFile(destination, Buffer.from(body), { mode: 0o600 });
  return destination;
}