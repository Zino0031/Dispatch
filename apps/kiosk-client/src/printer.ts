import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CupsHealth {
  reachable: boolean;
  defaultDestination: string | null;
  detail: string;
}

/** CUPS probe: lpstat must run AND the destination must exist. With a routed
 * printer name, that printer is checked (`lpstat -p`); otherwise the system
 * default is required (PRINTER_NO_DEFAULT_DESTINATION). */
export async function checkCups(printer?: string): Promise<CupsHealth> {
  try {
    if (printer) {
      const { stdout } = await execFileAsync("lpstat", ["-p", printer], { timeout: 10_000 });
      if (/unknown|not found|disabled/i.test(stdout) && !/is idle|is printing|enabled/i.test(stdout)) {
        return {
          reachable: true,
          defaultDestination: null,
          detail: `PRINTER_OFFLINE: ${printer} not ready — ${stdout.trim().split("\n")[0]}`,
        };
      }
      return { reachable: true, defaultDestination: printer, detail: `printer: ${printer}` };
    }
    const { stdout } = await execFileAsync("lpstat", ["-d"], { timeout: 10_000 });
    const m = /system default destination:\s*(.+)/i.exec(stdout);
    const dest = m?.[1]?.trim() ?? null;
    if (!dest || /^\(?no/i.test(dest)) {
      return {
        reachable: true,
        defaultDestination: null,
        detail: "PRINTER_NO_DEFAULT_DESTINATION: set one with `lpadmin -d <printer>`",
      };
    }
    return { reachable: true, defaultDestination: dest, detail: `default: ${dest}` };
  } catch (e) {
    return {
      reachable: false,
      defaultDestination: null,
      detail: `CUPS unreachable: ${e instanceof Error ? e.message.split("\n")[0] : e}`,
    };
  }
}

/** Print via `lp` with job title + copies + optional duplex (no driver color flags).
 * Routed jobs print with `-d <printer>` (issue #19). */
export async function printFile(
  file: string,
  opts: { title: string; copies: number; duplex: boolean; printer?: string },
): Promise<string> {
  const args = [...(opts.printer ? ["-d", opts.printer] : []), "-t", opts.title, "-n", String(opts.copies)];
  if (opts.duplex) args.push("-o", "sides=two-sided-long-edge");
  args.push(file);
  const { stdout } = await execFileAsync("lp", args, { timeout: 30_000 });
  const m = /request id is\s+(\S+)/i.exec(stdout);
  if (!m) throw new Error(`PRINTER_COMMAND_FAILED: unexpected lp output: ${stdout.trim()}`);
  return m[1];
}

/** Poll `lpstat` every 2 s up to 30 s; attempt `cancel` on timeout. */
export async function waitForCompletion(requestId: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const { stdout } = await execFileAsync("lpstat", ["-o"], { timeout: 10_000 });
      const pending = stdout.split("\n").some((line) => line.includes(requestId));
      if (!pending) return;
    } catch {
      return; // lpstat itself failing mid-poll: treat as completed, kiosk reports status.
    }
    if (Date.now() > deadline) {
      try {
        await execFileAsync("cancel", [requestId], { timeout: 10_000 });
      } catch {
        // Best effort — report the timeout regardless.
      }
      throw new Error("PRINTER_USB_TIMEOUT: print job did not complete in 30 s, cancelled");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
