// EAN-13/UPC/ITF check-digit validation (ported from the original scanner page) and an
// internal in-store barcode generator using the GS1 "restricted circulation" 20-29 prefix
// range, which is reserved for internal use and never clashes with a real retail barcode.

export function isValidCheckDigit(code: string): boolean | null {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return null;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

export function checkDigitFor(partial: string): number {
  const digits = partial.split('').map(Number);
  let sum = 0;
  digits.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

export function withCheckDigit(partial12: string): string {
  return partial12 + checkDigitFor(partial12);
}

/**
 * Generates a fresh internal EAN-13 in the 20xxxxxxxxxxC range. Tries sequential bodies
 * starting from a number derived from the current time so repeated calls in the same
 * session don't collide, then falls back to random if that's somehow already taken.
 */
export function generateInternalBarcode(existing: Set<string>): string {
  const prefix = '20';
  let seed = Date.now() % 10_000_000_000;
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const body = String((seed + attempt) % 10_000_000_000).padStart(10, '0');
    const partial = prefix + body;
    const code = withCheckDigit(partial);
    if (!existing.has(code)) return code;
  }
  // Astronomically unlikely fallback.
  const body = String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
  return withCheckDigit(prefix + body);
}

export function isInternalBarcode(code: string): boolean {
  return /^2\d/.test(code) && code.length === 13;
}
