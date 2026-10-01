# Spaza POS

An offline-first prototype for testing a spaza shop's day-to-day workflow: receiving
stock, selling at the till, and doing a stock take. No backend, no accounts — everything
lives in the browser's IndexedDB (via Dexie). Built to be tried with real shop owners on
a cheap Android phone, not to be a finished product.

Barcode scanning uses the browser's native `BarcodeDetector` where available, falling
back to [`@zxing/library`](https://github.com/zxing-js/library). "Type code" and "Search
by name" are always available if the camera isn't usable.

## Running locally

```sh
npm install
npm run dev
```

Opens on `http://localhost:5174`. Go to **Settings → Load demo data** to seed ~15 typical
spaza products (Koo Baked Beans, Lucky Star Pilchards, Albany Bread, etc.), including one
box/pack barcode (a 24-can case of Koo Baked Beans) and a few no-barcode favourites
(loose sweets, single cigarettes). The "Try a sample barcode" flow on each scan screen
also only exists conceptually via demo data's real barcodes — type one in with **Type
code** if you're on a laptop with no camera, e.g. `6001234500018` for the demo beans.

## Testing on a phone (camera needs HTTPS)

`npm run dev` is plain HTTP, so the live camera won't work on a phone unless you tunnel
it over HTTPS:

```sh
# either
npx ngrok http 5174
# or
cloudflared tunnel --url http://localhost:5174
```

Open the HTTPS URL it gives you on the phone. Or build (`npm run build`) and drag the
`dist/` folder onto [Netlify Drop](https://app.netlify.com/drop) for a real HTTPS URL in
seconds — no account needed for a quick test.

Once opened over HTTPS, the browser will offer to install it ("Add to Home Screen" /
install prompt) — it then runs full-screen and works offline after that first load.

## Building

```sh
npm run build   # outputs to dist/, a static site you can host anywhere over HTTPS
npm test        # Vitest: money math, EAN-13 check digits, and the full stock-ledger
                 # acceptance scenario (receive → sell → void → sell → stock take → apply)
```

## Backing up data

Everything is local to the browser/device. **Settings → Export backup (JSON)** downloads
every table (products, packs, movements, sales, receipts, stock takes); **Import backup**
restores from that file (this replaces whatever's currently stored). CSV export is also
available for products and the movement ledger, for opening in a spreadsheet.

## What's simplified or skipped, and rough edges

- **One device, no sync.** Each phone/browser has its own separate data. Fine for one
  person testing a till; not fine for multiple tills or multiple staff sharing stock.
- **VAT is treated as added on top** of the stored sell price when the toggle is on
  (`total = subtotal × 1.15`), not as already included in the sticker price. Real spaza
  pricing is usually VAT-inclusive already — if that matters for the test, it's a one-line
  change in `src/db.ts`'s `completeSale`.
- **Negative stock is allowed, not blocked** — selling more than what's on hand just shows
  a warning. This is deliberate (the spec calls out that early stock records are often
  wrong), but it means the stock count can go negative and stay there until a stock take
  corrects it.
- **No receipt/till-slip printing** — only barcode labels print (via the browser's own
  print dialog). There's no customer-facing receipt output.
- **Torch toggle depends on the phone/browser** supporting `ImageCapture`/torch
  constraints — some Android browsers don't expose it, in which case the button just
  doesn't appear.
- **The stock-take "treat uncounted as" choice is global**, not per item — it applies to
  every uncounted product at once when you finish a count, not a per-product decision.
- **No customer credit ("book") accounts yet** — out of scope per the spec, but the data
  model doesn't block adding a `customers` table + a `credit` movement/sale type later.
- **No supplier ordering, no card-machine integration** — out of scope per the spec.
- **Reports are plain tables, no charts.**
