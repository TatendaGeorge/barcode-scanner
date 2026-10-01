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
import { newId } from '../lib/id';
import { formatRand, parseRandToCents } from '../lib/money';
import { ScannerView } from '../components/ScannerView';
import { Sheet } from '../components/Sheet';
import { QtyStepper } from '../components/QtyStepper';
import { CategoryGrid } from '../components/CategoryGrid';
import { Keypad } from '../components/Keypad';
import { t } from '../strings';

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  stockOnHand: number;
}

interface HeldSale {
  id: string;
  cart: CartLine[];
  heldAt: number;
}

function quickCashAmounts(totalCents: number): number[] {
  const nextNote = Math.ceil(Math.max(totalCents, 1) / 1000) * 1000; // next R10 note above the total
  const pool = [totalCents, nextNote, 5000, 10000, 20000];
  return Array.from(new Set(pool)).slice(0, 4);
}

export function Sell() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favourites, setFavourites] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [keypadAmountCents, setKeypadAmountCents] = useState(0);
  const [vatOn, setVatOn] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleMessage, setSaleMessage] = useState('');
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeld, setShowHeld] = useState(false);

  async function refreshProducts() {
    setProducts(await searchProducts(''));
  }
  async function refreshFavourites() {
    setFavourites(await getFavourites());
  }
  async function refreshSales() {
    setSales((await recentSales(10)).filter((s) => s.status === 'completed' || s.status === 'voided'));
  }

  useEffect(() => {
    refreshProducts();
    refreshFavourites();
    refreshSales();
    getSettings().then((s) => setVatOn(s.vatOn));
  }, []);

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => !!c))
  ).sort();

  const browsing = selectedCategory !== null || searchQuery.trim().length > 0;
  const browseProducts = browsing
    ? products.filter((p) => {
        if (selectedCategory && p.category !== selectedCategory) return false;
        const q = searchQuery.trim().toLowerCase();
        if (q && !p.name.toLowerCase().includes(q) && !p.barcodes.some((b) => b.includes(q))) return false;
        return true;
      })
    : favourites;

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
    refreshProducts();
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) => (qty <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, qty } : l))));
  }

  const subtotalCents = cart.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
  const vatCents = vatOn ? Math.round(subtotalCents * 0.15) : 0;
  const totalCents = subtotalCents + vatCents;
  const overSoldLines = cart.filter((l) => l.qty > l.stockOnHand);

  async function finishCheckout(method: PaymentMethod, tenderedCents?: number) {
    if (cart.length === 0) return;
    const sale = await completeSale({
      lines: cart.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPriceCents: l.unitPriceCents })),
      paymentMethod: method,
      cashTenderedCents: method === 'cash' ? tenderedCents : undefined,
      vatOn,
    });
    setCart([]);
    setKeypadAmountCents(0);
    const change = method === 'cash' && sale.changeCents ? ` ${t.sell.change}: ${formatRand(sale.changeCents)}.` : '';
    setSaleMessage(`Sale completed.${change}`);
    setTimeout(() => setSaleMessage(''), 3500);
    refreshSales();
    refreshFavourites();
    refreshProducts();
  }

  function handleCash() {
    const tendered = keypadAmountCents > 0 ? keypadAmountCents : totalCents;
    if (tendered < totalCents) {
      setSaleMessage(`${t.sell.short} ${formatRand(totalCents - tendered)}`);
      setTimeout(() => setSaleMessage(''), 3500);
      return;
    }
    finishCheckout('cash', tendered);
  }

  async function handleVoid(saleId: string) {
    await voidSale(saleId);
    refreshSales();
    refreshProducts();
  }

  function cancelCart() {
    setCart([]);
    setKeypadAmountCents(0);
  }

  function holdCart() {
    if (cart.length === 0) return;
    setHeldSales((prev) => [...prev, { id: newId(), cart, heldAt: Date.now() }]);
    setCart([]);
    setKeypadAmountCents(0);
  }

  function resumeHeld(id: string) {
    const held = heldSales.find((h) => h.id === id);
    if (!held) return;
    setHeldSales((prev) => {
      const rest = prev.filter((h) => h.id !== id);
      return cart.length > 0 ? [...rest, { id: newId(), cart, heldAt: Date.now() }] : rest;
    });
    setCart(held.cart);
    setShowHeld(false);
  }

  return (
    <div class="screen pos">
      <h1 class="screen-title">{t.sell.title}</h1>

      <div class="pos-layout">
        <div class="panel cart-panel">
          <div class="label">{t.sell.cart}</div>
          <div class="cart-lines">
            {cart.length === 0 ? (
              <p class="empty-note">{t.sell.empty}</p>
            ) : (
              cart.map((l) => (
                <div class="cart-line" key={l.productId}>
                  <span>
                    <span class="cl-name">{l.name}</span>
                    <br />
                    <span class="cl-sub">{l.qty} @ {formatRand(l.unitPriceCents)}</span>
                    {l.qty > l.stockOnHand && <span class="chip warn" style={{ marginLeft: 6 }}>{t.sell.lowStockWarning(l.stockOnHand)}</span>}
                    <div style={{ marginTop: 6 }}><QtyStepper value={l.qty} onChange={(q) => updateQty(l.productId, q)} /></div>
                  </span>
                  <span class="cl-price money">{formatRand(l.qty * l.unitPriceCents)}</span>
                </div>
              ))
            )}
          </div>

          {overSoldLines.length > 0 && <p class="status err">{t.sell.outOfStockWarning}</p>}

          <div class="totals-block">
            <div class="totals-row"><span>{t.sell.subtotal}</span><span class="money">{formatRand(subtotalCents)}</span></div>
            {vatOn && <div class="totals-row"><span>{t.sell.vat}</span><span class="money">{formatRand(vatCents)}</span></div>}
            <div class="totals-row total"><span>{t.sell.total}</span><span class="money">{formatRand(totalCents)}</span></div>
          </div>

          <div class="cart-actions">
            <button type="button" class="btn" onClick={cancelCart} disabled={cart.length === 0}>{t.common.cancel}</button>
            <button type="button" class="btn" onClick={holdCart} disabled={cart.length === 0}>Hold</button>
            <button type="button" class="btn icon-btn hold-btn" aria-label="Held sales" onClick={() => setShowHeld(true)}>
              🕒
              {heldSales.length > 0 && <span class="hold-badge">{heldSales.length}</span>}
            </button>
          </div>

          {saleMessage && <p class="status ok">{saleMessage}</p>}
        </div>

        <div class="right-pane">
          <div class="panel">
            <div class="btn-row">
              <button type="button" class="btn" onClick={() => setShowScanner((v) => !v)}>
                {showScanner ? t.common.close : '📷 Scan item'}
              </button>
              <input
                class="field"
                style={{ flex: '1 1 160px', minHeight: 40, borderRadius: 10, border: '1px solid var(--line)', padding: '0 12px' }}
                placeholder={t.common.searchByName}
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
            {showScanner && <div style={{ marginTop: 12 }}><ScannerView onScan={handleScan} /></div>}
          </div>

          <div class="panel">
            <div class="label" style={{ marginBottom: 8 }}>{t.products.category}</div>
            <CategoryGrid categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

            <div class="label" style={{ marginTop: 14, marginBottom: 8 }}>{browsing ? t.common.search : t.sell.favourites}</div>
            {browseProducts.length === 0 ? (
              <p class="empty-note">{t.common.noResults}</p>
            ) : (
              <div class="favourites-grid">
                {browseProducts.map((p) => (
                  <button key={p.id} type="button" class="fav-tile" onClick={() => addLine(p, 1)}>
                    {p.name}
                    <br />
                    <span class="money" style={{ fontWeight: 400 }}>{formatRand(p.sellPriceCents)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div class="panel">
            <Keypad
              amountCents={keypadAmountCents}
              onAmountChange={setKeypadAmountCents}
              quickAmountsCents={quickCashAmounts(totalCents)}
              disabled={cart.length === 0}
              onCash={handleCash}
              onCard={() => finishCheckout('card')}
              onOther={() => finishCheckout('other')}
            />
          </div>
        </div>
      </div>

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

      {showHeld && (
        <Sheet title="Held sales" onClose={() => setShowHeld(false)}>
          {heldSales.length === 0 ? (
            <p class="empty-note">No held sales.</p>
          ) : (
            <ul class="list">
              {heldSales.map((h) => {
                const total = h.cart.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
                return (
                  <li key={h.id}>
                    <button class="row-btn" type="button" onClick={() => resumeHeld(h.id)}>
                      <span class="row-main">
                        <span class="row-title money">{formatRand(total)}</span>
                        <span class="row-sub">{h.cart.length} item{h.cart.length === 1 ? '' : 's'} · held {new Date(h.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  );
}
