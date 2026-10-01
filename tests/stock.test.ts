import { describe, it, expect, beforeAll } from 'vitest';
import {
  db,
  addProduct,
  linkPack,
  resolveBarcode,
  receiveDelivery,
  completeSale,
  voidSale,
  startStockTake,
  addStockTakeCount,
  applyStockTake,
  productHistory,
  resetAll,
  type Product,
  type Sale,
} from '../src/db';

// The acceptance scenario from the spec, run end-to-end against the real mutation
// helpers (Dexie backed by fake-indexeddb). Steps are numbered to match the spec.

const BOX_BARCODE = '6009999990018'; // made up, valid check digit, not a demo code

describe('spaza stock ledger — acceptance scenario', () => {
  let koo: Product;
  let firstSale: Sale;

  beforeAll(async () => {
    await resetAll();
    koo = await addProduct({ name: 'Koo Baked Beans 410g', barcodes: ['6001234500018'], sellPriceCents: 1600, lastCostCents: 0 });
    await linkPack(BOX_BARCODE, koo.id, 24);
  });

  it('1. starts at 0 stock', async () => {
    const p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(0);
  });

  it('2. receiving the box barcode once adds 24 at R9.50/can', async () => {
    const resolved = await resolveBarcode(BOX_BARCODE);
    expect(resolved).not.toBeNull();
    expect(resolved!.qty).toBe(24);

    await receiveDelivery([{ productId: koo.id, name: koo.name, qty: resolved!.qty, unitCostCents: 950 }]);

    const p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(24);
    expect(p!.lastCostCents).toBe(950);
  });

  it('3. selling 3 cans at R16, cash R50 tendered, gives R2 change and drops stock to 21', async () => {
    firstSale = await completeSale({
      lines: [{ productId: koo.id, name: koo.name, qty: 3, unitPriceCents: 1600 }],
      paymentMethod: 'cash',
      cashTenderedCents: 5000,
      vatOn: false,
    });

    expect(firstSale.totalCents).toBe(4800);
    expect(firstSale.changeCents).toBe(200);

    const p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(21);
  });

  it('4. voiding that sale restores stock to 24, then selling 3 again drops it to 21', async () => {
    await voidSale(firstSale.id);
    let p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(24);

    await completeSale({
      lines: [{ productId: koo.id, name: koo.name, qty: 3, unitPriceCents: 1600 }],
      paymentMethod: 'cash',
      cashTenderedCents: 5000,
      vatOn: false,
    });

    p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(21);
  });

  it('5. a stock take counting 20 shows -1 / -R9.50 variance and applies stock to 20', async () => {
    const st = await startStockTake();
    const line = st.lines.find((l) => l.productId === koo.id)!;
    expect(line.expectedQty).toBe(21);

    await addStockTakeCount(st.id, koo.id, 20);
    const report = await applyStockTake(st.id, 'leave');

    const row = report.rows.find((r) => r.productId === koo.id)!;
    expect(row.diffQty).toBe(-1);
    expect(row.diffValueCents).toBe(-950);

    const p = await db.products.get(koo.id);
    expect(p!.stockOnHand).toBe(20);
  });

  it("6. the product's movement ledger sums to stockOnHand", async () => {
    const history = await productHistory(koo.id);
    const sum = history.reduce((a, m) => a + m.qtyDelta, 0);
    const p = await db.products.get(koo.id);
    expect(sum).toBe(p!.stockOnHand);
    expect(sum).toBe(20);

    // One row per step: receive +24, sale -3, refund +3, sale -3, count_adjust -1.
    expect(history).toHaveLength(5);
    expect(history.filter((m) => m.type === 'receive')).toHaveLength(1);
    expect(history.filter((m) => m.type === 'sale')).toHaveLength(2);
    expect(history.filter((m) => m.type === 'refund')).toHaveLength(1);
    expect(history.filter((m) => m.type === 'count_adjust')).toHaveLength(1);
  });
});
