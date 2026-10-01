// Barcode decoding: the browser's native BarcodeDetector first, falling back to the
// @zxing/library decoder. Ported from the original single-page scanner, extended with
// continuous-scan mode (same-code debounce), a torch toggle, and a beep on each read.

import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  HTMLCanvasElementLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';

export interface DecodeResult {
  text: string;
  format: string;
}

const FORMAT_NAMES: Record<string, string> = {
  ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', code_128: 'Code 128', code_39: 'Code 39',
  code_93: 'Code 93', itf: 'ITF', codabar: 'Codabar', qr_code: 'QR code', data_matrix: 'Data Matrix',
  pdf417: 'PDF417', aztec: 'Aztec',
};

const SAME_CODE_DEBOUNCE_MS = 1500;

function zxingFormatName(f: BarcodeFormat): string {
  const n = BarcodeFormat[f];
  return FORMAT_NAMES[String(n).toLowerCase()] || String(n).replace(/_/g, ' ');
}

export class Scanner {
  private reader: BrowserMultiFormatReader | null = null;
  private detector: InstanceType<typeof window.BarcodeDetector> | null = null;
  private stream: MediaStream | null = null;
  private loopId: number | null = null;
  private lastCode: string | null = null;
  private lastCodeAt = 0;
  private audioCtx: AudioContext | null = null;

  /**
   * Browsers block audio that isn't tied to a user gesture, and a barcode read from the
   * camera's detection loop (a requestAnimationFrame callback) doesn't count as one — so
   * creating the AudioContext there, like the first version of this did, produced a
   * context stuck in "suspended" and no sound. Call this synchronously from an actual
   * click/change handler (Start camera, the photo input, the manual-entry form) to create
   * and resume the context while it still counts as gesture-triggered; every later beep()
   * then reuses that already-running context, including from the detection loop.
   */
  primeAudio(): void {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private beep(): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio not available — not fatal, vibration + flash still fire.
    }
  }

  /** Beep + vibrate. Public so callers can fire it uniformly for every scan source
   *  (camera, photo decode, manual entry), not just the live camera loop. */
  feedback(): void {
    this.beep();
    try {
      navigator.vibrate?.(60);
    } catch {
      // ignore
    }
  }

  async init(): Promise<'native' | 'zxing' | 'none'> {
    const hints = new Map();
    const F = BarcodeFormat;
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE, F.DATA_MATRIX,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    this.reader = new BrowserMultiFormatReader(hints);

    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats?.length) this.detector = new window.BarcodeDetector({ formats });
      } catch {
        // fall through to zxing-only
      }
    }
    return this.detector ? 'native' : this.reader ? 'zxing' : 'none';
  }

  get engineLabel(): string {
    return this.detector ? 'Built-in detector + ZXing' : this.reader ? 'ZXing decoder' : 'Decoder unavailable';
  }

  private accept(code: string): boolean {
    const now = Date.now();
    if (code === this.lastCode && now - this.lastCodeAt < SAME_CODE_DEBOUNCE_MS) return false;
    this.lastCode = code;
    this.lastCodeAt = now;
    return true;
  }

  /** Resets the debounce so the very next read of any code (including a repeat) is accepted. */
  resetDebounce(): void {
    this.lastCode = null;
  }

  async start(video: HTMLVideoElement, onDetect: (r: DecodeResult) => void): Promise<void> {
    this.primeAudio();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('camera-unavailable');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play().catch(() => {});

    if (this.detector) {
      let last = 0;
      const tick = async (ts: number) => {
        if (!this.stream) return;
        if (ts - last > 150 && video.readyState >= 2) {
          last = ts;
          try {
            const found = await this.detector!.detect(video);
            if (found?.length) {
              const f = found[0];
              const format = FORMAT_NAMES[f.format] || f.format;
              if (this.accept(f.rawValue)) {
                onDetect({ text: f.rawValue, format });
              }
            }
          } catch {
            // transient detection error, keep looping
          }
        }
        this.loopId = requestAnimationFrame(tick);
      };
      this.loopId = requestAnimationFrame(tick);
    } else if (this.reader) {
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      let last = 0;
      const tick = (ts: number) => {
        if (!this.stream) return;
        if (ts - last > 250 && video.readyState >= 2) {
          last = ts;
          cv.width = video.videoWidth;
          cv.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          try {
            const lum = new HTMLCanvasElementLuminanceSource(cv);
            const bmp = new BinaryBitmap(new HybridBinarizer(lum));
            const r = this.reader!.decodeBitmap(bmp);
            if (r) {
              const format = zxingFormatName(r.getBarcodeFormat());
              if (this.accept(r.getText())) {
                onDetect({ text: r.getText(), format });
              }
            }
          } catch {
            // no barcode in this frame
          }
        }
        this.loopId = requestAnimationFrame(tick);
      };
      this.loopId = requestAnimationFrame(tick);
    } else {
      throw new Error('decoder-unavailable');
    }
  }

  stop(): void {
    if (this.loopId !== null) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  get torchSupported(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return false;
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    return !!caps?.torch;
  }

  async setTorch(on: boolean): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }

  // ---------- still-image decoding (photo upload + generated sample) ----------

  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private static toCanvas(img: HTMLImageElement, maxSide: number, rotate: boolean): HTMLCanvasElement {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const cv = document.createElement('canvas');
    cv.width = rotate ? h : w;
    cv.height = rotate ? w : h;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (rotate) {
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return cv;
  }

  private async decodeCanvas(cv: HTMLCanvasElement): Promise<DecodeResult | null> {
    if (this.detector) {
      try {
        const found = await this.detector.detect(cv);
        if (found?.length) return { text: found[0].rawValue, format: FORMAT_NAMES[found[0].format] || found[0].format };
      } catch {
        // fall through to zxing
      }
    }
    if (this.reader) {
      try {
        const img = await Scanner.loadImage(cv.toDataURL('image/png'));
        const r = await this.reader.decodeFromImageElement(img);
        return { text: r.getText(), format: zxingFormatName(r.getBarcodeFormat()) };
      } catch {
        // no match
      }
    }
    return null;
  }

  async decodeImageSrc(src: string): Promise<DecodeResult | null> {
    const img = await Scanner.loadImage(src);
    const attempts: [number, boolean][] = [
      [1600, false],
      [900, false],
      [1600, true],
    ];
    for (const [size, rot] of attempts) {
      const res = await this.decodeCanvas(Scanner.toCanvas(img, size, rot));
      if (res) return res;
    }
    return null;
  }

  async decodeFile(file: File | Blob): Promise<DecodeResult | null> {
    const url = URL.createObjectURL(file);
    try {
      return await this.decodeImageSrc(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

declare global {
  interface Window {
    BarcodeDetector: {
      new (options?: { formats: string[] }): {
        detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
      };
      getSupportedFormats(): Promise<string[]>;
    };
  }
}
