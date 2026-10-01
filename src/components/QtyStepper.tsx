interface QtyStepperProps {
  value: number;
  min?: number;
  onChange: (next: number) => void;
}

export function QtyStepper({ value, min = 0, onChange }: QtyStepperProps) {
  return (
    <div class="quantity-stepper">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output>{value}</output>
      <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
