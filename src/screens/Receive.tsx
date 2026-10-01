import { useState } from 'preact/hooks';
import { resolveBarcode, addProduct, linkPack, receiveDelivery, type Product, type ReceiptLineInput } from '../db';
import { formatRand, parseRandToCents } from '../lib/money';
import { ScannerView } from '../components/ScannerView';
import { Sheet } from '../components/Sheet';
import { t } from '../strings';

interface PendingLine {
  barcode: string;
  product: Product;
  qty: number;
  costPerUnit: string;
  isNewBarcode: boolean; // barcode wasn't already a known pack or unit barcode for this product
  linkAsBox: boolean;
}

interface BuiltLine extends ReceiptLineInput {
  key: string;
}

const QTY_PRESETS = [1, 6, 12, 24];

export function Receive() {
  const [pending, setPending] = useState<PendingLine | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  const [lines, setLines] = useState<BuiltLine[]>([]);
  const [supplier, setSupplier] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  async function handleScan(code: string) {
    const resolved = await resolveBarcode(code);
    if (resolved) {
      setPending({
        barcode: code,
        product: resolved.product,
        qty: resolved.qty,
        costPerUnit: resolved.product.lastCostCents ? (resolved.product.lastCostCents / 100).toFixed(2) : '',
        isNewBarcode: false,
        linkAsBox: false,
      });
    } else {
      setUnknownBarcode(code);
      setNewName('');
      setNewPrice('');
      setNewCost('');
    }
  }

  async function submitNewProduct(e: Event) {
    e.preventDefault();
    if (!unknownBarcode) return;
    const sellCents = parseRandToCents(newPrice);
    const costCents = parseRandToCents(newCost) ?? 0;
    if (!newName.trim() || sellCents === null) return;
    const product = await addProduct({ name: newName.trim(), barcodes: [unknownBarcode], sellPriceCents: sellCents, lastCostCents: costCents });
    setUnknownBarcode(null);
    setPending({
      barcode: unknownBarcode,
      product,
      qty: 1,
      costPerUnit: costCents ? (costCents / 100).toFixed(2) : '',
      isNewBarcode: true,
      linkAsBox: false,
    });
  }

  function addPendingToDelivery() {
    if (!pending) return;
    const costCents = parseRandToCents(pending.costPerUnit) ?? 0;
    setLines((prev) => [
      ...prev,
      { key: `${pending.barcode}-${Date.now()}`, productId: pending.product.id, name: pending.product.name, qty: pending.qty, unitCostCents: costCents },
    ]);
    if (pending.linkAsBox && pending.isNewBarcode && pending.qty > 1) {
      linkPack(pending.barcode, pending.product.id, pending.qty);
    }
    setPending(null);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const totalCostCents = lines.reduce((a, l) => a + l.qty * l.unitCostCents, 0);

  async function saveDelivery() {
    if (lines.length === 0) return;
    await receiveDelivery(
      lines.map(({ key: _key, ...l }) => l),
      supplier.trim() || undefined
    );
    setLines([]);
    setSupplier('');
    setSavedMessage(t.receive.savedDelivery);
    setTimeout(() => setSavedMessage(''), 2500);
  }

  return (
    <div class="screen">
      <h1 class="screen-title">{t.receive.title}</h1>

      <ScannerView onScan={handleScan} hint="Scan an item from the delivery." />

      <div class="panel">
        <div class="label">{t.receive.building}</div>
        {lines.length === 0 ? (
          <p class="empty-note">Scan an item to start a delivery.</p>
        ) : (
          <ul class="list" style={{ border: 0 }}>
            {lines.map((l) => (
              <li key={l.key} style={{ paddingInline: 0 }}>
                <span class="row-main">
                  <span class="row-title">{l.name}</span>
                  <span class="row-sub">{l.qty} × {formatRand(l.unitCostCents)}</span>
                </span>
                <span class="money">{formatRand(l.qty * l.unitCostCents)}</span>
                <button class="btn sm" type="button" onClick={() => removeLine(l.key)}>{t.common.delete}</button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && (
          <>
            <div class="field">
              <label class="label" for="supplier">{t.receive.supplier}</label>
              <input id="supplier" value={supplier} onInput={(e) => setSupplier((e.target as HTMLInputElement).value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>{t.receive.deliveryTotal}</span>
              <span class="money">{formatRand(totalCostCents)}</span>
            </div>
            <button type="button" class="btn primary wide" onClick={saveDelivery}>{t.receive.saveDelivery}</button>
          </>
        )}
        {savedMessage && <p class="status ok">{savedMessage}</p>}
      </div>

      {pending && (
        <Sheet title={pending.product.name} onClose={() => setPending(null)}>
          <div class="field">
            <label class="label">{t.receive.quantity}</label>
            <div class="btn-row">
              {QTY_PRESETS.map((q) => (
                <button key={q} type="button" class={`btn sm ${pending.qty === q ? 'primary' : ''}`} onClick={() => setPending({ ...pending, qty: q })}>
                  {q}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={pending.qty}
              onInput={(e) => setPending({ ...pending, qty: Math.max(1, Number((e.target as HTMLInputElement).value) || 1) })}
            />
          </div>
          <div class="field">
            <label class="label" for="cost-unit">{t.receive.costPerUnit}</label>
            <input
              id="cost-unit"
              inputMode="decimal"
              placeholder="0.00"
              value={pending.costPerUnit}
              onInput={(e) => setPending({ ...pending, costPerUnit: (e.target as HTMLInputElement).value })}
            />
          </div>
          {pending.isNewBarcode && pending.qty > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={pending.linkAsBox}
                onChange={(e) => setPending({ ...pending, linkAsBox: (e.target as HTMLInputElement).checked })}
              />
              {t.receive.thisIsABox} ({t.receive.packOf} {pending.qty} {t.receive.units})
            </label>
          )}
          <button type="button" class="btn primary wide" onClick={addPendingToDelivery}>{t.receive.addToDelivery}</button>
        </Sheet>
      )}

      {unknownBarcode && (
        <Sheet title={t.receive.newProduct} onClose={() => setUnknownBarcode(null)}>
          <p class="screen-sub" style={{ margin: 0 }}>Barcode: <span class="money">{unknownBarcode}</span></p>
          <form style={{ display: 'grid', gap: 12 }} onSubmit={submitNewProduct}>
            <div class="field">
              <label class="label" for="rn-name">{t.sell.productName}</label>
              <input id="rn-name" value={newName} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} required autofocus />
            </div>
            <div class="field">
              <label class="label" for="rn-price">{t.sell.price}</label>
              <input id="rn-price" inputMode="decimal" placeholder="0.00" value={newPrice} onInput={(e) => setNewPrice((e.target as HTMLInputElement).value)} required />
            </div>
            <div class="field">
              <label class="label" for="rn-cost">{t.receive.costPerUnit}</label>
              <input id="rn-cost" inputMode="decimal" placeholder="0.00" value={newCost} onInput={(e) => setNewCost((e.target as HTMLInputElement).value)} />
            </div>
            <button type="submit" class="btn primary wide">{t.common.add}</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
