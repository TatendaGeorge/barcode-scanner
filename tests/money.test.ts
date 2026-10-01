import { describe, it, expect } from 'vitest';
import { formatRand, parseRandToCents, applyVat, changeDue } from '../src/lib/money';

describe('formatRand', () => {
  it('formats whole and fractional rand amounts', () => {
    expect(formatRand(1600)).toBe('R16.00');
    expect(formatRand(950)).toBe('R9.50');
    expect(formatRand(5)).toBe('R0.05');
    expect(formatRand(0)).toBe('R0.00');
  });
  it('formats negative amounts with a leading minus', () => {
    expect(formatRand(-950)).toBe('-R9.50');
  });
  it('groups thousands the way en-ZA formats numbers', () => {
    const expected = `R${(1234567).toLocaleString('en-ZA')}.00`;
    expect(formatRand(123456700)).toBe(expected);
  });
});

describe('parseRandToCents', () => {
  it('parses plain and R-prefixed amounts', () => {
    expect(parseRandToCents('16')).toBe(1600);
    expect(parseRandToCents('16.00')).toBe(1600);
    expect(parseRandToCents('R16.50')).toBe(1650);
    expect(parseRandToCents('9.5')).toBe(950);
  });
  it('rejects unparseable input', () => {
    expect(parseRandToCents('')).toBeNull();
    expect(parseRandToCents('abc')).toBeNull();
    expect(parseRandToCents('16.999')).toBeNull();
  });
});

describe('applyVat', () => {
  it('leaves cents unchanged when VAT is off', () => {
    expect(applyVat(1600, false)).toBe(1600);
  });
  it('adds 15% when VAT is on', () => {
    expect(applyVat(1600, true)).toBe(1840);
  });
});

describe('changeDue', () => {
  it('computes change for a cash tender', () => {
    expect(changeDue(4800, 5000)).toBe(200); // 3 cans at R16 = R48, tendered R50 -> R2 change
  });
  it('is negative when the tender is short', () => {
    expect(changeDue(4800, 4000)).toBe(-800);
  });
});
