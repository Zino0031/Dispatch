const { normalizeForPrinting } = require("./documentNormalizer.ts");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { writeFile } = require("node:fs/promises");

describe("documentNormalizer", () => {
  it("should pass through non-DOC/DOCX files unchanged", async () => {
    const pdfPath = join(tmpdir(), "test.pdf");
    await writeFile(pdfPath, "%PDF-1.4 test");

    const result = await normalizeForPrinting(pdfPath);
    expect(result).toBe(pdfPath);
  });

  it("should pass through non-DOC/DOCX files regardless of extension case", async () => {
    const jpgPath = join(tmpdir(), "image.JPG");
    await writeFile(jpgPath, "fake-jpg");

    const result = await normalizeForPrinting(jpgPath);
    expect(result).toBe(jpgPath);
  });

  it("should pass through non-DOC/DOCX text files", async () => {
    const txtPath = join(tmpdir(), "readme.txt");
    await writeFile(txtPath, "hello world");

    const result = await normalizeForPrinting(txtPath);
    expect(result).toBe(txtPath);
  });
});
