declare module "mammoth/mammoth.browser" {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface MammothBrowser {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConversionResult>;
  }

  const mammoth: MammothBrowser;
  export default mammoth;
}
