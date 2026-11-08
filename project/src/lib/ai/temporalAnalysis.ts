import type { DetectedFace } from './faceDetection';
import type { TemporalAnalysisResult, FrameResult } from '@/types';

/**
 * Temporal analysis for video deepfake detection.
 * Analyzes frame-to-frame consistency, flickering, and motion patterns.
 */
export async function analyzeTemporalConsistency(
  frames: { canvas: HTMLCanvasElement; timestamp: number }[],
  frameFaceData: DetectedFace[][]
): Promise<TemporalAnalysisResult> {
  if (frames.length < 2) {
    return {
      available: false,
      frameCount: frames.length,
      consistencyScore: 0,
      flickerScore: 0,
      motionScore: 0,
      frameScores: [],
      suspiciousFrames: [],
      findings: ['Insufficient frames for temporal analysis'],
    };
  }

  const frameScores: number[] = [];
  const brightnessHistory: number[] = [];
  const facePositionHistory: { x: number; y: number }[] = [];

  // Analyze each frame
  for (let i = 0; i < frames.length; i++) {
    const { canvas } = frames[i];
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Brightness
    let brightness = 0;
    const sampleStep = 4;
    let pixelCount = 0;
    for (let j = 0; j < pixels.length; j += 4 * sampleStep) {
      brightness += (pixels[j] + pixels[j + 1] + pixels[j + 2]) / 3;
      pixelCount++;
    }
    brightness /= pixelCount;
    brightnessHistory.push(brightness);

    // Face position
    const faces = frameFaceData[i];
    if (faces && faces.length > 0) {
      const face = faces[0];
      const cx = (face.topLeft[0] + face.bottomRight[0]) / 2;
      const cy = (face.topLeft[1] + face.bottomRight[1]) / 2;
      facePositionHistory.push({ x: cx, y: cy });
    } else {
      facePositionHistory.push(facePositionHistory[facePositionHistory.length - 1] || { x: 0, y: 0 });
    }

    // Per-frame manipulation score from pixel analysis
    let frameScore = 0;

    // Check local smoothness in face region
    if (faces && faces.length > 0) {
      const face = faces[0];
      const [fx1, fy1] = face.topLeft;
      const [fx2, fy2] = face.bottomRight;
      let smoothness = 0;
      let sCount = 0;
      for (let y = Math.floor(fy1); y < Math.floor(fy2) - 1; y += 2) {
        for (let x = Math.floor(fx1); x < Math.floor(fx2) - 1; x += 2) {
          if (y >= canvas.height || x >= canvas.width) continue;
          const idx = (y * canvas.width + x) * 4;
          const idxNext = (y * canvas.width + x + 1) * 4;
          const diff = Math.abs(
            (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 -
            (pixels[idxNext] + pixels[idxNext + 1] + pixels[idxNext + 2]) / 3
          );
          if (diff < 3) smoothness++;
          sCount++;
        }
      }
      frameScore = smoothness / sCount;
    }

    frameScores.push(Math.round(frameScore * 100) / 100);
  }

  // Flicker analysis - frame-to-frame brightness changes
  const brightnessChanges: number[] = [];
  for (let i = 1; i < brightnessHistory.length; i++) {
    brightnessChanges.push(Math.abs(brightnessHistory[i] - brightnessHistory[i - 1]));
  }
  const avgBrightnessChange = avg(brightnessChanges);
  const brightnessStd = stdDev(brightnessChanges);
  // High flicker = suspicious
  const flickerScore = Math.min(1, (brightnessStd / (avgBrightnessChange + 1)) * 0.5 + avgBrightnessChange / 50);

  // Motion consistency - face position should change smoothly
  const motionChanges: number[] = [];
  for (let i = 1; i < facePositionHistory.length; i++) {
    const dx = facePositionHistory[i].x - facePositionHistory[i - 1].x;
    const dy = facePositionHistory[i].y - facePositionHistory[i - 1].y;
    motionChanges.push(Math.sqrt(dx * dx + dy * dy));
  }
  const avgMotion = avg(motionChanges);
  const motionStd = stdDev(motionChanges);
  // Jerky motion (high std relative to mean) is suspicious
  const motionScore = Math.min(1, (motionStd / (avgMotion + 1)) * 0.5);

  // Frame score consistency
  const frameScoreStd = stdDev(frameScores);
  const frameScoreMean = avg(frameScores);
  // High variance in frame scores suggests inconsistent manipulation
  const consistencyScore = Math.min(1, (frameScoreStd / (frameScoreMean + 0.1)) * 0.5 + frameScoreMean * 0.5);

  // Identify suspicious frames (high individual score or outlier)
  const suspiciousFrames: number[] = [];
  const threshold = frameScoreMean + frameScoreStd;
  frameScores.forEach((score, idx) => {
    if (score > threshold || score > 0.7) {
      suspiciousFrames.push(idx);
    }
  });

  const findings: string[] = [];
  if (flickerScore > 0.5) findings.push('Unusual frame-to-frame brightness flickering detected');
  if (motionScore > 0.5) findings.push('Jerky or inconsistent facial motion patterns observed');
  if (consistencyScore > 0.5) findings.push('Frame analysis scores show high inconsistency');
  if (suspiciousFrames.length > frames.length * 0.3) findings.push(`${suspiciousFrames.length} frames flagged as potentially suspicious`);
  if (findings.length === 0) findings.push('Temporal analysis shows consistent frame-to-frame patterns');

  return {
    available: true,
    frameCount: frames.length,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
    flickerScore: Math.round(flickerScore * 100) / 100,
    motionScore: Math.round(motionScore * 100) / 100,
    frameScores,
    suspiciousFrames,
    findings,
  };
}

/**
 * Build frame results for display.
 */
export function buildFrameResults(
  frames: { canvas: HTMLCanvasElement; timestamp: number }[],
  frameScores: number[],
  faceData: DetectedFace[][],
  suspiciousFrames: number[]
): FrameResult[] {
  return frames.map((frame, i) => {
    const faces = faceData[i] || [];
    const isSuspicious = suspiciousFrames.includes(i);
    const thumbnail = frame.canvas.toDataURL('image/jpeg', 0.3);

    return {
      frameIndex: i,
      timestamp: frame.timestamp,
      manipulationProbability: frameScores[i] || 0,
      faceDetected: faces.length > 0,
      faceRegion: faces[0] ? {
        x: faces[0].topLeft[0],
        y: faces[0].topLeft[1],
        width: faces[0].bottomRight[0] - faces[0].topLeft[0],
        height: faces[0].bottomRight[1] - faces[0].topLeft[1],
      } : undefined,
      thumbnailData: thumbnail,
      suspicious: isSuspicious,
    };
  });
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
