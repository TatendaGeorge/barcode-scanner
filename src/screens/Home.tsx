import { useEffect, useState } from 'preact/hooks';
import { salesToday, getLowStock, type Product, type Sale } from '../db';
import { formatRand, sumCents } from '../lib/money';
import { navigate } from '../router';
import { t } from '../strings';

export function Home() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);

  async function refresh() {
    setSales(await salesToday());
    setLowStock(await getLowStock());
  }
  useEffect(() => {
    refresh();
  }, []);

  const totalCents = sumCents(sales.map((s) => s.totalCents));

  return (
    <div class="screen">
      <h1 class="screen-title">{t.appName}</h1>

      <div class="stat-row">
        <div class="stat">
          <div class="label">{t.home.todaySales}</div>
          <div class="n money">{formatRand(totalCents)}</div>
          <div class="screen-sub" style={{ margin: 0 }}>{t.home.salesCount(sales.length)}</div>
        </div>
        <button type="button" class="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setShowLowStock((v) => !v)}>
          <div class="label">{t.home.lowStock}</div>
          <div class="n">{lowStock.length}</div>
          <div class="screen-sub" style={{ margin: 0 }}>{t.home.lowStockCount(lowStock.length)}</div>
        </button>
      </div>

      {showLowStock && (
        <ul class="list">
          {lowStock.length === 0 && <li><span class="row-sub">Nothing low right now.</span></li>}
          {lowStock.map((p) => (
            <li key={p.id}>
              <button class="row-btn" type="button" onClick={() => navigate(`/products/${p.id}`)}>
                <span class="row-main">
                  <span class="row-title">{p.name}</span>
                  <span class="row-sub">Reorder at {p.reorderLevel}</span>
                </span>
                <span class="chip bad">{p.stockOnHand} left</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <button type="button" class="btn primary wide" style={{ minHeight: 64, fontSize: 17 }} onClick={() => navigate('/sell')}>
          {t.home.sell}
        </button>
        <div class="grid-2">
          <button type="button" class="btn" style={{ minHeight: 56 }} onClick={() => navigate('/receive')}>
            {t.home.receive}
          </button>
          <button type="button" class="btn" style={{ minHeight: 56 }} onClick={() => navigate('/stock-take')}>
            {t.home.stockTake}
          </button>
        </div>
      </div>
    </div>
  );
}
