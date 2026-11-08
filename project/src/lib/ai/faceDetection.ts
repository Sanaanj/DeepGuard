import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let faceModel: blazeface.BlazeFaceModel | null = null;
let faceModelLoading: Promise<blazeface.BlazeFaceModel> | null = null;

export interface DetectedFace {
  topLeft: [number, number];
  bottomRight: [number, number];
  landmarks?: number[][];
  probability: number;
}

export async function getFaceDetector(): Promise<blazeface.BlazeFaceModel> {
  if (faceModel) return faceModel;
  if (faceModelLoading) return faceModelLoading;

  faceModelLoading = (async () => {
    await tf.ready();
    const model = await blazeface.load();
    faceModel = model;
    return model;
  })();

  return faceModelLoading;
}

export async function detectFaces(
  imageData: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
): Promise<DetectedFace[]> {
  const detector = await getFaceDetector();
  const predictions = await detector.estimateFaces(imageData, false);

  return predictions.map((p) => ({
    topLeft: p.topLeft as [number, number],
    bottomRight: p.bottomRight as [number, number],
    landmarks: p.landmarks as number[][] | undefined,
    probability: p.probability as number,
  }));
}

/**
 * Extract and preprocess a face region from an image/video frame.
 * Aligns, resizes to 128x128, and normalizes the face for the CNN.
 */
export function extractFaceTensor(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  face: DetectedFace,
  targetSize: number = 128
): tf.Tensor3D {
  const [x1, y1] = face.topLeft;
  const [x2, y2] = face.bottomRight;

  const faceWidth = x2 - x1;
  const faceHeight = y2 - y1;

  // Expand face region slightly for context
  const expandRatio = 0.1;
  const expandX = faceWidth * expandRatio;
  const expandY = faceHeight * expandRatio;

  const sx = Math.max(0, x1 - expandX);
  const sy = Math.max(0, y1 - expandY);
  const sw = faceWidth + 2 * expandX;
  const sh = faceHeight + 2 * expandY;

  // Create a canvas to crop the face
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetSize, targetSize);

  // Convert to tensor
  const tensor = tf.browser.fromPixels(canvas);
  // Normalize to [0, 1]
  const normalized = tensor.div(255.0);

  tensor.dispose();
  return normalized as tf.Tensor3D;
}

/**
 * Get the full image as a tensor for analysis without face cropping.
 */
export function imageToTensor(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  targetSize: number = 128
): tf.Tensor3D {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, targetSize, targetSize);
  const tensor = tf.browser.fromPixels(canvas);
  const normalized = tensor.div(255.0);
  tensor.dispose();
  return normalized as tf.Tensor3D;
}

export function disposeFaceDetector() {
  faceModel = null;
  faceModelLoading = null;
}
