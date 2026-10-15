import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function normalizeForPrinting(filePath: string): Promise<string> {
  const extension = extname(filePath).toLowerCase();
  if (extension !== ".doc" && extension !== ".docx") return filePath;

  const outputDirectory = dirname(filePath);
  try {
    await execFileAsync("libreoffice", [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDirectory,
      filePath,
    ], { timeout: 60_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LibreOffice conversion failed";
    throw new Error(`DOCUMENT_CONVERSION_FAILED: install LibreOffice to print DOC/DOCX files (${message})`, { cause: error });
  }

  const pdfPath = join(outputDirectory, `${basename(filePath, extension)}.pdf`);
  try {
    await access(pdfPath);
  } catch {
    throw new Error("DOCUMENT_CONVERSION_FAILED: LibreOffice did not create a PDF");
  }
  return pdfPath;
}