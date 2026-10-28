import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

const printJobBodySchema = z.object({
  kioskId: z.string().min(1),
  fileUrl: z.string().url(),
  copies: z.number().int().min(1).max(50),
  color: z.enum(['bw', 'color']),
  duplex: z.boolean(),
  pages: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v?.trim()) return true;
        return /^\s*\d+(?:\s*-\s*\d+)?\s*(?:,\s*\d+(?:\s*-\s*\d+)?\s*)*$/.test(v ?? '');
      },
      { message: 'Use page ranges like 1-3, 5' },
    ),
});

describe('print job zod schema', () => {
  it('should accept a valid print job payload', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'bw',
      duplex: false,
    });
    expect(result.success).toBe(true);
  });

  it('should accept a valid payload with pages', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 2,
      color: 'color',
      duplex: true,
      pages: '1-3, 5',
    });
    expect(result.success).toBe(true);
  });

  it('should accept pages as empty string', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'bw',
      duplex: false,
      pages: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing kioskId', () => {
    const result = printJobBodySchema.safeParse({
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'bw',
      duplex: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid fileUrl', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'not-a-url',
      copies: 1,
      color: 'bw',
      duplex: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject copies less than 1', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 0,
      color: 'bw',
      duplex: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject copies greater than 50', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 51,
      color: 'bw',
      duplex: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid color', () => {
    const result = printJobBodySchema.safeParse({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'grayscale',
      duplex: false,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid page ranges', () => {
    const validRanges = ['1', '1-3', '1-3, 5', '5, 7-10', ' 1 , 3-5 ', '10'];
    for (const pages of validRanges) {
      const result = printJobBodySchema.safeParse({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
        pages,
      });
      expect(result.success).toBe(true, `Failed for pages: ${pages}`);
    }
  });

  it('should reject invalid page ranges', () => {
    const invalidRanges = ['abc', '1-3, abc', '-5', '1-3-5', '1,,3', '-1'];
    for (const pages of invalidRanges) {
      const result = printJobBodySchema.safeParse({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
        pages,
      });
      expect(result.success).toBe(false);
    }
  });
});
