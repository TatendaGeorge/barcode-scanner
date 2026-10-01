import { useEffect, useState } from 'preact/hooks';
import {
  db,
  resolveBarcode,
  startStockTake,
  addStockTakeCount,
  setStockTakeCount,
  computeVarianceReport,
  applyStockTake,
  type StockTake as StockTakeRecord,
  type VarianceReport,
} from '../db';
import { formatRand } from '../lib/money';
import { ScannerView } from '../components/ScannerView';
import { t } from '../strings';

type Phase = 'none' | 'counting' | 'review' | 'done';

export function StockTake() {
  const [phase, setPhase] = useState<Phase>('none');
  const [stockTake, setStockTake] = useState<StockTakeRecord | null>(null);
  const [uncountedPolicy, setUncountedPolicy] = useState<'zero' | 'leave'>('leave');
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    db.stockTakes
      .where('status')
      .equals('in_progress')
      .last()
      .then((st) => {
        if (st) {
          setStockTake(st);
          setPhase('counting');
        }
      });
  }, []);

  async function refreshStockTake(id: string) {
    const st = await db.stockTakes.get(id);
    if (st) setStockTake(st);
  }

  async function handleStart() {
    const st = await startStockTake();
    setStockTake(st);
    setPhase('counting');
  }

  async function handleScan(code: string) {
    if (!stockTake) return;
    const resolved = await resolveBarcode(code);
    if (!resolved) return;
    await addStockTakeCount(stockTake.id, resolved.product.id, resolved.qty);
    await refreshStockTake(stockTake.id);
  }

  function startEdit(productId: string, current: number) {
    setEditingId(productId);
    setEditValue(String(current));
  }
  async function saveEdit() {
    if (!stockTake || !editingId) return;
    await setStockTakeCount(stockTake.id, editingId, Math.max(0, Number(editValue) || 0));
    await refreshStockTake(stockTake.id);
    setEditingId(null);
  }

  async function handleFinish() {
    if (!stockTake) return;
    const r = await computeVarianceReport(stockTake.id, uncountedPolicy);
    setReport(r);
    setPhase('review');
  }

  async function handleApply() {
    if (!stockTake) return;
    await applyStockTake(stockTake.id, uncountedPolicy);
    setPhase('done');
  }

  function startNew() {
    setStockTake(null);
    setReport(null);
    setPhase('none');
  }

  const counted = stockTake?.lines.filter((l) => l.counted) ?? [];
  const uncountedCount = (stockTake?.lines.length ?? 0) - counted.length;

  if (phase === 'none') {
    return (
      <div class="screen">
        <h1 class="screen-title">{t.stockTake.title}</h1>
        <p class="screen-sub">Snapshots every product's current stock, then compares it to what you count.</p>
        <button type="button" class="btn primary wide" onClick={handleStart}>{t.stockTake.start}</button>
      </div>
    );
  }

  if (phase === 'counting' && stockTake) {
    return (
      <div class="screen">
        <h1 class="screen-title">{t.stockTake.title}</h1>
        <p class="chip warn" style={{ justifySelf: 'start' }}>{t.stockTake.inProgress} · {counted.length} counted, {uncountedCount} not counted</p>

        <ScannerView onScan={handleScan} hint="Scan each item on the shelf. Scan again to add more." />

        <ul class="list">
          {counted.length === 0 && <li><span class="row-sub">Nothing counted yet.</span></li>}
          {counted.map((l) => (
            <li key={l.productId}>
              <span class="row-main">
                <span class="row-title">{l.name}</span>
                <span class="row-sub">{t.stockTake.expected} {l.expectedQty}</span>
              </span>
              {editingId === l.productId ? (
                <>
                  <input
                    style={{ width: 64, minHeight: 36, borderRadius: 8, border: '1px solid var(--line)', padding: '0 8px' }}
                    type="number"
                    value={editValue}
                    onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
                  />
                  <button class="btn sm" type="button" onClick={saveEdit}>{t.common.save}</button>
                </>
              ) : (
                <button class="btn sm" type="button" onClick={() => startEdit(l.productId, l.countedQty)}>
                  {l.countedQty} {t.stockTake.counted}
                </button>
              )}
            </li>
          ))}
        </ul>

        <button type="button" class="btn primary wide" onClick={handleFinish}>{t.stockTake.finish}</button>
      </div>
    );
  }

  if (phase === 'review' && report) {
    return (
      <div class="screen">
        <h1 class="screen-title">{t.stockTake.variance}</h1>

        <div class="field">
          <div class="label">{t.stockTake.uncountedChoice}</div>
          <div class="btn-row">
            <button type="button" class={`btn sm ${uncountedPolicy === 'zero' ? 'primary' : ''}`} onClick={async () => { setUncountedPolicy('zero'); if (stockTake) setReport(await computeVarianceReport(stockTake.id, 'zero')); }}>
              {t.stockTake.treatAsZero}
            </button>
            <button type="button" class={`btn sm ${uncountedPolicy === 'leave' ? 'primary' : ''}`} onClick={async () => { setUncountedPolicy('leave'); if (stockTake) setReport(await computeVarianceReport(stockTake.id, 'leave')); }}>
              {t.stockTake.leaveUnchanged}
            </button>
          </div>
        </div>

        <table class="simple">
          <thead>
            <tr><th>Product</th><th class="num">{t.stockTake.expected}</th><th class="num">{t.stockTake.counted}</th><th class="num">{t.stockTake.diff}</th><th class="num">Value</th></tr>
          </thead>
          <tbody>
            {report.rows.filter((r) => r.diffQty !== 0 || (!r.counted && r.expectedQty !== 0)).map((r) => (
              <tr key={r.productId}>
                <td>{r.name}{!r.counted && <span class="chip" style={{ marginLeft: 6 }}>{t.stockTake.uncounted}</span>}</td>
                <td class="num">{r.expectedQty}</td>
                <td class="num">{r.countedQty}</td>
                <td class="num">{r.diffQty > 0 ? `+${r.diffQty}` : r.diffQty}</td>
                <td class="num money">{formatRand(r.diffValueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div class="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>{t.stockTake.shrinkage}</span>
            <span class="money">{formatRand(report.totalShrinkageValueCents)}</span>
          </div>
        </div>

        <button type="button" class="btn primary wide" onClick={handleApply}>{t.stockTake.applyAdjustments}</button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div class="screen">
        <h1 class="screen-title">{t.stockTake.title}</h1>
        <p class="status ok">{t.stockTake.applied}</p>
        <button type="button" class="btn primary wide" onClick={startNew}>{t.stockTake.start}</button>
      </div>
    );
  }

  return null;
}
