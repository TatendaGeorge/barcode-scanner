import { useEffect, useState } from 'preact/hooks';
import { searchProducts, addProduct, type Product } from '../db';
import { generateInternalBarcode } from '../lib/ean13';
import { formatRand, parseRandToCents } from '../lib/money';
import { navigate } from '../router';
import { Sheet } from '../components/Sheet';
import { t } from '../strings';

export function Products() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState('');

  async function refresh() {
    setProducts(await searchProducts(query));
  }
  useEffect(() => {
    refresh();
  }, [query]);

  async function generateBarcode() {
    const existing = new Set(products.flatMap((p) => p.barcodes));
    setBarcode(generateInternalBarcode(existing));
  }

  async function submitAdd(e: Event) {
    e.preventDefault();
    const sellCents = parseRandToCents(price);
    if (!name.trim() || sellCents === null) return;
    await addProduct({
      name: name.trim(),
      barcodes: barcode.trim() ? [barcode.trim()] : [],
      sellPriceCents: sellCents,
      lastCostCents: parseRandToCents(cost) ?? 0,
      category: category.trim() || undefined,
    });
    setShowAdd(false);
    setName('');
    setBarcode('');
    setPrice('');
    setCost('');
    setCategory('');
    refresh();
  }

  return (
    <div class="screen">
      <h1 class="screen-title">{t.products.title}</h1>

      <div class="field">
        <input placeholder={t.common.search} value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </div>

      <button type="button" class="btn wide" onClick={() => setShowAdd(true)}>{t.products.addProduct}</button>

      <ul class="list">
        {products.length === 0 && <li><span class="row-sub">{t.common.noResults}</span></li>}
        {products.map((p) => (
          <li key={p.id}>
            <button class="row-btn" type="button" onClick={() => navigate(`/products/${p.id}`)}>
              <span class="row-main">
                <span class="row-title">{p.name}</span>
                <span class="row-sub money">{formatRand(p.sellPriceCents)} {p.category ? `· ${p.category}` : ''}</span>
              </span>
              <span class={`chip ${p.stockOnHand <= p.reorderLevel ? 'bad' : ''}`}>
                {p.stockOnHand} {t.products.stock.toLowerCase()}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {showAdd && (
        <Sheet title={t.products.addProduct} onClose={() => setShowAdd(false)}>
          <form style={{ display: 'grid', gap: 12 }} onSubmit={submitAdd}>
            <div class="field">
              <label class="label" for="p-name">{t.sell.productName}</label>
              <input id="p-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} required autofocus />
            </div>
            <div class="field">
              <label class="label" for="p-barcode">{t.products.barcode}</label>
              <div class="btn-row">
                <input id="p-barcode" style={{ flex: '1 1 160px' }} inputMode="numeric" value={barcode} onInput={(e) => setBarcode((e.target as HTMLInputElement).value)} placeholder="Leave empty for no-barcode item" />
                <button type="button" class="btn sm" onClick={generateBarcode}>{t.products.generateBarcode}</button>
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label class="label" for="p-price">{t.products.sellPrice}</label>
                <input id="p-price" inputMode="decimal" placeholder="0.00" value={price} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} required />
              </div>
              <div class="field">
                <label class="label" for="p-cost">{t.products.lastCost}</label>
                <input id="p-cost" inputMode="decimal" placeholder="0.00" value={cost} onInput={(e) => setCost((e.target as HTMLInputElement).value)} />
              </div>
            </div>
            <div class="field">
              <label class="label" for="p-category">{t.products.category}</label>
              <input id="p-category" value={category} onInput={(e) => setCategory((e.target as HTMLInputElement).value)} />
            </div>
            <button type="submit" class="btn primary wide">{t.common.save}</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
