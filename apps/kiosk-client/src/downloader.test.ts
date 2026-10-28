import { describe, it, expect } from '@jest/globals';
import { downloadDocument } from './downloader';

describe('downloader', () => {
  const testUrl = 'https://example.com/document.pdf';
  const tempDir = '/tmp/kiosk-test';
  const jobId = 'test-job-123';

  describe('URL validation', () => {
    it('should reject non-HTTP(S) URLs', async () => {
      await expect(
        downloadDocument('ftp://example.com/file.pdf', tempDir, jobId, 50 * 1024 * 1024, 60000),
      ).rejects.toThrow('Document URL must use HTTP or HTTPS');

      await expect(
        downloadDocument('file:///etc/passwd', tempDir, jobId, 50 * 1024 * 1024, 60000),
      ).rejects.toThrow('Document URL must use HTTP or HTTPS');
    });
  });
});
