import Dexie, { type Table } from 'dexie';
import { newId } from './lib/id';
import { VAT_RATE } from './lib/money';

// ---------- types ----------

export interface Product {
  id: string;
  name: string;
  barcodes: string[]; // unit barcode(s); empty for favourites-only / no-barcode items
  sellPriceCents: number;
  lastCostCents: number;
  reorderLevel: number;
  category?: string;
  stockOnHand: number; // cached; movements is the source of truth
  isFavourite: boolean;
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Pack {
  barcode: string; // pk — the pack/box's own barcode
  productId: string;
  qty: number; // units per pack
}

export type MovementType = 'receive' | 'sale' | 'refund' | 'count_adjust' | 'manual_adjust';

export interface Movement {
  id: string;
  type: MovementType;
  productId: string;
  qtyDelta: number;
  unitCostCents?: number;
  referenceId?: string;
  note?: string;
  createdAt: number;
}

export interface SaleLine {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export type PaymentMethod = 'cash' | 'card' | 'other';

export interface Sale {
  id: string;
  createdAt: number;
  lines: SaleLine[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  cashTenderedCents?: number;
  changeCents?: number;
  status: 'completed' | 'voided';
  voidedAt?: number;
}

export interface ReceiptLine {
  productId: string;
  name: string;
  qty: number;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface Receipt {
  id: string;
  createdAt: number;
  supplier?: string;
  lines: ReceiptLine[];
  totalCostCents: number;
}

export interface StockTakeLine {
  productId: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  counted: boolean;
}

export interface StockTake {
  id: string;
  status: 'in_progress' | 'applied';
  startedAt: number;
  finishedAt?: number;
  lines: StockTakeLine[];
}

export interface Settings {
  key: 'app';
  vatOn: boolean;
  shopName: string;
}

// ---------- schema ----------

class SpazaDB extends Dexie {
  products!: Table<Product, string>;
  packs!: Table<Pack, string>;
  movements!: Table<Movement, string>;
  sales!: Table<Sale, string>;
  receipts!: Table<Receipt, string>;
  stockTakes!: Table<StockTake, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('spaza-pos');
    this.version(1).stores({
      products: 'id, name, *barcodes, category',
      packs: 'barcode, productId',
      movements: 'id, productId, type, createdAt, referenceId',
      sales: 'id, createdAt, status',
      receipts: 'id, createdAt',
      stockTakes: 'id, status, startedAt',
      settings: 'key',
    });
  }
}

export const db = new SpazaDB();

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  if (s) return s;
  const fresh: Settings = { key: 'app', vatOn: false, shopName: 'My Spaza' };
  await db.settings.put(fresh);
  return fresh;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'key'>>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.settings.put(next);
  return next;
}

// ---------- lookups ----------

export interface ResolvedBarcode {
  product: Product;
  qty: number; // how many units this scan represents (1 for a unit barcode, N for a pack)
}

export async function resolveBarcode(code: string): Promise<ResolvedBarcode | null> {
  const pack = await db.packs.get(code);
  if (pack) {
    const product = await db.products.get(pack.productId);
    if (product) return { product, qty: pack.qty };
  }
  const product = await db.products.where('barcodes').equals(code).first();
  if (product) return { product, qty: 1 };
  return null;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  const all = await db.products.toArray();
  if (!q) return all.sort((a, b) => a.name.localeCompare(b.name));
  return all
    .filter((p) => p.name.toLowerCase().includes(q) || p.barcodes.some((b) => b.includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFavourites(): Promise<Product[]> {
  const all = await db.products.toArray();
  return all.filter((p) => p.isFavourite).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLowStock(): Promise<Product[]> {
  const all = await db.products.toArray();
  return all.filter((p) => p.stockOnHand <= p.reorderLevel).sort((a, b) => a.stockOnHand - b.stockOnHand);
}

// ---------- products ----------

export interface NewProductInput {
  name: string;
  barcodes: string[];
  sellPriceCents: number;
  lastCostCents?: number;
  reorderLevel?: number;
  category?: string;
  isFavourite?: boolean;
  isDemo?: boolean;
}

export async function addProduct(input: NewProductInput): Promise<Product> {
  const now = Date.now();
  const product: Product = {
    id: newId(),
    name: input.name,
    barcodes: input.barcodes,
    sellPriceCents: input.sellPriceCents,
    lastCostCents: input.lastCostCents ?? 0,
    reorderLevel: input.reorderLevel ?? 5,
    category: input.category,
    stockOnHand: 0,
    isFavourite: input.isFavourite ?? false,
    isDemo: input.isDemo ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await db.products.add(product);
  return product;
}

export async function updateProduct(id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
  await db.products.update(id, { ...patch, updatedAt: Date.now() });
}

export async function linkPack(barcode: string, productId: string, qty: number): Promise<void> {
  await db.packs.put({ barcode, productId, qty });
}

export async function productHistory(productId: string): Promise<Movement[]> {
  const rows = await db.movements.where('productId').equals(productId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

// ---------- sales ----------

export interface SaleLineInput {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export interface CompleteSaleInput {
  lines: SaleLineInput[];
  paymentMethod: PaymentMethod;
  cashTenderedCents?: number;
  vatOn: boolean;
}

export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const now = Date.now();
  const lines: SaleLine[] = input.lines.map((l) => ({
    productId: l.productId,
    name: l.name,
    qty: l.qty,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.qty * l.unitPriceCents,
  }));
  const subtotalCents = lines.reduce((a, l) => a + l.lineTotalCents, 0);
  const vatCents = input.vatOn ? Math.round(subtotalCents * VAT_RATE) : 0;
  const totalCents = subtotalCents + vatCents;
  const sale: Sale = {
    id: newId(),
    createdAt: now,
    lines,
    subtotalCents,
    vatCents,
    totalCents,
    paymentMethod: input.paymentMethod,
    cashTenderedCents: input.cashTenderedCents,
    changeCents:
      input.paymentMethod === 'cash' && input.cashTenderedCents !== undefined
        ? input.cashTenderedCents - totalCents
        : undefined,
    status: 'completed',
  };

  await db.transaction('rw', db.sales, db.movements, db.products, async () => {
    await db.sales.add(sale);
    for (const line of lines) {
      await db.movements.add({
        id: newId(),
        type: 'sale',
        productId: line.productId,
        qtyDelta: -line.qty,
        referenceId: sale.id,
        createdAt: now,
      });
      const product = await db.products.get(line.productId);
      if (product) await db.products.update(line.productId, { stockOnHand: product.stockOnHand - line.qty, updatedAt: now });
    }
  });

  return sale;
}

export async function voidSale(saleId: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.sales, db.movements, db.products, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale || sale.status === 'voided') return;
    await db.sales.update(saleId, { status: 'voided', voidedAt: now });
    for (const line of sale.lines) {
      await db.movements.add({
        id: newId(),
        type: 'refund',
        productId: line.productId,
        qtyDelta: line.qty,
        referenceId: sale.id,
        createdAt: now,
      });
      const product = await db.products.get(line.productId);
      if (product) await db.products.update(line.productId, { stockOnHand: product.stockOnHand + line.qty, updatedAt: now });
    }
  });
}

export async function recentSales(limit = 50): Promise<Sale[]> {
  const rows = await db.sales.orderBy('createdAt').reverse().limit(limit).toArray();
  return rows;
}

export async function salesToday(): Promise<Sale[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const all = await db.sales.where('createdAt').aboveOrEqual(startOfDay.getTime()).toArray();
  return all.filter((s) => s.status === 'completed');
}

// ---------- receiving ----------

export interface ReceiptLineInput {
  productId: string;
  name: string;
  qty: number;
  unitCostCents: number;
}

export async function receiveDelivery(lines: ReceiptLineInput[], supplier?: string): Promise<Receipt> {
  const now = Date.now();
  const receiptLines: ReceiptLine[] = lines.map((l) => ({
    productId: l.productId,
    name: l.name,
    qty: l.qty,
    unitCostCents: l.unitCostCents,
    lineTotalCents: l.qty * l.unitCostCents,
  }));
  const receipt: Receipt = {
    id: newId(),
    createdAt: now,
    supplier,
    lines: receiptLines,
    totalCostCents: receiptLines.reduce((a, l) => a + l.lineTotalCents, 0),
  };

  await db.transaction('rw', db.receipts, db.movements, db.products, async () => {
    await db.receipts.add(receipt);
    for (const line of receiptLines) {
      await db.movements.add({
        id: newId(),
        type: 'receive',
        productId: line.productId,
        qtyDelta: line.qty,
        unitCostCents: line.unitCostCents,
        referenceId: receipt.id,
        createdAt: now,
      });
      const product = await db.products.get(line.productId);
      if (product) {
        await db.products.update(line.productId, {
          stockOnHand: product.stockOnHand + line.qty,
          lastCostCents: line.unitCostCents,
          updatedAt: now,
        });
      }
    }
  });

  return receipt;
}

// ---------- stock take ----------

export async function startStockTake(): Promise<StockTake> {
  const now = Date.now();
  const products = await db.products.toArray();
  const stockTake: StockTake = {
    id: newId(),
    status: 'in_progress',
    startedAt: now,
    lines: products.map((p) => ({
      productId: p.id,
      name: p.name,
      expectedQty: p.stockOnHand,
      countedQty: 0,
      counted: false,
    })),
  };
  await db.stockTakes.add(stockTake);
  return stockTake;
}

export async function addStockTakeCount(stockTakeId: string, productId: string, qtyToAdd: number): Promise<void> {
  const st = await db.stockTakes.get(stockTakeId);
  if (!st) return;
  const line = st.lines.find((l) => l.productId === productId);
  if (!line) return;
  line.countedQty += qtyToAdd;
  line.counted = true;
  await db.stockTakes.update(stockTakeId, { lines: st.lines });
}

export async function setStockTakeCount(stockTakeId: string, productId: string, countedQty: number): Promise<void> {
  const st = await db.stockTakes.get(stockTakeId);
  if (!st) return;
  const line = st.lines.find((l) => l.productId === productId);
  if (!line) return;
  line.countedQty = countedQty;
  line.counted = true;
  await db.stockTakes.update(stockTakeId, { lines: st.lines });
}

export interface VarianceRow {
  productId: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  counted: boolean;
  diffQty: number;
  diffValueCents: number;
}

export interface VarianceReport {
  rows: VarianceRow[];
  totalShrinkageValueCents: number; // sum of negative diffValueCents (loss only)
  totalVarianceValueCents: number; // sum of all diffValueCents (loss and gain)
}

export async function computeVarianceReport(
  stockTakeId: string,
  uncountedPolicy: 'zero' | 'leave'
): Promise<VarianceReport> {
  const st = await db.stockTakes.get(stockTakeId);
  if (!st) throw new Error('stock take not found');
  const products = await db.products.toArray();
  const costByProduct = new Map(products.map((p) => [p.id, p.lastCostCents]));

  const rows: VarianceRow[] = st.lines.map((l) => {
    const effectiveCounted = l.counted ? l.countedQty : uncountedPolicy === 'zero' ? 0 : l.expectedQty;
    const diffQty = effectiveCounted - l.expectedQty;
    const cost = costByProduct.get(l.productId) ?? 0;
    return {
      productId: l.productId,
      name: l.name,
      expectedQty: l.expectedQty,
      countedQty: effectiveCounted,
      counted: l.counted,
      diffQty,
      diffValueCents: diffQty * cost,
    };
  });

  return {
    rows,
    totalShrinkageValueCents: rows.filter((r) => r.diffValueCents < 0).reduce((a, r) => a + r.diffValueCents, 0),
    totalVarianceValueCents: rows.reduce((a, r) => a + r.diffValueCents, 0),
  };
}

export async function applyStockTake(stockTakeId: string, uncountedPolicy: 'zero' | 'leave'): Promise<VarianceReport> {
  const report = await computeVarianceReport(stockTakeId, uncountedPolicy);
  const now = Date.now();

  await db.transaction('rw', db.stockTakes, db.movements, db.products, async () => {
    for (const row of report.rows) {
      if (row.diffQty === 0) continue;
      await db.movements.add({
        id: newId(),
        type: 'count_adjust',
        productId: row.productId,
        qtyDelta: row.diffQty,
        referenceId: stockTakeId,
        createdAt: now,
      });
      const product = await db.products.get(row.productId);
      if (product) await db.products.update(row.productId, { stockOnHand: row.countedQty, updatedAt: now });
    }
    const st = await db.stockTakes.get(stockTakeId);
    if (st) {
      await db.stockTakes.update(stockTakeId, {
        status: 'applied',
        finishedAt: now,
        lines: st.lines.map((l) => {
          const row = report.rows.find((r) => r.productId === l.productId)!;
          return { ...l, countedQty: row.countedQty, counted: true };
        }),
      });
    }
  });

  return report;
}

// ---------- reports ----------

export async function stockValueAtCost(): Promise<number> {
  const products = await db.products.toArray();
  return products.reduce((a, p) => a + p.stockOnHand * p.lastCostCents, 0);
}

export async function grossProfitEstimate(sales: Sale[]): Promise<number> {
  const products = await db.products.toArray();
  const costByProduct = new Map(products.map((p) => [p.id, p.lastCostCents]));
  let total = 0;
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    for (const line of sale.lines) {
      const cost = costByProduct.get(line.productId) ?? 0;
      total += (line.unitPriceCents - cost) * line.qty;
    }
  }
  return total;
}

export function topSellers(sales: Sale[], limit = 10): { productId: string; name: string; qty: number; revenueCents: number }[] {
  const byProduct = new Map<string, { productId: string; name: string; qty: number; revenueCents: number }>();
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    for (const line of sale.lines) {
      const existing = byProduct.get(line.productId) ?? { productId: line.productId, name: line.name, qty: 0, revenueCents: 0 };
      existing.qty += line.qty;
      existing.revenueCents += line.lineTotalCents;
      byProduct.set(line.productId, existing);
    }
  }
  return Array.from(byProduct.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

// ---------- backup / reset / demo ----------

export interface Backup {
  version: 1;
  exportedAt: number;
  products: Product[];
  packs: Pack[];
  movements: Movement[];
  sales: Sale[];
  receipts: Receipt[];
  stockTakes: StockTake[];
  settings: Settings[];
}

export async function exportBackup(): Promise<Backup> {
  const [products, packs, movements, sales, receipts, stockTakes, settings] = await Promise.all([
    db.products.toArray(),
    db.packs.toArray(),
    db.movements.toArray(),
    db.sales.toArray(),
    db.receipts.toArray(),
    db.stockTakes.toArray(),
    db.settings.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), products, packs, movements, sales, receipts, stockTakes, settings };
}

export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction(
    'rw',
    [db.products, db.packs, db.movements, db.sales, db.receipts, db.stockTakes, db.settings],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.packs.clear(),
        db.movements.clear(),
        db.sales.clear(),
        db.receipts.clear(),
        db.stockTakes.clear(),
        db.settings.clear(),
      ]);
      await Promise.all([
        db.products.bulkAdd(backup.products),
        db.packs.bulkAdd(backup.packs),
        db.movements.bulkAdd(backup.movements),
        db.sales.bulkAdd(backup.sales),
        db.receipts.bulkAdd(backup.receipts),
        db.stockTakes.bulkAdd(backup.stockTakes),
        db.settings.bulkAdd(backup.settings),
      ]);
    }
  );
}

export async function resetAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.products, db.packs, db.movements, db.sales, db.receipts, db.stockTakes, db.settings],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.packs.clear(),
        db.movements.clear(),
        db.sales.clear(),
        db.receipts.clear(),
        db.stockTakes.clear(),
      ]);
    }
  );
}

export async function isEmpty(): Promise<boolean> {
  return (await db.products.count()) === 0;
}
