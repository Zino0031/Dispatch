import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OFFICE_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Convert DOC/DOCX via headless LibreOffice; pass everything else through. */
export async function normalizeDocument(tmpPath: string, mimeType: string): Promise<string> {
  const ext = path.extname(tmpPath).toLowerCase();
  const isOffice =
    OFFICE_MIMES.has(mimeType) || ext === ".doc" || ext === ".docx";
  if (!isOffice) return tmpPath;
  const outDir = fs.mkdtempSync(path.join(path.dirname(tmpPath), "conv-"));
  try {
    await execFileAsync(
      "soffice",
      ["--headless", "--convert-to", "pdf", "--outdir", outDir, tmpPath],
      { timeout: 120_000 },
    );
  } catch (e) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(
      `DOCUMENT_CONVERSION_FAILED: LibreOffice missing or failed (${e instanceof Error ? e.message.split("\n")[0] : e})`,
    );
  }
  const pdfs = fs.readdirSync(outDir).filter((f) => f.endsWith(".pdf"));
  if (pdfs.length === 0) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error("DOCUMENT_CONVERSION_FAILED: no PDF produced");
  }
  const converted = path.join(path.dirname(tmpPath), `${path.basename(tmpPath)}.pdf`);
  fs.renameSync(path.join(outDir, pdfs[0]), converted);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(tmpPath, { force: true });
  return converted;
}
