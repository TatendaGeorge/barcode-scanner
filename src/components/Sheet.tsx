import type { ComponentChildren } from 'preact';
import { t } from '../strings';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div class="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{title}</h2>
          <button class="sheet-close" type="button" onClick={onClose}>
            {t.common.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
