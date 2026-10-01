import { useEffect, useState } from 'preact/hooks';
import {
  resolveBarcode,
  searchProducts,
  getFavourites,
  addProduct,
  completeSale,
  voidSale,
  recentSales,
  getSettings,
  type Product,
  type Sale,
  type PaymentMethod,
} from '../db';
import { formatRand, parseRandToCents, changeDue } from '../lib/money';
import { ScannerView } from '../components/ScannerView';
import { Sheet } from '../components/Sheet';
import { QtyStepper } from '../components/QtyStepper';
import { t } from '../strings';

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  stockOnHand: number;
}

const TENDER_OPTIONS_CENTS = [1000, 2000, 5000, 10000, 20000];

export function Sell() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favourites, setFavourites] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState<number | null>(null);
  const [vatOn, setVatOn] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleMessage, setSaleMessage] = useState('');

  async function refreshFavourites() {
    setFavourites(await getFavourites());
  }
  async function refreshSales() {
    setSales((await recentSales(10)).filter((s) => s.status === 'completed' || s.status === 'voided'));
  }

  useEffect(() => {
    refreshFavourites();
    refreshSales();
    getSettings().then((s) => setVatOn(s.vatOn));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchProducts(searchQuery).then(setSearchResults);
  }, [searchQuery]);

  function addLine(product: Product, qty: number) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { productId: product.id, name: product.name, qty, unitPriceCents: product.sellPriceCents, stockOnHand: product.stockOnHand }];
    });
  }

  async function handleScan(code: string) {
    const resolved = await resolveBarcode(code);
    if (resolved) {
      addLine(resolved.product, resolved.qty);
    } else {
      setUnknownBarcode(code);
      setNewName('');
      setNewPrice('');
    }
  }

  async function submitNewProduct(e: Event) {
    e.preventDefault();
    if (!unknownBarcode) return;
    const cents = parseRandToCents(newPrice);
    if (!newName.trim() || cents === null) return;
    const product = await addProduct({ name: newName.trim(), barcodes: [unknownBarcode], sellPriceCents: cents });
    addLine(product, 1);
    setUnknownBarcode(null);
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) => (qty <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, qty } : l))));
  }

  const subtotalCents = cart.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
  const vatCents = vatOn ? Math.round(subtotalCents * 0.15) : 0;
  const totalCents = subtotalCents + vatCents;
  const overSoldLines = cart.filter((l) => l.qty > l.stockOnHand);

  async function finishCheckout() {
    await completeSale({
      lines: cart.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPriceCents: l.unitPriceCents })),
      paymentMethod,
      cashTenderedCents: paymentMethod === 'cash' ? tendered ?? totalCents : undefined,
      vatOn,
    });
    setCart([]);
    setCheckoutOpen(false);
    setTendered(null);
    setSaleMessage('Sale completed.');
    setTimeout(() => setSaleMessage(''), 2500);
    refreshSales();
    refreshFavourites();
  }

  async function handleVoid(saleId: string) {
    await voidSale(saleId);
    refreshSales();
  }

  return (
    <div class="screen">
      <h1 class="screen-title">{t.sell.title}</h1>

      <ScannerView onScan={handleScan} />

      <div class="field">
        <input
          placeholder={t.common.searchByName}
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
        />
      </div>
      {searchResults.length > 0 && (
        <ul class="list">
          {searchResults.map((p) => (
            <li key={p.id}>
              <button class="row-btn" type="button" onClick={() => { addLine(p, 1); setSearchQuery(''); }}>
                <span class="row-main">
                  <span class="row-title">{p.name}</span>
                  <span class="row-sub money">{formatRand(p.sellPriceCents)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {favourites.length > 0 && (
        <div>
          <div class="label" style={{ marginBottom: 8 }}>{t.sell.favourites}</div>
          <div class="favourites-grid">
            {favourites.map((p) => (
              <button key={p.id} type="button" class="fav-tile" onClick={() => addLine(p, 1)}>
                {p.name}
                <br />
                <span class="money" style={{ fontWeight: 400 }}>{formatRand(p.sellPriceCents)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="panel">
        <div class="label">{t.sell.cart}</div>
        {cart.length === 0 ? (
          <p class="empty-note">{t.sell.empty}</p>
        ) : (
          <ul class="list" style={{ border: 0 }}>
            {cart.map((l) => (
              <li key={l.productId} style={{ paddingInline: 0 }}>
                <span class="row-main">
                  <span class="row-title">{l.name}</span>
                  <span class="row-sub money">{formatRand(l.unitPriceCents)} each</span>
                  {l.qty > l.stockOnHand && <span class="chip warn" style={{ marginLeft: 6 }}>{t.sell.lowStockWarning(l.stockOnHand)}</span>}
                </span>
                <QtyStepper value={l.qty} onChange={(q) => updateQty(l.productId, q)} />
                <span class="money" style={{ minWidth: 70, textAlign: 'right' }}>{formatRand(l.qty * l.unitPriceCents)}</span>
              </li>
            ))}
          </ul>
        )}
        {cart.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t.sell.total}</span>
              <strong class="money">{formatRand(totalCents)}</strong>
            </div>
            <button type="button" class="btn primary wide" onClick={() => setCheckoutOpen(true)}>
              {t.sell.checkout}
            </button>
          </>
        )}
      </div>

      {saleMessage && <p class="status ok">{saleMessage}</p>}

      <div>
        <div class="label" style={{ marginBottom: 8 }}>{t.sell.recentSales}</div>
        <ul class="list">
          {sales.length === 0 && <li><span class="row-sub">No sales yet.</span></li>}
          {sales.map((s) => (
            <li key={s.id}>
              <span class="row-main">
                <span class="row-title money">{formatRand(s.totalCents)}</span>
                <span class="row-sub">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.lines.length} item{s.lines.length === 1 ? '' : 's'} · {s.paymentMethod}</span>
              </span>
              {s.status === 'voided' ? (
                <span class="chip bad">{t.sell.voided}</span>
              ) : (
                <button class="btn sm" type="button" onClick={() => handleVoid(s.id)}>{t.sell.voidSale}</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {unknownBarcode && (
        <Sheet title={t.sell.addProductSheetTitle} onClose={() => setUnknownBarcode(null)}>
          <p class="screen-sub" style={{ margin: 0 }}>{t.sell.unknownBarcode}: <span class="money">{unknownBarcode}</span></p>
          <form class="field" style={{ display: 'grid', gap: 12 }} onSubmit={submitNewProduct}>
            <div class="field">
              <label class="label" for="np-name">{t.sell.productName}</label>
              <input id="np-name" value={newName} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} required autofocus />
            </div>
            <div class="field">
              <label class="label" for="np-price">{t.sell.price}</label>
              <input id="np-price" inputMode="decimal" placeholder="0.00" value={newPrice} onInput={(e) => setNewPrice((e.target as HTMLInputElement).value)} required />
            </div>
            <button type="submit" class="btn primary wide">{t.sell.addAndSell}</button>
          </form>
        </Sheet>
      )}

      {checkoutOpen && (
        <Sheet title={t.sell.checkout} onClose={() => setCheckoutOpen(false)}>
          {overSoldLines.length > 0 && (
            <p class="status err">{t.sell.outOfStockWarning}</p>
          )}
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t.sell.subtotal}</span><span class="money">{formatRand(subtotalCents)}</span></div>
            {vatOn && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t.sell.vat}</span><span class="money">{formatRand(vatCents)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{t.sell.total}</span><span class="money">{formatRand(totalCents)}</span></div>
          </div>

          <div class="label">{t.sell.paymentMethod}</div>
          <div class="btn-row">
            {(['cash', 'card', 'other'] as PaymentMethod[]).map((m) => (
              <button key={m} type="button" class={`btn sm ${paymentMethod === m ? 'primary' : ''}`} onClick={() => { setPaymentMethod(m); setTendered(null); }}>
                {m === 'cash' ? t.sell.cash : m === 'card' ? t.sell.card : t.sell.other}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div class="label">{t.sell.tendered}</div>
              <div class="btn-row">
                {TENDER_OPTIONS_CENTS.map((c) => (
                  <button key={c} type="button" class={`btn sm ${tendered === c ? 'primary' : ''}`} onClick={() => setTendered(c)}>
                    {formatRand(c)}
                  </button>
                ))}
                <button type="button" class={`btn sm ${tendered === totalCents ? 'primary' : ''}`} onClick={() => setTendered(totalCents)}>
                  {t.sell.exact}
                </button>
              </div>
              {tendered !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>{changeDue(totalCents, tendered) >= 0 ? t.sell.change : t.sell.short}</span>
                  <span class="money">{formatRand(Math.abs(changeDue(totalCents, tendered)))}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            class="btn primary wide"
            disabled={paymentMethod === 'cash' && tendered === null}
            onClick={finishCheckout}
          >
            {t.sell.completeSale}
          </button>
        </Sheet>
      )}
    </div>
  );
}
