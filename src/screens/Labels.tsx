import { useEffect, useRef, useState } from 'preact/hooks';
import JsBarcode from 'jsbarcode';
import { searchProducts, type Product } from '../db';
import { useQueryParams } from '../router';
import { t } from '../strings';

function LabelCard({ product }: { product: Product }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && product.barcodes[0]) {
      JsBarcode(ref.current, product.barcodes[0], { format: 'EAN13', width: 1.6, height: 50, fontSize: 12, margin: 4 });
    }
  }, [product]);
  return (
    <div class="label-card">
      <div style={{ fontWeight: 700, fontSize: 12 }}>{product.name}</div>
      <svg ref={ref} />
    </div>
  );
}

export function Labels() {
  const params = useQueryParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    searchProducts('').then((all) => {
      const withBarcode = all.filter((p) => p.barcodes.length > 0);
      setProducts(withBarcode);
      const preselect = params.get('product');
      if (preselect) setSelected(new Set([preselect]));
    });
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedProducts = products.filter((p) => selected.has(p.id));

  return (
    <div class="screen">
      <h1 class="screen-title">{t.labels.title}</h1>

      <div class="label" style={{ marginBottom: -4 }}>{t.labels.selectItems}</div>
      <ul class="list">
        {products.map((p) => (
          <li key={p.id}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <span class="row-main">
                <span class="row-title">{p.name}</span>
                <span class="row-sub money">{p.barcodes[0]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <button type="button" class="btn primary wide" disabled={selectedProducts.length === 0} onClick={() => window.print()}>
        {t.labels.printPage}
      </button>
      {selectedProducts.length === 0 && <p class="screen-sub">{t.labels.noneSelected}</p>}

      <div class="labels-print">
        {selectedProducts.map((p) => (
          <LabelCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
