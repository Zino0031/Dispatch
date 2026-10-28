import { describe, it, expect } from '@jest/globals';
import { printWithCups } from './printer';

describe('printer', () => {
  it('should export printWithCups function', () => {
    expect(typeof printWithCups).toBe('function');
  });
});
