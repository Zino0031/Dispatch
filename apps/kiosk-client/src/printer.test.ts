const { printFile } = require("./printer.ts");

describe("printer", () => {
  it("should export printFile function", () => {
    expect(typeof printFile).toBe("function");
  });
});
