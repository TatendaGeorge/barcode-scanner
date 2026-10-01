import { describe, it, expect } from 'vitest';
import { isValidCheckDigit, checkDigitFor, withCheckDigit, generateInternalBarcode, isInternalBarcode } from '../src/lib/ean13';

describe('isValidCheckDigit', () => {
  it('accepts a real, valid EAN-13', () => {
    expect(isValidCheckDigit('6001234500018')).toBe(true); // Koo Baked Beans demo code
  });
  it('rejects a tampered check digit', () => {
    expect(isValidCheckDigit('6001234500011')).toBe(false);
  });
  it('returns null for the wrong length or non-digits', () => {
    expect(isValidCheckDigit('123')).toBeNull();
    expect(isValidCheckDigit('abcdefghijklm')).toBeNull();
  });
});

describe('checkDigitFor / withCheckDigit', () => {
  it('computes the digit that makes the code valid', () => {
    const partial = '600123450001';
    const code = withCheckDigit(partial);
    expect(code).toBe('6001234500018');
    expect(isValidCheckDigit(code)).toBe(true);
    expect(checkDigitFor(partial)).toBe(8);
  });
});

describe('generateInternalBarcode', () => {
  it('generates a valid, 20-29-prefixed code not already in use', () => {
    const existing = new Set(['2000000000003']);
    const code = generateInternalBarcode(existing);
    expect(code).toHaveLength(13);
    expect(code[0]).toBe('2');
    expect(isValidCheckDigit(code)).toBe(true);
    expect(existing.has(code)).toBe(false);
    expect(isInternalBarcode(code)).toBe(true);
  });
});
