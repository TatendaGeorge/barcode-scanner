// All money is stored and passed around as integer cents. Never use floats for money.

export const VAT_RATE = 0.15;

export function formatRand(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const rand = Math.floor(abs / 100);
  const c = abs % 100;
  return `${sign}R${rand.toLocaleString('en-ZA')}.${String(c).padStart(2, '0')}`;
}

/** Parses a "12.50" / "12" / "R12,50" style user input into integer cents. Returns null if not parseable. */
export function parseRandToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^R/i, '').replace(/,/g, '.').replace(/\s/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2)) * (whole.startsWith('-') ? -1 : 1);
  return Number.isFinite(cents) ? Math.round(cents) : null;
}

export function applyVat(cents: number, vatOn: boolean, rate = VAT_RATE): number {
  return vatOn ? Math.round(cents * (1 + rate)) : cents;
}

/** Cash tender vs a total due, both in cents. Negative means short. */
export function changeDue(totalCents: number, tenderedCents: number): number {
  return tenderedCents - totalCents;
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
