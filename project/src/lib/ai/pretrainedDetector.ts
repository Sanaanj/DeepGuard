import { setModelTrainedInStorage } from './evidenceFusion';

/**
 * Pretrained deepfake detector, served by the local Python backend in /backend.
 * (Running the ONNX model directly in the browser failed on some setups, so the
 * model now runs in PyTorch on your own machine. No training needed.)
 *
 * Backend URL can be changed with VITE_DETECTOR_URL in .env.
 */
export const DETECTOR_URL: string =
  (import.meta.env.VITE_DETECTOR_URL as string | undefined) || 'http://localhost:8000';

export let activeModelId = 'pretrained-detector';

let ready: Promise<void> | null = null;

export async function loadDetector(_onStatus?: (msg: string) => void): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      activeModelId = info.model ?? activeModelId;
      setModelTrainedInStorage(true);
      console.log('[DeepGuard] Detector backend ready:', info);
    } catch (err) {
      setModelTrainedInStorage(false);
      throw new Error(
        `Detector backend not reachable at ${DETECTOR_URL}. Start it with: ` +
          `cd backend && uvicorn main:app --port 8000  (${(err as Error).message})`
      );
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

const MAX_INPUT_DIM = 1024;

function toJpegBlob(canvas: HTMLCanvasElement): Promise<{ blob: Blob; scale: number }> {
  const m = Math.max(canvas.width, canvas.height);
  let c = canvas;
  let scale = 1;
  if (m > MAX_INPUT_DIM) {
    const k = MAX_INPUT_DIM / m;
    scale = k;
    c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  }
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve({ blob: b, scale }) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.95)
  );
}

export interface DetectorOutput {
  probability: number;          // P(fake) in [0,1]
  heatmap: number[][] | null;   // Grad-CAM grid (values 0..1), only when explain=true
}

/** Score one image / video frame. Large detected faces are also checked by the face-deepfake detector. */
export async function analyzeFrame(
  canvas: HTMLCanvasElement,
  faces: FaceBox[],
  explain = false
): Promise<DetectorOutput> {
  await loadDetector();
  const { blob, scale } = await toJpegBlob(canvas);
  const form = new FormData();
  form.append('file', blob, 'frame.jpg');
  // face boxes in the coordinates of the image that is actually sent
  form.append(
    'boxes',
    JSON.stringify(faces.map((f) => [f.topLeft[0] * scale, f.topLeft[1] * scale, f.bottomRight[0] * scale, f.bottomRight[1] * scale]))
  );
  form.append('explain', explain ? '1' : '0');
  const res = await fetch(`${DETECTOR_URL}/predict`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Detector error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  console.log('[DeepGuard] detector scores:', data.detectors);
  const p = Number(data.fake_probability);
  if (!Number.isFinite(p)) throw new Error('Detector returned an invalid score');
  return { probability: Math.max(0, Math.min(1, p)), heatmap: data.heatmap ?? null };
}

export interface FaceBox {
  topLeft: [number, number];
  bottomRight: [number, number];
}

export function cropFaceCanvas(source: HTMLCanvasElement, face: FaceBox, size = 224): HTMLCanvasElement {
  const [x1, y1] = face.topLeft;
  const [x2, y2] = face.bottomRight;
  const w = x2 - x1;
  const h = y2 - y1;
  const pad = 0.25;
  const sx = Math.max(0, x1 - w * pad);
  const sy = Math.max(0, y1 - h * pad);
  const sw = Math.min(source.width - sx, w * (1 + 2 * pad));
  const sh = Math.min(source.height - sy, h * (1 + 2 * pad));
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.getContext('2d')!.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
  return c;
}

/** Convenience wrapper that returns only the probability. */
export async function scoreFrame(canvas: HTMLCanvasElement, face?: FaceBox): Promise<number> {
  return (await analyzeFrame(canvas, face ? [face] : [], false)).probability;
}
