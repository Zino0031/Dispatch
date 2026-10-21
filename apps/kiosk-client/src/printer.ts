import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PrintColor } from "./types.js";

const execFileAsync = promisify(execFile);

function extractRequestId(stdout: string): string {
  const match = stdout.match(/request id is\s+([^\s]+)/i);
  if (!match) throw new Error(`CUPS did not return a request ID: ${stdout.trim()}`);
  return match[1];
}

async function waitForCompletion(requestId: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { stdout } = await execFileAsync("lpstat", ["-W", "not-completed", "-l", "-o"], {
      timeout: 10_000,
    });
    const jobStart = stdout.indexOf(`${requestId} `);
    const active = jobStart >= 0;
    if (!active) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  try {
    await execFileAsync("cancel", [requestId], { timeout: 10_000 });
  } catch {
    // Preserve the original timeout when CUPS cannot cancel a failed USB job.
  }
  throw new Error(
    `PRINTER_USB_TIMEOUT: CUPS job ${requestId} did not complete within 30 seconds. Check the USB printer connection and CUPS error_log.`,
  );
}

async function requireDefaultPrinter(): Promise<void> {
  try {
    const { stdout } = await execFileAsync("lpstat", ["-d"], { timeout: 10_000 });
    const defaultLine = stdout.trim();
    if (
      !/^system default destination:\s*\S+/i.test(defaultLine) &&
      !/^system default destination is:\s*\S+/i.test(defaultLine)
    ) {
      throw new Error("CUPS has no default printer configured");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "CUPS has no default printer configured";
    throw new Error(
      message.includes("No destinations")
        ? "CUPS has no default printer configured"
        : message,
      { cause: error },
    );
  }
}

export async function printWithCups(
  filePath: string,
  options: {
    copies: number;
    color: PrintColor;
    duplex: boolean;
    jobId: string;
    pages?: string;
  },
): Promise<void> {
  await requireDefaultPrinter();
  const args = ["-t", `Print Kiosk ${options.jobId}`, "-n", String(options.copies)];
  // Only print the requested page range when the job specifies one; otherwise all pages.
  if (options.pages) {
    args.push("-o", `page-ranges=${options.pages}`);
  }
  // Avoid driver-specific ColorModel options; the default printer profile handles color.
  if (options.duplex) {
    args.push("-o", "sides=two-sided-long-edge");
  }
  args.push(filePath);

  try {
    const { stdout } = await execFileAsync("lp", args, { timeout: 30_000 });
    const requestId = extractRequestId(stdout);
    await waitForCompletion(requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CUPS rejected the print job";
    throw new Error(message, { cause: error });
  }
}