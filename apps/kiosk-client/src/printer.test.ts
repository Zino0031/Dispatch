import { describe, it, expect } from '@jest/globals';
import { printWithCups } from './printer.js';

describe('printer', () => {
  it('should export printWithCups function', () => {
    expect(typeof printWithCups).toBe('function');
  });
});
