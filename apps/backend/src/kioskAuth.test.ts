import { describe, it, expect } from '@jest/globals';
import { hashKioskToken, verifyKioskToken } from './kioskAuth';

describe('kioskAuth', () => {
  describe('hashKioskToken', () => {
    it('should generate a salt:hash string', () => {
      const hashed = hashKioskToken('my-secret-token');
      const parts = hashed.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBe(32);
      expect(parts[1].length).toBe(64);
    });

    it('should produce different hashes for the same token (random salt)', () => {
      const h1 = hashKioskToken('same-token');
      const h2 = hashKioskToken('same-token');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyKioskToken', () => {
    it('should verify a token against its own hash', () => {
      const hashed = hashKioskToken('secret-token-123');
      expect(verifyKioskToken('secret-token-123', hashed)).toBe(true);
    });

    it('should return false for a wrong token', () => {
      const hashed = hashKioskToken('correct-token');
      expect(verifyKioskToken('wrong-token', hashed)).toBe(false);
    });

    it('should return false for malformed stored hash', () => {
      expect(verifyKioskToken('any-token', 'not-a-hash')).toBe(false);
      expect(verifyKioskToken('any-token', '')).toBe(false);
      expect(verifyKioskToken('any-token', 'onlyonepart')).toBe(false);
    });
  });
});
