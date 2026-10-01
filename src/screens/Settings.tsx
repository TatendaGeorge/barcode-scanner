import { useEffect, useState } from 'preact/hooks';
import { getSettings, updateSettings, exportBackup, importBackup, resetAll, isEmpty, db, type Backup } from '../db';
import { seedDemoData } from '../demoData';
import { t } from '../strings';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function Settings() {
  const [shopName, setShopName] = useState('');
  const [vatOn, setVatOn] = useState(false);
  const [message, setMessage] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setShopName(s.shopName);
      setVatOn(s.vatOn);
    });
  }, []);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  }

  async function saveShopName() {
    await updateSettings({ shopName });
    flash(t.common.save + '.');
  }
  async function toggleVat() {
    const next = !vatOn;
    setVatOn(next);
    await updateSettings({ vatOn: next });
  }

  async function doExportBackup() {
    const backup = await exportBackup();
    download(`spaza-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }
  async function doImportBackup(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text) as Backup;
    await importBackup(data);
    flash('Backup imported.');
  }

  async function exportProductsCsv() {
    const products = await db.products.toArray();
    const header = 'id,name,barcode,category,sellPrice,lastCost,stockOnHand,reorderLevel\n';
    const rows = products.map((p) =>
      [p.id, p.name, p.barcodes.join(' '), p.category ?? '', (p.sellPriceCents / 100).toFixed(2), (p.lastCostCents / 100).toFixed(2), p.stockOnHand, p.reorderLevel]
        .map(csvEscape)
        .join(',')
    );
    download('products.csv', header + rows.join('\n'), 'text/csv');
  }
  async function exportMovementsCsv() {
    const movements = await db.movements.toArray();
    const header = 'id,type,productId,qtyDelta,unitCost,referenceId,createdAt\n';
    const rows = movements.map((m) =>
      [m.id, m.type, m.productId, m.qtyDelta, m.unitCostCents !== undefined ? (m.unitCostCents / 100).toFixed(2) : '', m.referenceId ?? '', new Date(m.createdAt).toISOString()]
        .map(csvEscape)
        .join(',')
    );
    download('movements.csv', header + rows.join('\n'), 'text/csv');
  }

  async function doLoadDemoData() {
    if (!(await isEmpty())) {
      flash('Products already exist — clear data first if you want a clean demo set.');
      return;
    }
    await seedDemoData();
    flash(t.settings.demoLoaded);
  }

  async function doReset() {
    if (resetConfirm !== 'RESET') return;
    await resetAll();
    setResetConfirm('');
    flash(t.settings.resetDone);
  }

  return (
    <div class="screen">
      <h1 class="screen-title">{t.settings.title}</h1>

      <div class="panel">
        <div class="field">
          <label class="label" for="shop-name">{t.settings.shopName}</label>
          <input id="shop-name" value={shopName} onInput={(e) => setShopName((e.target as HTMLInputElement).value)} onBlur={saveShopName} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            <strong>{t.settings.vat}</strong>
            <br />
            <span class="row-sub">{t.settings.vatHint}</span>
          </span>
          <input type="checkbox" checked={vatOn} onChange={toggleVat} style={{ width: 22, height: 22 }} />
        </label>
      </div>

      <div class="panel">
        <div class="label">{t.settings.backup}</div>
        <div class="btn-row">
          <button type="button" class="btn" onClick={doExportBackup}>{t.settings.exportBackup}</button>
          <label class="btn" for="import-backup">{t.settings.importBackup}</label>
          <input id="import-backup" type="file" accept="application/json" onChange={doImportBackup} />
        </div>
        <div class="label">{t.settings.exportCsv}</div>
        <div class="btn-row">
          <button type="button" class="btn" onClick={exportProductsCsv}>{t.settings.exportProductsCsv}</button>
          <button type="button" class="btn" onClick={exportMovementsCsv}>{t.settings.exportMovementsCsv}</button>
        </div>
      </div>

      <div class="panel">
        <div class="label">{t.settings.demo}</div>
        <button type="button" class="btn wide" onClick={doLoadDemoData}>{t.settings.loadDemoData}</button>
      </div>

      <div class="panel">
        <div class="label" style={{ color: 'var(--laser)' }}>{t.settings.danger}</div>
        <div class="field">
          <label class="label" for="reset-confirm">{t.settings.resetConfirmLabel}</label>
          <input id="reset-confirm" value={resetConfirm} onInput={(e) => setResetConfirm((e.target as HTMLInputElement).value)} />
        </div>
        <button type="button" class="btn danger wide" disabled={resetConfirm !== 'RESET'} onClick={doReset}>
          {t.settings.resetEverything}
        </button>
      </div>

      {message && <p class="status ok">{message}</p>}
    </div>
  );
}
