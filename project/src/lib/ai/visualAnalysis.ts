import * as tf from '@tensorflow/tfjs';
import type { DetectedFace } from './faceDetection';
import type { VisualAnalysisResult, ForensicIndicator } from '@/types';

/**
 * Analyze visual artifacts in the image/frame.
 * Examines texture, lighting, blending, noise, facial features, and compression.
 * These are supporting indicators, not the primary classifier.
 */
export async function analyzeVisualArtifacts(
  canvas: HTMLCanvasElement,
  faces: DetectedFace[]
): Promise<VisualAnalysisResult> {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // 1. Texture analysis - look for unnatural smoothness (common in deepfakes)
  const textureScore = analyzeTexture(pixels, width, height);

  // 2. Lighting consistency - check for inconsistent shadow directions
  const lightingScore = analyzeLighting(pixels, width, height, faces);

  // 3. Blending artifacts - check face boundary regions
  const blendingScore = faces.length > 0
    ? analyzeBlendingArtifacts(pixels, width, height, faces)
    : 0.2;

  // 4. Noise analysis - deepfakes often have inconsistent noise patterns
  const noiseScore = analyzeNoise(pixels, width, height);

  // 5. Facial feature consistency
  const facialFeatureScore = faces.length > 0
    ? analyzeFacialFeatures(faces)
    : 0.2;

  // 6. Compression artifacts
  const compressionScore = analyzeCompression(pixels, width, height);

  const findings: string[] = [];
  if (textureScore > 0.6) findings.push('Unusually smooth texture patterns detected in face region');
  if (lightingScore > 0.6) findings.push('Inconsistent lighting or shadow directions observed');
  if (blendingScore > 0.6) findings.push('Face boundary blending artifacts detected');
  if (noiseScore > 0.6) findings.push('Abnormal noise distribution patterns found');
  if (facialFeatureScore > 0.6) findings.push('Facial feature proportions show inconsistencies');
  if (compressionScore > 0.6) findings.push('Compression artifacts inconsistent with claimed format');

  if (findings.length === 0) {
    findings.push('No significant visual artifacts detected');
  }

  // Overall visual score - weighted combination
  const visualScore = (
    textureScore * 0.2 +
    lightingScore * 0.15 +
    blendingScore * 0.25 +
    noiseScore * 0.15 +
    facialFeatureScore * 0.15 +
    compressionScore * 0.1
  );

  return {
    score: Math.round(visualScore * 100) / 100,
    faceDetected: faces.length > 0,
    faceCount: faces.length,
    faceRegions: faces.map((f) => ({
      x: f.topLeft[0],
      y: f.topLeft[1],
      width: f.bottomRight[0] - f.topLeft[0],
      height: f.bottomRight[1] - f.topLeft[1],
    })),
    textureScore: Math.round(textureScore * 100) / 100,
    lightingScore: Math.round(lightingScore * 100) / 100,
    blendingScore: Math.round(blendingScore * 100) / 100,
    noiseScore: Math.round(noiseScore * 100) / 100,
    facialFeatureScore: Math.round(facialFeatureScore * 100) / 100,
    compressionScore: Math.round(compressionScore * 100) / 100,
    findings,
  };
}

/**
 * Texture analysis using Local Binary Pattern (LBP) approximation.
 * Deepfakes often produce unnaturally smooth skin textures.
 */
function analyzeTexture(pixels: Uint8ClampedArray, width: number, height: number): number {
  let smoothnessCount = 0;
  let totalCount = 0;
  const step = 4; // Sample every 4th pixel for performance

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = (y * width + x) * 4;
      const center = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;

      // Check local variance in 3x3 neighborhood
      let variance = 0;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          const nVal = (pixels[nIdx] + pixels[nIdx + 1] + pixels[nIdx + 2]) / 3;
          variance += Math.abs(nVal - center);
          neighbors++;
        }
      }
      variance /= neighbors;

      if (variance < 2) smoothnessCount++;
      totalCount++;
    }
  }

  // Higher smoothness ratio = more suspicious
  // Only flag if a significant majority of pixels are unnaturally smooth
  const smoothnessRatio = smoothnessCount / totalCount;
  return Math.min(1, Math.max(0, (smoothnessRatio - 0.5) * 2));
}

/**
 * Lighting consistency analysis.
 * Checks for inconsistent gradient directions that suggest compositing.
 */
function analyzeLighting(pixels: Uint8ClampedArray, width: number, height: number, faces: DetectedFace[]): number {
  if (faces.length === 0) return 0.3;

  // Analyze lighting gradient in face region vs surrounding area
  const face = faces[0];
  const [fx1, fy1] = face.topLeft;
  const [fx2, fy2] = face.bottomRight;

  // Sample brightness gradient in face region
  const faceGradients: number[] = [];
  const step = 4;
  for (let y = fy1; y < fy2 - step; y += step) {
    for (let x = fx1; x < fx2 - step; x += step) {
      if (y < 0 || y >= height - 1 || x < 0 || x >= width - 1) continue;
      const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
      const idxRight = (Math.floor(y) * width + Math.floor(x) + step) * 4;
      const idxDown = ((Math.floor(y) + step) * width + Math.floor(x)) * 4;

      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      const brightnessRight = (pixels[idxRight] + pixels[idxRight + 1] + pixels[idxRight + 2]) / 3;
      const brightnessDown = (pixels[idxDown] + pixels[idxDown + 1] + pixels[idxDown + 2]) / 3;

      faceGradients.push(Math.abs(brightnessRight - brightness));
      faceGradients.push(Math.abs(brightnessDown - brightness));
    }
  }

  // Sample gradient in surrounding area
  const surroundGradients: number[] = [];
  const padding = 20;
  for (let y = Math.max(0, fy1 - padding); y < Math.min(height, fy2 + padding); y += step) {
    for (let x = Math.max(0, fx1 - padding); x < Math.min(width, fx2 + padding); x += step) {
      if (x >= fx1 && x <= fx2 && y >= fy1 && y <= fy2) continue;
      if (y < 0 || y >= height - 1 || x < 0 || x >= width - 1) continue;
      const idx = (y * width + x) * 4;
      const idxRight = (y * width + x + step) * 4;
      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      const brightnessRight = (pixels[idxRight] + pixels[idxRight + 1] + pixels[idxRight + 2]) / 3;
      surroundGradients.push(Math.abs(brightnessRight - brightness));
    }
  }

  const faceMean = avg(faceGradients);
  const surroundMean = avg(surroundGradients);

  if (faceMean === 0 || surroundMean === 0) return 0.3;

  // Large discrepancy suggests inconsistent lighting
  const ratio = Math.abs(faceMean - surroundMean) / Math.max(faceMean, surroundMean);
  return Math.min(1, ratio * 2);
}

/**
 * Blending artifact analysis at face boundaries.
 */
function analyzeBlendingArtifacts(pixels: Uint8ClampedArray, width: number, height: number, faces: DetectedFace[]): number {
  const face = faces[0];
  const [fx1, fy1] = face.topLeft;
  const [fx2, fy2] = face.bottomRight;

  // Analyze edge transition sharpness around face boundary
  const edgeStrengths: number[] = [];
  const samples = 20;

  // Sample along the right edge of the face
  for (let i = 0; i < samples; i++) {
    const y = fy1 + ((fy2 - fy1) * i) / samples;
    const x = Math.floor(fx2);
    if (x + 2 >= width || y >= height) continue;

    const insideIdx = (Math.floor(y) * width + Math.max(0, x - 1)) * 4;
    const outsideIdx = (Math.floor(y) * width + Math.min(width - 1, x + 1)) * 4;

    const insideBrightness = (pixels[insideIdx] + pixels[insideIdx + 1] + pixels[insideIdx + 2]) / 3;
    const outsideBrightness = (pixels[outsideIdx] + pixels[outsideIdx + 1] + pixels[outsideIdx + 2]) / 3;

    edgeStrengths.push(Math.abs(insideBrightness - outsideBrightness));
  }

  // Very sharp or very soft edges can both indicate blending
  const meanEdge = avg(edgeStrengths);
  // Only flag extreme cases — normal camera photos have varied edge strengths
  let score = 0;
  if (meanEdge < 3) score = 0.6; // Extremely soft - possible blending
  else if (meanEdge > 120) score = 0.5; // Extremely sharp - possible pasting
  else score = Math.max(0, 0.15 - Math.abs(meanEdge - 30) / 200);

  return score;
}

/**
 * Noise analysis using local noise estimation.
 */
function analyzeNoise(pixels: Uint8ClampedArray, width: number, height: number): number {
  // Estimate noise using high-frequency content
  let noiseSum = 0;
  let count = 0;
  const step = 3;

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = (y * width + x) * 4;
      const center = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;

      // Laplacian kernel for high-frequency
      const laplacian =
        -4 * center +
        (pixels[(y * width + (x + 1)) * 4] + pixels[(y * width + (x - 1)) * 4] +
          pixels[((y + 1) * width + x) * 4] + pixels[((y - 1) * width + x) * 4]) / 3;

      noiseSum += Math.abs(laplacian);
      count++;
    }
  }

  const avgNoise = noiseSum / count;

  // Check for noise inconsistency by comparing quadrants
  const quadrantNoises: number[] = [];
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      let qNoise = 0;
      let qCount = 0;
      const startX = qx * halfW;
      const startY = qy * halfH;
      for (let y = startY + 1; y < startY + halfH - 1; y += step) {
        for (let x = startX + 1; x < startX + halfW - 1; x += step) {
          const idx = (y * width + x) * 4;
          const center = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
          const laplacian =
            -4 * center +
            (pixels[(y * width + (x + 1)) * 4] + pixels[(y * width + (x - 1)) * 4] +
              pixels[((y + 1) * width + x) * 4] + pixels[((y - 1) * width + x) * 4]) / 3;
          qNoise += Math.abs(laplacian);
          qCount++;
        }
      }
      quadrantNoises.push(qNoise / qCount);
    }
  }

  // Inconsistent noise across quadrants is suspicious
  // Normal photos can have moderate variation; only flag extreme inconsistency
  const noiseMean = avg(quadrantNoises);
  const noiseStd = stdDev(quadrantNoises);
  const inconsistency = noiseStd / (noiseMean + 1);

  return Math.min(1, Math.max(0, (inconsistency - 0.3) * 2));
}

/**
 * Facial feature consistency analysis.
 */
function analyzeFacialFeatures(faces: DetectedFace[]): number {
  if (faces.length === 0 || !faces[0].landmarks) return 0.5;

  const landmarks = faces[0].landmarks;
  if (landmarks.length < 6) return 0.5;

  // landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
  const rightEye = landmarks[0];
  const leftEye = landmarks[1];
  const nose = landmarks[2];
  const mouth = landmarks[3];

  // Check eye symmetry
  const eyeDist = Math.abs(rightEye[0] - leftEye[0]);
  const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
  const eyeMidY = (rightEye[1] + leftEye[1]) / 2;

  // Nose should be approximately below eye midpoint
  const noseOffsetX = Math.abs(nose[0] - eyeMidX) / eyeDist;
  // Mouth should be below nose
  const mouthBelowNose = mouth[1] > nose[1];

  // Eye level should be roughly horizontal
  const eyeLevelDiff = Math.abs(rightEye[1] - leftEye[1]) / eyeDist;

  let score = 0;
  if (noseOffsetX > 0.3) score += 0.3;
  if (!mouthBelowNose) score += 0.4;
  if (eyeLevelDiff > 0.2) score += 0.3;

  return Math.min(1, score);
}

/**
 * Compression artifact analysis.
 */
function analyzeCompression(pixels: Uint8ClampedArray, width: number, height: number): number {
  // Check for block artifacts (8x8 DCT blocks)
  let blockArtifacts = 0;
  let count = 0;
  const blockSize = 8;

  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      // Check for discontinuities at block boundaries
      for (let y = by; y < by + blockSize && y < height - 1; y++) {
        const x = bx + blockSize - 1;
        if (x >= width - 1) continue;
        const idx = (y * width + x) * 4;
        const idxNext = (y * width + x + 1) * 4;
        const diff = Math.abs(
          (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 -
          (pixels[idxNext] + pixels[idxNext + 1] + pixels[idxNext + 2]) / 3
        );
        blockArtifacts += diff;
        count++;
      }
    }
  }

  const avgBlock = blockArtifacts / count;
  // High block artifacts suggest double compression (possible manipulation)
  // Normal JPEG compression produces some block artifacts; only flag extreme cases
  return Math.min(1, Math.max(0, (avgBlock - 15) / 25));
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Generate forensic indicators from visual analysis.
 */
export function generateForensicIndicators(visual: VisualAnalysisResult): ForensicIndicator[] {
  const indicators: ForensicIndicator[] = [];

  // Only flag indicators above 0.6 — normal camera images should not trigger these
  if (visual.textureScore > 0.6) {
    indicators.push({
      name: 'Texture Inconsistency',
      severity: visual.textureScore > 0.8 ? 'high' : 'medium',
      description: 'Unnatural smoothness in skin texture regions — possible AI generation artifact',
      value: visual.textureScore,
      weight: 0.25,
    });
  }

  if (visual.lightingScore > 0.6) {
    indicators.push({
      name: 'Lighting Inconsistency',
      severity: visual.lightingScore > 0.8 ? 'high' : 'medium',
      description: 'Shadow and highlight directions inconsistent between face and surroundings',
      value: visual.lightingScore,
      weight: 0.15,
    });
  }

  if (visual.blendingScore > 0.6) {
    indicators.push({
      name: 'Blending Artifacts',
      severity: visual.blendingScore > 0.8 ? 'high' : 'medium',
      description: 'Face boundary shows signs of digital blending or compositing',
      value: visual.blendingScore,
      weight: 0.25,
    });
  }

  if (visual.noiseScore > 0.6) {
    indicators.push({
      name: 'Noise Abnormality',
      severity: visual.noiseScore > 0.8 ? 'high' : 'medium',
      description: 'Noise patterns inconsistent across image regions',
      value: visual.noiseScore,
      weight: 0.15,
    });
  }

  if (visual.facialFeatureScore > 0.6) {
    indicators.push({
      name: 'Facial Feature Inconsistency',
      severity: visual.facialFeatureScore > 0.8 ? 'high' : 'low',
      description: 'Facial landmark proportions deviate from expected geometry',
      value: visual.facialFeatureScore,
      weight: 0.15,
    });
  }

  if (visual.compressionScore > 0.6) {
    indicators.push({
      name: 'Compression Inconsistency',
      severity: 'low',
      description: 'Compression artifacts suggest possible re-encoding or double compression',
      value: visual.compressionScore,
      weight: 0.05,
    });
  }

  console.log('[DeepGuard] Forensic indicators generated:', indicators.length, indicators.map(i => `${i.name}=${i.value.toFixed(2)}`));
  return indicators;
}
