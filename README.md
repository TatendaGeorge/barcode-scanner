# Pocket Barcode Scanner

A small installable web app that scans barcodes (EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar, QR, Data Matrix, PDF417, Aztec) using either the browser's native `BarcodeDetector` API or the [ZXing](https://github.com/zxing-js/library) JS decoder as a fallback — entirely client-side, no server or backend required.

- Live camera scanning (needs HTTPS + camera permission)
- Scan from a photo (file picker, works even where live camera access is blocked)
- A generated sample barcode to try it instantly
- EAN/UPC check-digit validation and GS1 country-prefix lookup
- Session scan log, copy-to-clipboard
- Installable as a PWA (manifest + service worker + app icons), works offline after the first load

## Running locally

It's a static site — serve the folder with anything:

```sh
npx serve .
# or
python3 -m http.server 8080
```

## Deployment

Plain static files behind nginx (see `Dockerfile`) — no build step.
