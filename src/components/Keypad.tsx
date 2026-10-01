import { formatRand } from '../lib/money';

const DIGIT_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['00', '0', '@'],
];

interface KeypadProps {
  /** Cents typed on the pad so far (controlled). */
  amountCents: number;
  onAmountChange: (cents: number) => void;
  quickAmountsCents: number[];
  onCash: () => void;
  onCard: () => void;
  onOther: () => void;
  disabled?: boolean;
}

export function Keypad({ amountCents, onAmountChange, quickAmountsCents, onCash, onCard, onOther, disabled }: KeypadProps) {
  function pressDigit(d: string) {
    if (d === '@') return; // reserved key on the reference layout; no-op here
    const digits = d === '00' ? '00' : d;
    const next = Number(String(amountCents) + digits);
    onAmountChange(next);
  }
  function clear() {
    onAmountChange(0);
  }
  function backspace() {
    onAmountChange(Math.floor(amountCents / 10));
  }

  return (
    <div class="keypad">
      <div class="keypad-display">
        <button type="button" class="keypad-clear" aria-label="Clear amount" onClick={clear}>
          ×
        </button>
        <span class="keypad-amount money">{formatRand(amountCents)}</span>
      </div>

      <div class="keypad-grid">
        {DIGIT_ROWS[0].map((d) => (
          <button key={d} type="button" class="keypad-key" onClick={() => pressDigit(d)}>{d}</button>
        ))}
        {quickAmountsCents.slice(0, 2).map((c) => (
          <button key={c} type="button" class="keypad-key quick" onClick={() => onAmountChange(c)}>{formatRand(c)}</button>
        ))}

        {DIGIT_ROWS[1].map((d) => (
          <button key={d} type="button" class="keypad-key" onClick={() => pressDigit(d)}>{d}</button>
        ))}
        {quickAmountsCents.slice(2, 4).map((c) => (
          <button key={c} type="button" class="keypad-key quick" onClick={() => onAmountChange(c)}>{formatRand(c)}</button>
        ))}

        {DIGIT_ROWS[2].map((d) => (
          <button key={d} type="button" class="keypad-key" onClick={() => pressDigit(d)}>{d}</button>
        ))}
        <button type="button" class="keypad-key pay credit" disabled={disabled} onClick={onCard}>Credit</button>
        <button type="button" class="keypad-key pay other" disabled={disabled} onClick={onOther}>Other</button>

        <button type="button" class="keypad-key" onClick={backspace} aria-label="Backspace">⌫</button>
        {DIGIT_ROWS[3].slice(1).map((d) => (
          <button key={d} type="button" class="keypad-key" onClick={() => pressDigit(d)}>{d}</button>
        ))}
        <button type="button" class="keypad-key pay refund" disabled>Refund</button>
        <button type="button" class="keypad-key pay cash" disabled={disabled} onClick={onCash}>Cash</button>
      </div>
    </div>
  );
}
