import { useEffect, useRef, useState } from 'preact/hooks';
import { Scanner } from '../lib/scanner';
import { t } from '../strings';

interface ScannerViewProps {
  onScan: (code: string, format: string) => void;
  /** Shown under the finder as a hint, e.g. "Hold the barcode inside the frame." */
  hint?: string;
}

export function ScannerView({ onScan, hint }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const [engine, setEngine] = useState('Loading decoder…');
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [status, setStatus] = useState('');
  const [statusErr, setStatusErr] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const scanner = new Scanner();
    scannerRef.current = scanner;
    scanner.init().then(() => setEngine(scanner.engineLabel));
    return () => scanner.stop();
  }, []);

  function handleDetect(text: string, format: string) {
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
    setStatus(`Read ${format}.`);
    setStatusErr(false);
    onScan(text, format);
  }

  async function startCamera() {
    const scanner = scannerRef.current;
    if (!scanner || !videoRef.current) return;
    setStatus('Starting camera…');
    setStatusErr(false);
    try {
      await scanner.start(videoRef.current, (r) => handleDetect(r.text, r.format));
      setRunning(true);
      setTorchAvailable(scanner.torchSupported);
      setStatus(hint || 'Hold the barcode inside the frame.');
    } catch (err) {
      const name = err instanceof Error ? err.message : 'error';
      setStatus(
        name === 'camera-unavailable'
          ? "Live camera isn't available here. Use Scan from photo, or open this page over HTTPS."
          : 'Camera access was blocked. Use Scan from photo instead.'
      );
      setStatusErr(true);
    }
  }

  function stopCamera() {
    scannerRef.current?.stop();
    setRunning(false);
    setTorchOn(false);
    setStatus('Camera stopped.');
  }

  async function toggleTorch() {
    const next = !torchOn;
    await scannerRef.current?.setTorch(next);
    setTorchOn(next);
  }

  async function onPhotoChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !scannerRef.current) return;
    setStatus('Decoding…');
    setStatusErr(false);
    const res = await scannerRef.current.decodeFile(file);
    if (res) {
      scannerRef.current.resetDebounce();
      handleDetect(res.text, res.format);
    } else {
      setStatus('No barcode found in that photo. Fill more of the frame, avoid glare, and try again.');
      setStatusErr(true);
    }
  }

  function submitManual(e: Event) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    scannerRef.current?.resetDebounce();
    handleDetect(code, 'Manual');
    setManualCode('');
    setShowManual(false);
  }

  return (
    <div class="panel" style={{ padding: 0, border: 0 }}>
      <div class={`finder ${running ? 'live' : ''} ${flash ? 'flash' : ''}`} id="finder">
        {!running && (
          <div class="idle">
            <strong>Point at a barcode</strong>
            Start the camera, or take a photo of a barcode.
          </div>
        )}
        <video ref={videoRef} playsInline muted hidden={!running} />
        <div class="corners" aria-hidden="true"><i /><i /><i /><i /></div>
        <div class="laser-line" aria-hidden="true" />
        {running && (
          <div class="scanner-tools">
            {torchAvailable && (
              <button type="button" class={`icon-btn ${torchOn ? 'on' : ''}`} onClick={toggleTorch} aria-label={t.common.torch}>
                ⚡
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 2px 0' }} class="engine">{engine}</div>

      <div class="btn-row" style={{ padding: '0 2px' }}>
        <button type="button" class="btn primary" onClick={running ? stopCamera : startCamera}>
          {running ? t.common.stopCamera : t.common.startCamera}
        </button>
        <label class="btn" for={`photo-${t.common.scanPhoto}`}>{t.common.scanPhoto}</label>
        <input id={`photo-${t.common.scanPhoto}`} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} />
        <button type="button" class="btn" onClick={() => setShowManual((v) => !v)}>
          {t.common.typeCode}
        </button>
      </div>

      {showManual && (
        <form class="btn-row" style={{ padding: '0 2px' }} onSubmit={submitManual}>
          <input
            class="field"
            style={{ flex: '1 1 160px', minHeight: 44, borderRadius: 10, border: '1px solid var(--line)', padding: '0 12px' }}
            inputMode="numeric"
            placeholder="e.g. 6001234500018"
            value={manualCode}
            onInput={(e) => setManualCode((e.target as HTMLInputElement).value)}
          />
          <button class="btn" type="submit">{t.common.add}</button>
        </form>
      )}

      {status && <p class={`status ${statusErr ? 'err' : ''}`} style={{ padding: '0 2px' }} role="status">{status}</p>}
    </div>
  );
}
