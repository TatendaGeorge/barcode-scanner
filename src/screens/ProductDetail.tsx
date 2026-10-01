import { useEffect, useState } from 'preact/hooks';
import { db, updateProduct, productHistory, type Product, type Movement } from '../db';
import { formatRand, parseRandToCents } from '../lib/money';
import { navigate } from '../router';
import { t } from '../strings';

const MOVEMENT_LABEL: Record<Movement['type'], string> = {
  receive: 'Received',
  sale: 'Sold',
  refund: 'Refund (void)',
  count_adjust: 'Stock take adjustment',
  manual_adjust: 'Manual adjustment',
};

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [reorder, setReorder] = useState('');
  const [favourite, setFavourite] = useState(false);

  async function refresh() {
    const p = await db.products.get(id);
    setProduct(p ?? null);
    if (p) {
      setName(p.name);
      setPrice((p.sellPriceCents / 100).toFixed(2));
      setReorder(String(p.reorderLevel));
      setFavourite(p.isFavourite);
    }
    setHistory(await productHistory(id));
  }
  useEffect(() => {
    refresh();
  }, [id]);

  async function save(e: Event) {
    e.preventDefault();
    const cents = parseRandToCents(price);
    if (!name.trim() || cents === null) return;
    await updateProduct(id, { name: name.trim(), sellPriceCents: cents, reorderLevel: Number(reorder) || 0, isFavourite: favourite });
    setEditing(false);
    refresh();
  }

  if (!product) {
    return (
      <div class="screen">
        <button class="btn sm" type="button" onClick={() => navigate('/products')}>{t.common.back}</button>
      </div>
    );
  }

  return (
    <div class="screen">
      <button class="btn sm" style={{ justifySelf: 'start' }} type="button" onClick={() => navigate('/products')}>← {t.products.title}</button>
      <h1 class="screen-title">{product.name}</h1>

      {editing ? (
        <form class="panel" style={{ display: 'grid', gap: 12 }} onSubmit={save}>
          <div class="field">
            <label class="label" for="e-name">{t.sell.productName}</label>
            <input id="e-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} required />
          </div>
          <div class="grid-2">
            <div class="field">
              <label class="label" for="e-price">{t.products.sellPrice}</label>
              <input id="e-price" inputMode="decimal" value={price} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} required />
            </div>
            <div class="field">
              <label class="label" for="e-reorder">{t.products.reorderLevel}</label>
              <input id="e-reorder" type="number" min={0} value={reorder} onInput={(e) => setReorder((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={favourite} onChange={(e) => setFavourite((e.target as HTMLInputElement).checked)} />
            {t.products.favourite}
          </label>
          <div class="btn-row">
            <button type="button" class="btn" onClick={() => setEditing(false)}>{t.common.cancel}</button>
            <button type="submit" class="btn primary">{t.common.save}</button>
          </div>
        </form>
      ) : (
        <div class="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span class="label">{t.products.sellPrice}</span>
            <span class="money">{formatRand(product.sellPriceCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span class="label">{t.products.lastCost}</span>
            <span class="money">{formatRand(product.lastCostCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span class="label">{t.products.stock}</span>
            <span class={`chip ${product.stockOnHand <= product.reorderLevel ? 'bad' : 'ok'}`}>{product.stockOnHand}</span>
          </div>
          {product.barcodes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span class="label">{t.products.barcode}</span>
              <span class="money">{product.barcodes.join(', ')}</span>
            </div>
          )}
          <div class="btn-row">
            <button type="button" class="btn" onClick={() => setEditing(true)}>{t.common.edit}</button>
            <button type="button" class="btn" onClick={() => navigate(`/labels?product=${product.id}`)}>{t.products.labels}</button>
          </div>
        </div>
      )}

      <div>
        <div class="label" style={{ marginBottom: 8 }}>{t.products.history}</div>
        <ul class="list">
          {history.length === 0 && <li><span class="row-sub">{t.products.noHistory}</span></li>}
          {history.map((m) => (
            <li key={m.id}>
              <span class="row-main">
                <span class="row-title">{MOVEMENT_LABEL[m.type]}</span>
                <span class="row-sub">{new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
              <span class={`chip ${m.qtyDelta >= 0 ? 'ok' : 'bad'}`}>{m.qtyDelta >= 0 ? `+${m.qtyDelta}` : m.qtyDelta}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
