import { addProduct, linkPack, type Product } from './db';

// All codes below are made up but valid EAN-13 (prefix 600, correct check digit) so the
// built-in validator and the sample-barcode generator both treat them as real-looking stock.

interface DemoProduct {
  name: string;
  barcode?: string;
  sellPriceCents: number;
  costCents: number;
  reorderLevel: number;
  category: string;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { name: 'Koo Baked Beans 410g', barcode: '6001234500018', sellPriceCents: 1600, costCents: 950, reorderLevel: 10, category: 'Tinned food' },
  { name: 'Lucky Star Pilchards 400g', barcode: '6001234500025', sellPriceCents: 2300, costCents: 1700, reorderLevel: 8, category: 'Tinned food' },
  { name: 'White Star Maize Meal 2.5kg', barcode: '6001234500032', sellPriceCents: 4700, costCents: 3900, reorderLevel: 6, category: 'Staples' },
  { name: 'Albany White Bread 700g', barcode: '6001234500049', sellPriceCents: 1850, costCents: 1400, reorderLevel: 10, category: 'Bakery' },
  { name: 'Coca-Cola 2L', barcode: '6001234500056', sellPriceCents: 2800, costCents: 2100, reorderLevel: 8, category: 'Cooldrink' },
  { name: 'Simba Chips 36g', barcode: '6001234500063', sellPriceCents: 900, costCents: 600, reorderLevel: 12, category: 'Snacks' },
  { name: 'Joko Tea 26s', barcode: '6001234500070', sellPriceCents: 2400, costCents: 1800, reorderLevel: 6, category: 'Beverages' },
  { name: 'Sunlight Dishwashing Liquid 750ml', barcode: '6001234500087', sellPriceCents: 3200, costCents: 2500, reorderLevel: 5, category: 'Household' },
  { name: 'Huletts White Sugar 2.5kg', barcode: '6001234500094', sellPriceCents: 5200, costCents: 4400, reorderLevel: 5, category: 'Staples' },
  { name: 'Sasko Cake Flour 2.5kg', barcode: '6001234500100', sellPriceCents: 3800, costCents: 3100, reorderLevel: 5, category: 'Staples' },
  { name: 'Omo Washing Powder 2kg', barcode: '6001234500117', sellPriceCents: 6500, costCents: 5400, reorderLevel: 4, category: 'Household' },
  { name: 'Five Roses Tea 50s', barcode: '6001234500124', sellPriceCents: 3400, costCents: 2700, reorderLevel: 5, category: 'Beverages' },
  { name: 'Tastic Rice 2kg', barcode: '6001234500131', sellPriceCents: 4200, costCents: 3500, reorderLevel: 6, category: 'Staples' },
  { name: 'Bakers Tennis Biscuits 200g', barcode: '6001234500148', sellPriceCents: 1900, costCents: 1450, reorderLevel: 8, category: 'Snacks' },
  { name: 'Freshpak Rooibos 40s', barcode: '6001234500155', sellPriceCents: 2700, costCents: 2100, reorderLevel: 5, category: 'Beverages' },
];

// No-barcode items sold loose at the counter — these populate the Sell screen's
// favourites grid, per the spec's "bread, loose sweets, single cigarettes" examples.
export const DEMO_FAVOURITES: DemoProduct[] = [
  { name: 'Loose sweet (each)', sellPriceCents: 100, costCents: 50, reorderLevel: 20, category: 'Loose' },
  { name: 'Single cigarette', sellPriceCents: 300, costCents: 180, reorderLevel: 20, category: 'Loose' },
  { name: 'Plastic bag', sellPriceCents: 100, costCents: 30, reorderLevel: 20, category: 'Loose' },
];

export const KOO_BOX_BARCODE = '6001234590019';
export const KOO_BOX_QTY = 24;

export async function seedDemoData(): Promise<void> {
  const byName = new Map<string, Product>();

  for (const d of DEMO_PRODUCTS) {
    const p = await addProduct({
      name: d.name,
      barcodes: d.barcode ? [d.barcode] : [],
      sellPriceCents: d.sellPriceCents,
      lastCostCents: d.costCents,
      reorderLevel: d.reorderLevel,
      category: d.category,
      isDemo: true,
    });
    byName.set(d.name, p);
  }

  for (const d of DEMO_FAVOURITES) {
    await addProduct({
      name: d.name,
      barcodes: [],
      sellPriceCents: d.sellPriceCents,
      lastCostCents: d.costCents,
      reorderLevel: d.reorderLevel,
      category: d.category,
      isFavourite: true,
      isDemo: true,
    });
  }

  const koo = byName.get('Koo Baked Beans 410g');
  if (koo) await linkPack(KOO_BOX_BARCODE, koo.id, KOO_BOX_QTY);
}

/** Barcodes the "Try a sample barcode" generator can pick from on the Sell/Receive/Stock take screens. */
export function demoBarcodePool(): string[] {
  return DEMO_PRODUCTS.filter((d) => d.barcode).map((d) => d.barcode!);
}
