import { useEffect, useState } from 'preact/hooks';
import { db, topSellers, grossProfitEstimate, stockValueAtCost, type Sale } from '../db';
import { formatRand } from '../lib/money';
import { t } from '../strings';

interface DayRow {
  date: string;
  totalCents: number;
  count: number;
}

export function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [grossProfitCents, setGrossProfitCents] = useState(0);
  const [stockValueCents, setStockValueCents] = useState(0);

  useEffect(() => {
    (async () => {
      const all = await db.sales.orderBy('createdAt').reverse().toArray();
      setSales(all);
      setGrossProfitCents(await grossProfitEstimate(all));
      setStockValueCents(await stockValueAtCost());
    })();
  }, []);

  const completed = sales.filter((s) => s.status === 'completed');

  const byDay = new Map<string, DayRow>();
  for (const s of completed) {
    const d = new Date(s.createdAt);
    const key = d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
    const row = byDay.get(key) ?? { date: key, totalCents: 0, count: 0 };
    row.totalCents += s.totalCents;
    row.count += 1;
    byDay.set(key, row);
  }
  const dayRows = Array.from(byDay.values());
  const top = topSellers(completed, 10);

  return (
    <div class="screen">
      <h1 class="screen-title">{t.reports.title}</h1>

      <div class="stat-row">
        <div class="stat">
          <div class="label">{t.reports.grossProfit}</div>
          <div class="n money">{formatRand(grossProfitCents)}</div>
        </div>
        <div class="stat">
          <div class="label">{t.reports.stockValue}</div>
          <div class="n money">{formatRand(stockValueCents)}</div>
        </div>
      </div>

      <div>
        <div class="label" style={{ marginBottom: 8 }}>{t.reports.salesByDay}</div>
        <table class="simple">
          <thead><tr><th>Day</th><th class="num">Sales</th><th class="num">Total</th></tr></thead>
          <tbody>
            {dayRows.length === 0 && <tr><td colSpan={3}>{t.common.noResults}</td></tr>}
            {dayRows.map((r) => (
              <tr key={r.date}><td>{r.date}</td><td class="num">{r.count}</td><td class="num money">{formatRand(r.totalCents)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div class="label" style={{ marginBottom: 8 }}>{t.reports.topSellers}</div>
        <table class="simple">
          <thead><tr><th>Product</th><th class="num">{t.reports.qty}</th><th class="num">{t.reports.revenue}</th></tr></thead>
          <tbody>
            {top.length === 0 && <tr><td colSpan={3}>{t.common.noResults}</td></tr>}
            {top.map((r) => (
              <tr key={r.productId}><td>{r.name}</td><td class="num">{r.qty}</td><td class="num money">{formatRand(r.revenueCents)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
