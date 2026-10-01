import { useEffect, useState } from 'preact/hooks';
import { t } from '../strings';
import { Sheet } from './Sheet';

const ITEMS: [string, string, string][] = [
  ['#/', '⌂', t.nav.home],
  ['#/sell', '₹', t.nav.sell],
  ['#/receive', '▣', t.nav.receive],
  ['#/stock-take', '✓', t.nav.stockTake],
  ['#/products', '☰', t.nav.products],
];

const MORE_ITEMS: [string, string][] = [
  ['#/reports', t.nav.reports],
  ['#/settings', t.nav.settings],
];

export function BottomNav() {
  const [hash, setHash] = useState(location.hash || '#/');
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const onMoreScreen = hash === '#/reports' || hash === '#/settings';

  return (
    <>
      <nav class="bottom-nav" aria-label="Main">
        {ITEMS.map(([href, icon, label]) => (
          <a key={href} href={href} class={hash === href ? 'active' : ''}>
            <span class="ic" aria-hidden="true">{icon}</span>
            {label}
          </a>
        ))}
        <a href="#" class={onMoreScreen ? 'active' : ''} onClick={(e) => { e.preventDefault(); setMoreOpen(true); }}>
          <span class="ic" aria-hidden="true">⋯</span>
          More
        </a>
      </nav>
      {moreOpen && (
        <Sheet title="More" onClose={() => setMoreOpen(false)}>
          <ul class="list">
            {MORE_ITEMS.map(([href, label]) => (
              <li key={href}>
                <a class="row-btn" href={href} onClick={() => setMoreOpen(false)}>
                  <span class="row-main row-title">{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
