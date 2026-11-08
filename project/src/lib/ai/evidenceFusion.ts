import type {
  VisualAnalysisResult,
  TemporalAnalysisResult,
  AudioAnalysisResult,
  ForensicIndicator,
  EvidenceFusion,
} from '@/types';

/**
 * Evidence Fusion Module
 *
 * Combines evidence from *available* analysis sources only. Modalities
 * that are not applicable (e.g. temporal/audio for a static image) are
 * fully excluded — their weight is redistributed across the remaining
 * sources.
 *
 * Key design decisions:
 * - The CNN model prediction is the PRIMARY evidence (highest weight).
 * - Visual artifact scores are SUPPORTING evidence — they are NOT independent
 *   from the CNN (the CNN learns from similar features), so they get lower weight
 *   to avoid double-counting.
 * - Forensic indicators are derived from the visual artifact scores, so they
 *   are also not fully independent. They get a modest weight.
 * - Temporal and audio are independent modalities (only for video).
 *
 * Fusion formula:
 *   combinedScore = Σ(available sourceScore × sourceWeight) / Σ(available sourceWeight)
 *
 * Confidence = how much we trust the combined score, based on:
 *   - Agreement between available sources
 *   - Distance of combined score from 0.5 (uncertainty boundary)
 *   - Whether the model is trained
 */

const MODEL_TRAINED_OVERRIDE_KEY = 'deepguard_model_trained';

export function isModelTrainedFromStorage(): boolean {
  try {
    return sessionStorage.getItem(MODEL_TRAINED_OVERRIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setModelTrainedInStorage(value: boolean): void {
  try {
    sessionStorage.setItem(MODEL_TRAINED_OVERRIDE_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function fuseEvidence(
  visual: VisualAnalysisResult,
  temporal: TemporalAnalysisResult,
  audio: AudioAnalysisResult,
  forensicIndicators: ForensicIndicator[],
  modelPrediction: number
): EvidenceFusion {
  // Base weights — CNN model is primary, visual/forensic are supporting
  // Visual and forensic are NOT independent from CNN (they analyze similar features)
  // With a real pretrained model the heuristics are only weak supporting signals.
  const trained = isModelTrainedFromStorage();
  const weights: { visual: number; temporal: number; audio: number; forensic: number; model: number } = trained
    ? {
        model: 0.80,
        visual: 0.05,
        temporal: temporal.available ? 0.07 : 0,
        audio: audio.available ? 0.03 : 0,
        forensic: 0.05,
      }
    : {
        model: 0.50,
        visual: 0.15,
        temporal: temporal.available ? 0.20 : 0,
        audio: audio.available ? 0.10 : 0,
        forensic: 0.20,
      };

  // Redistribute weight from unavailable modalities proportionally
  const activeKeys = Object.keys(weights).filter(
    (k) => weights[k as keyof typeof weights] > 0
  ) as (keyof typeof weights)[];
  const totalActive = activeKeys.reduce((s, k) => s + weights[k], 0);

  for (const k of activeKeys) {
    weights[k] /= totalActive;
  }

  const visualScore = sanitize(visual.score);
  const temporalScore = temporal.available ? sanitize(temporal.consistencyScore) : 0;
  const audioScore = audio.available ? sanitize(audio.syntheticProbability) : 0;
  const forensicScore = sanitize(computeForensicScore(forensicIndicators));
  const modelScore = sanitize(modelPrediction);

  const combinedScore =
    visualScore * weights.visual +
    temporalScore * weights.temporal +
    audioScore * weights.audio +
    forensicScore * weights.forensic +
    modelScore * weights.model;

  // Confidence: agreement among available sources + distance from 0.5
  const availableScores = [modelScore, forensicScore, visualScore];
  if (temporal.available) availableScores.push(temporalScore);
  if (audio.available) availableScores.push(audioScore);

  const agreement = computeAgreement(availableScores);
  const distance = Math.abs(combinedScore - 0.5) * 2;

  // If model is untrained, cap confidence — we can't be confident in random weights
  const modelTrained = isModelTrainedFromStorage();
  const maxConfidence = modelTrained ? 0.95 : 0.35;

  const modelDistance = Math.abs(modelScore - 0.5) * 2;
  const confidence = modelTrained
    ? Math.min(maxConfidence, 0.25 + 0.7 * modelDistance)
    : Math.min(maxConfidence, Math.max(0.01, agreement * 0.4 + distance * 0.4 + 0.2));

  const riskScore = Math.round(sanitize(combinedScore) * 100);

  const evidenceBreakdown: { source: string; score: number; weight: number; contribution: number }[] = [
    { source: 'CNN Model', score: modelScore, weight: weights.model, contribution: modelScore * weights.model },
    { source: 'Visual Artifacts', score: visualScore, weight: weights.visual, contribution: visualScore * weights.visual },
  { source: 'Forensic Indicators', score: forensicScore, weight: weights.forensic, contribution: forensicScore * weights.forensic },
  { source: 'Temporal Analysis', score: temporalScore, weight: weights.temporal, contribution: temporalScore * weights.temporal },
    { source: 'Audio Analysis', score: audioScore, weight: weights.audio, contribution: audioScore * weights.audio },
  ].filter((e) => e.weight > 0);

  console.log('[DeepGuard] Evidence Fusion:', {
    modelScore, visualScore, forensicScore, temporalScore, audioScore,
    weights, combinedScore, confidence, riskScore, modelTrained,
  });

  return {
    visualWeight: weights.visual,
    temporalWeight: weights.temporal,
    audioWeight: weights.audio,
    forensicWeight: weights.forensic,
    modelWeight: weights.model,
    combinedScore: Math.round(combinedScore * 10000) / 10000,
    confidence: Math.round(confidence * 10000) / 10000,
    riskScore,
    evidenceBreakdown,
  };
}

/**
 * Compute forensic score from indicators.
 * Uses weighted average: Σ(value × weight) / Σ(weight).
 */
function computeForensicScore(indicators: ForensicIndicator[]): number {
  if (indicators.length === 0) return 0.15; // No forensic anomalies = low suspicion
  const weightedSum = indicators.reduce((sum, ind) => sum + ind.value * ind.weight, 0);
  const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : 0.15;
}

function computeAgreement(scores: number[]): number {
  if (scores.length < 2) return 0.5;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);
  return Math.max(0, 1 - std * 2);
}

function sanitize(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
