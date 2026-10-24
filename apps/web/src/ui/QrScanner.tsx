import { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanLine } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Modal } from './Modal';

/** How often a camera frame is checked for a QR code. */
const SCAN_EVERY_MS = 250;

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

/** Reads one QR code from a video frame: the browser's own detector where there is one, else jsQR. */
async function makeReader(): Promise<(video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const Native = (window as Window & { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    const detector = new Native({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  return async (video, canvas) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return jsQR(context.getImageData(0, 0, width, height).data, width, height)?.data ?? null;
  };
}

/**
 * The phone's back camera in a dialog, reading QR codes until `onResult` accepts one (returns
 * true). A code it does not accept shows `rejectedText` and the scan goes on.
 */
export function QrScanner({
  onResult,
  onClose,
  rejectedText,
}: {
  onResult: (text: string) => boolean;
  onClose: () => void;
  rejectedText: string;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const accept = useRef(onResult);
  accept.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let active = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!active || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
        const read = await makeReader();
        const scan = async () => {
          if (!active || !video.current || !canvas.current) return;
          const text = await read(video.current, canvas.current).catch(() => null);
          if (!active) return;
          if (text) {
            if (accept.current(text)) return;
            setRejected(true);
          }
          timer = window.setTimeout(() => void scan(), SCAN_EVERY_MS);
        };
        void scan();
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <Modal labelledBy="qr-scanner-title" onClose={onClose} className="max-w-md" testId="qr-scanner">
      <div className="flex flex-col gap-space-md">
        <h3 id="qr-scanner-title" className="flex items-center gap-space-xs text-headline-sm text-on-surface">
          <ScanLine className="h-6 w-6 text-secondary" />
          {t('scanner.title')}
        </h3>
        {failed ? (
          <p className="flex items-start gap-space-xs text-body-md text-on-surface-variant" data-testid="qr-scanner-failed">
            <CameraOff className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            {t('scanner.noCamera')}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={video} className="aspect-square w-full object-cover" muted playsInline data-testid="qr-scanner-video" />
            <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-secondary/80" />
          </div>
        )}
        <canvas ref={canvas} className="hidden" />
        {rejected && !failed && (
          <p role="status" className="text-body-sm text-secondary">
            {rejectedText}
          </p>
        )}
        <p className="text-body-sm text-on-surface-variant">{t('scanner.hint')}</p>
      </div>
    </Modal>
  );
}
