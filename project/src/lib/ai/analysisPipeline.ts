import { detectFaces } from './faceDetection';
import { loadDetector, analyzeFrame, activeModelId } from './pretrainedDetector';
import { analyzeVisualArtifacts, generateForensicIndicators } from './visualAnalysis';
import { analyzeTemporalConsistency, buildFrameResults } from './temporalAnalysis';
import { analyzeAudio } from './audioAnalysis';
import { extractMetadata } from './metadataExtraction';
import { fuseEvidence } from './evidenceFusion';
import type {
  AnalysisResult,
  VisualAnalysisResult,
  TemporalAnalysisResult,
  AudioAnalysisResult,
  FrameResult,
  ForensicIndicator,
  MetadataInfo,
  EvidenceFusion,
  MediaType,
} from '@/types';

export interface AnalysisProgress {
  step: string;
  progress: number;
  detail?: string;
}

type ProgressCallback = (progress: AnalysisProgress) => void;

const ANALYSIS_STEPS = [
  'Initializing AI engine',
  'Validating file',
  'Preprocessing media',
  'Detecting faces',
  'Running CNN inference',
  'Analyzing visual artifacts',
  'Generating Grad-CAM heatmap',
  'Extracting metadata',
  'Fusing evidence',
  'Finalizing assessment',
];

/**
 * Determine the final result label from the combined score and confidence.
 * - combinedScore > 0.6 and confidence > 0.4 → manipulated
 * - combinedScore < 0.4 and confidence > 0.4 → authentic
 * - Otherwise → inconclusive (ambiguous evidence or low confidence)
 */
/** Final verdict comes straight from the pretrained detectors: fake or real, never "inconclusive". */
function decide(p: number): { result: 'authentic' | 'manipulated'; confidence: number; riskScore: number } {
  return {
    result: p >= 0.5 ? 'manipulated' : 'authentic',
    confidence: Math.max(p, 1 - p), // how sure the model is of the verdict it gave
    riskScore: Math.round(p * 100),
  };
}

function toGradcam(heat: number[][] | null, prediction: number) {
  if (!heat || heat.length === 0) return null;
  const h = heat.length;
  const w = heat[0].length;
  return { heatmap: Float32Array.from(heat.flat()), width: w, height: h, prediction };
}

/**
 * Generate a unique analysis ID.
 */
function generateAnalysisId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'DG-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Main analysis pipeline for images.
 */
export async function analyzeImage(
  file: File,
  imageElement: HTMLImageElement,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const startTime = performance.now();
  let stepIndex = 0;

  const report = (detail?: string) => {
    stepIndex++;
    onProgress?.({ step: ANALYSIS_STEPS[stepIndex - 1] || 'Processing', progress: (stepIndex / ANALYSIS_STEPS.length) * 100, detail });
  };

  report('Loading TensorFlow backend');
  console.log('[DeepGuard] === IMAGE ANALYSIS START ===');
  console.log('[DeepGuard] File:', file.name, 'Size:', file.size, 'Type:', file.type);
  await loadDetector();

  report('Preparing image canvas');
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0);
  console.log('[DeepGuard] Image dimensions:', canvas.width, 'x', canvas.height);

  // Scale down for face detection if too large
  const maxDim = 800;
  let detectionCanvas = canvas;
  if (canvas.width > maxDim || canvas.height > maxDim) {
    const scale = maxDim / Math.max(canvas.width, canvas.height);
    detectionCanvas = document.createElement('canvas');
    detectionCanvas.width = Math.floor(canvas.width * scale);
    detectionCanvas.height = Math.floor(canvas.height * scale);
    detectionCanvas.getContext('2d')!.drawImage(canvas, 0, 0, detectionCanvas.width, detectionCanvas.height);
  }

  report('Running face detection');
  const faces = await detectFaces(detectionCanvas);
  console.log('[DeepGuard] Faces detected:', faces.length);

  report('Running pretrained deepfake detector');
  let modelPrediction = 0.5;

  const scale = canvas.width / detectionCanvas.width;
  const scaledFaces = faces.map((f) => ({
    ...f,
    topLeft: [f.topLeft[0] * scale, f.topLeft[1] * scale] as [number, number],
    bottomRight: [f.bottomRight[0] * scale, f.bottomRight[1] * scale] as [number, number],
  }));

  const det = await analyzeFrame(canvas, scaledFaces, true);
  modelPrediction = det.probability;
  const gradcamResult = toGradcam(det.heatmap, modelPrediction);
  console.log('[DeepGuard] Detector P(fake):', modelPrediction);

  const visual = await analyzeVisualArtifacts(canvas, scaledFaces);
  return await completeImageAnalysis(
    file, imageElement, canvas, visual, scaledFaces, modelPrediction, gradcamResult, startTime, onProgress, stepIndex
  );
}

async function completeImageAnalysis(
  file: File,
  imageElement: HTMLImageElement,
  canvas: HTMLCanvasElement,
  visual: VisualAnalysisResult,
  faces: { topLeft: [number, number]; bottomRight: [number, number]; landmarks?: number[][]; probability: number }[],
  modelPrediction: number,
  gradcamResult: { heatmap: Float32Array; width: number; height: number; prediction: number } | null,
  startTime: number,
  onProgress?: ProgressCallback,
  stepIndex: number = 0
): Promise<AnalysisResult> {
  const report = (detail?: string) => {
    stepIndex++;
    onProgress?.({ step: ANALYSIS_STEPS[stepIndex - 1] || 'Processing', progress: (stepIndex / ANALYSIS_STEPS.length) * 100, detail });
  };

  report('Extracting metadata');
  const metadata = await extractMetadata(file, imageElement);

  report('Analyzing visual artifacts');
  const forensicIndicators = generateForensicIndicators(visual);

  // Temporal analysis not available for images
  const temporal: TemporalAnalysisResult = {
    available: false,
    frameCount: 1,
    consistencyScore: 0,
    flickerScore: 0,
    motionScore: 0,
    frameScores: [modelPrediction],
    suspiciousFrames: [],
    findings: ['Temporal analysis not applicable for static images'],
  };

  // Audio analysis not available for images
  const audio: AudioAnalysisResult = {
    available: false,
    implemented: true,
    spectralScore: 0,
    pitchScore: 0,
    noiseScore: 0,
    syncScore: 0,
    syntheticProbability: 0,
    findings: ['Audio analysis not applicable for images'],
  };

  report('Fusing evidence');
  const evidenceFusion = fuseEvidence(visual, temporal, audio, forensicIndicators, modelPrediction);

  // Generate heatmap visualization
  let heatmapDataUrl: string | undefined;
  let overlayDataUrl: string | undefined;

  if (gradcamResult) {
    const heatmapCanvas = createHeatmapCanvas(gradcamResult.heatmap, gradcamResult.width, gradcamResult.height, canvas.width, canvas.height);
    heatmapDataUrl = heatmapCanvas.toDataURL('image/jpeg', 0.8);

    const overlayCanvas = createOverlayCanvas(canvas, heatmapCanvas);
    overlayDataUrl = overlayCanvas.toDataURL('image/jpeg', 0.8);
  }

  const result: AnalysisResult = {
    analysisId: generateAnalysisId(),
    fileName: file.name,
    mediaType: 'image' as MediaType,
    ...decide(modelPrediction),
    modelPrediction,
    visualAnalysis: visual,
    temporalAnalysis: temporal,
    audioAnalysis: audio,
    forensicIndicators,
    metadataInfo: metadata,
    frameResults: [],
    gradcam: gradcamResult ? {
      heatmapDataUrl: heatmapDataUrl!,
      overlayDataUrl: overlayDataUrl!,
      topRegions: extractTopRegions(gradcamResult.heatmap, gradcamResult.width, gradcamResult.height),
    } : undefined,
    evidenceFusion,
    modelName: activeModelId,
    processingTimeMs: Math.round(performance.now() - startTime),
    timestamp: new Date().toISOString(),
    originalDataUrl: createScaledDataUrl(canvas, 600, 0.6),
    heatmapDataUrl,
    overlayDataUrl,
  };

  report('Complete');
  return result;
}

/**
 * Main analysis pipeline for videos.
 */
export async function analyzeVideo(
  file: File,
  videoElement: HTMLVideoElement,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const startTime = performance.now();
  let stepIndex = 0;

  const report = (detail?: string) => {
    stepIndex++;
    const steps = [
      'Initializing AI engine',
      'Validating file',
      'Preprocessing video',
      'Extracting frames',
      'Detecting faces in frames',
      'Running CNN inference on frames',
      'Analyzing visual artifacts',
      'Temporal consistency analysis',
      'Audio analysis',
      'Extracting metadata',
      'Fusing evidence',
      'Finalizing assessment',
    ];
    onProgress?.({ step: steps[Math.min(stepIndex - 1, steps.length - 1)] || 'Processing', progress: (stepIndex / steps.length) * 100, detail });
  };

  report('Loading pretrained detector');
  await loadDetector();

  report('Extracting video frames');
  const maxFrames = 16;
  const frames = await extractVideoFrames(videoElement, maxFrames);

  report('Detecting faces across frames');
  const frameFaceData: { topLeft: [number, number]; bottomRight: [number, number]; landmarks?: number[][]; probability: number }[][] = [];

  for (let i = 0; i < frames.length; i++) {
    const faces = await detectFaces(frames[i].canvas);
    frameFaceData.push(faces);
  }

  report('Running CNN inference on frames');
  const frameScores: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    const faces = frameFaceData[i];
    const score = (await analyzeFrame(frames[i].canvas, faces, false)).probability;

    // Use the raw CNN prediction — do NOT blend with visual score here
    // (visual score is a supporting indicator, not independent evidence)
    frameScores.push(score);
    console.log(`[DeepGuard] Frame ${i} CNN prediction: ${score.toFixed(4)}`);
  }

  report('Analyzing visual artifacts');
  // Use a representative frame (middle frame) for detailed visual analysis
  const representativeFrame = frames[Math.floor(frames.length / 2)] || frames[0];
  const representativeFaces = frameFaceData[Math.floor(frames.length / 2)] || frameFaceData[0] || [];
  const visual = await analyzeVisualArtifacts(representativeFrame.canvas, representativeFaces);

  // Grad-CAM heatmap for the frame the detector found most suspicious
  const peakIdx = frameScores.indexOf(Math.max(...frameScores));
  const peakDet = await analyzeFrame(frames[peakIdx].canvas, frameFaceData[peakIdx], true);
  const gradcamResult = toGradcam(peakDet.heatmap, peakDet.probability);
  let heatmapDataUrl: string | undefined;
  let overlayDataUrl: string | undefined;
  if (gradcamResult) {
    const peakCanvas = frames[peakIdx].canvas;
    const hm = createHeatmapCanvas(gradcamResult.heatmap, gradcamResult.width, gradcamResult.height, peakCanvas.width, peakCanvas.height);
    heatmapDataUrl = hm.toDataURL('image/jpeg', 0.8);
    overlayDataUrl = createOverlayCanvas(peakCanvas, hm).toDataURL('image/jpeg', 0.8);
  }

  report('Temporal consistency analysis');
  const temporal = await analyzeTemporalConsistency(frames, frameFaceData);
  // The graph must show the detector's per-frame scores, not the old pixel heuristics.
  temporal.frameScores = frameScores;

  report('Audio analysis');
  let audio: AudioAnalysisResult;
  try {
    audio = await analyzeAudio(videoElement);
  } catch {
    audio = {
      available: false,
      implemented: true,
      spectralScore: 0,
      pitchScore: 0,
      noiseScore: 0,
      syncScore: 0,
      syntheticProbability: 0,
      findings: ['Audio analysis could not be performed on this file'],
    };
  }

  report('Extracting metadata');
  const metadata = await extractMetadata(file, videoElement);

  report('Analyzing forensic indicators');
  const forensicIndicators = generateForensicIndicators(visual);

  // Use average frame score as model prediction
  const avgModelPrediction = frameScores.reduce((a, b) => a + b, 0) / frameScores.length;
  console.log('[DeepGuard] Video avg model prediction:', avgModelPrediction.toFixed(4),
    'from', frameScores.length, 'frames:', frameScores.map(s => s.toFixed(3)).join(', '));

  // Collect video metadata
  const videoMetadata = {
    duration: videoElement.duration,
    fps: 30, // Browser doesn't expose native FPS; estimated
    width: videoElement.videoWidth,
    height: videoElement.videoHeight,
    totalFrames: Math.round(videoElement.duration * 30),
    analyzedFrames: frames.length,
  };

  report('Fusing evidence');
  const evidenceFusion = fuseEvidence(visual, temporal, audio, forensicIndicators, avgModelPrediction);

  // Build frame results
  const frameResults: FrameResult[] = buildFrameResults(frames, frameScores, frameFaceData, temporal.suspiciousFrames);

  const result: AnalysisResult = {
    analysisId: generateAnalysisId(),
    fileName: file.name,
    mediaType: 'video' as MediaType,
    ...decide(avgModelPrediction),
    modelPrediction: avgModelPrediction,
    visualAnalysis: visual,
    temporalAnalysis: temporal,
    audioAnalysis: audio,
    forensicIndicators,
    metadataInfo: metadata,
    frameResults,
    gradcam: gradcamResult ? {
      heatmapDataUrl: heatmapDataUrl!,
      overlayDataUrl: overlayDataUrl!,
      topRegions: extractTopRegions(gradcamResult.heatmap, gradcamResult.width, gradcamResult.height),
    } : undefined,
    evidenceFusion,
    modelName: activeModelId,
    processingTimeMs: Math.round(performance.now() - startTime),
    timestamp: new Date().toISOString(),
    originalDataUrl: createScaledDataUrl(representativeFrame.canvas, 600, 0.6),
    heatmapDataUrl,
    overlayDataUrl,
    videoMetadata,
  } as AnalysisResult;

  report('Complete');
  return result;
}

/**
 * Extract frames from a video at regular intervals.
 */
async function extractVideoFrames(
  video: HTMLVideoElement,
  maxFrames: number
): Promise<{ canvas: HTMLCanvasElement; timestamp: number }[]> {
  const duration = video.duration;
  const frames: { canvas: HTMLCanvasElement; timestamp: number }[] = [];

  const interval = duration / maxFrames;

  for (let i = 0; i < maxFrames; i++) {
    const timestamp = interval * i;
    video.currentTime = Math.min(timestamp, duration - 0.1);

    // Wait for seek to complete
    await new Promise<void>((resolve) => {
      const handler = () => {
        video.removeEventListener('seeked', handler);
        resolve();
      };
      video.addEventListener('seeked', handler);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    frames.push({ canvas, timestamp });
  }

  return frames;
}

/**
 * Create a scaled-down JPEG data URL to keep storage size manageable.
 */
function createScaledDataUrl(canvas: HTMLCanvasElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  const scaled = document.createElement('canvas');
  scaled.width = Math.floor(canvas.width * scale);
  scaled.height = Math.floor(canvas.height * scale);
  scaled.getContext('2d')!.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  return scaled.toDataURL('image/jpeg', quality);
}

/**
 * Create a heatmap canvas from Grad-CAM data.
 */
function createHeatmapCanvas(
  heatmap: Float32Array,
  heatmapWidth: number,
  heatmapHeight: number,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  // Create small heatmap canvas
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = heatmapWidth;
  smallCanvas.height = heatmapHeight;
  const smallCtx = smallCanvas.getContext('2d')!;
  const imageData = smallCtx.createImageData(heatmapWidth, heatmapHeight);

  for (let i = 0; i < heatmap.length; i++) {
    const value = heatmap[i];
    // Jet colormap approximation
    const [r, g, b] = jetColormap(value);
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = Math.round(value * 255);
  }

  smallCtx.putImageData(imageData, 0, 0);

  // Scale up to target size
  const largeCanvas = document.createElement('canvas');
  largeCanvas.width = targetWidth;
  largeCanvas.height = targetHeight;
  const largeCtx = largeCanvas.getContext('2d')!;
  largeCtx.imageSmoothingEnabled = true;
  largeCtx.drawImage(smallCanvas, 0, 0, targetWidth, targetHeight);

  return largeCanvas;
}

/**
 * Create overlay of heatmap on original image.
 */
function createOverlayCanvas(original: HTMLCanvasElement, heatmap: HTMLCanvasElement): HTMLCanvasElement {
  const overlay = document.createElement('canvas');
  overlay.width = original.width;
  overlay.height = original.height;
  const ctx = overlay.getContext('2d')!;

  ctx.drawImage(original, 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(heatmap, 0, 0);
  ctx.globalAlpha = 1.0;

  return overlay;
}

/**
 * Jet colormap function.
 */
function jetColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));
  let r = 0, g = 0, b = 0;

  if (v < 0.25) {
    b = 255;
    g = v * 4 * 255;
  } else if (v < 0.5) {
    b = 255 - (v - 0.25) * 4 * 255;
    g = 255;
  } else if (v < 0.75) {
    g = 255;
    r = (v - 0.5) * 4 * 255;
  } else {
    r = 255;
    g = 255 - (v - 0.75) * 4 * 255;
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

/**
 * Extract top influential regions from heatmap.
 */
function extractTopRegions(
  heatmap: Float32Array,
  width: number,
  height: number
): { x: number; y: number; intensity: number; label: string }[] {
  const regions: { x: number; y: number; intensity: number; label: string }[] = [];
  const gridSize = 4;
  const cellW = Math.floor(width / gridSize);
  const cellH = Math.floor(height / gridSize);

  const cells: { x: number; y: number; intensity: number }[] = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let sum = 0;
      let count = 0;
      for (let y = gy * cellH; y < (gy + 1) * cellH; y++) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x++) {
          sum += heatmap[y * width + x];
          count++;
        }
      }
      cells.push({ x: gx, y: gy, intensity: sum / count });
    }
  }

  // Sort by intensity and take top 3
  cells.sort((a, b) => b.intensity - a.intensity);
  const labels = ['Face boundary region', 'Eye region', 'Mouth region', 'Skin texture area', 'Lighting transition zone'];

  for (let i = 0; i < Math.min(3, cells.length); i++) {
    if (cells[i].intensity > 0.3) {
      regions.push({
        x: cells[i].x,
        y: cells[i].y,
        intensity: cells[i].intensity,
        label: labels[i] || `Region ${i + 1}`,
      });
    }
  }

  return regions;
}
