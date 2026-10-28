import { describe, it, expect } from '@jest/globals';
import { normalizeForPrinting } from './documentNormalizer.js';

describe('documentNormalizer', () => {
  it('should pass through non-DOC/DOCX files unchanged', async () => {
    const result = await normalizeForPrinting('/tmp/test.pdf');
    expect(result).toBe('/tmp/test.pdf');
  });

  it('should pass through non-DOC/DOCX files regardless of extension case', async () => {
    const result = await normalizeForPrinting('/tmp/test.JPG');
    expect(result).toBe('/tmp/test.JPG');
  });

  it('should pass through non-DOC/DOCX text files', async () => {
    const result = await normalizeForPrinting('/tmp/readme.txt');
    expect(result).toBe('/tmp/readme.txt');
  });
});
