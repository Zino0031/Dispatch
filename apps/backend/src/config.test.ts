import { describe, it, expect } from '@jest/globals';
import { isAllowedCorsOrigin } from './config';

describe('config', () => {
  describe('isAllowedCorsOrigin', () => {
    it('should allow undefined origin', () => {
      expect(isAllowedCorsOrigin(undefined)).toBe(true);
    });

    it('should allow localhost', () => {
      expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedCorsOrigin('http://localhost:4000')).toBe(true);
    });

    it('should allow 127.0.0.1', () => {
      expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(true);
    });

    it('should allow private IPv4 addresses', () => {
      expect(isAllowedCorsOrigin('http://192.168.1.50:4000')).toBe(true);
      expect(isAllowedCorsOrigin('http://10.0.0.1:4000')).toBe(true);
      expect(isAllowedCorsOrigin('http://172.16.0.1:4000')).toBe(true);
    });

    it('should reject public non-private origins not in allowlist', () => {
      expect(isAllowedCorsOrigin('http://evil.com:4000')).toBe(false);
      expect(isAllowedCorsOrigin('https://google.com')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isAllowedCorsOrigin('not-a-url')).toBe(false);
    });
  });
});
