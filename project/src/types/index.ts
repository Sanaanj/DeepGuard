export type MediaType = 'image' | 'video';

export type DetectionResult = 'authentic' | 'manipulated' | 'inconclusive';

export type AnalysisStatus = 'completed' | 'failed' | 'processing';

export interface ForensicIndicator {
  name: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number;
  weight: number;
}

export interface FrameResult {
  frameIndex: number;
  timestamp: number;
  manipulationProbability: number;
  faceDetected: boolean;
  faceRegion?: { x: number; y: number; width: number; height: number };
  thumbnailData?: string;
  suspicious: boolean;
}

export interface MetadataInfo {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  codec?: string;
  frameRate?: number;
  bitRate?: number;
  colorSpace?: string;
  compression?: string;
  hasAudio?: boolean;
  createdDate?: string;
  modifiedDate?: string;
  anomalies: string[];
}

export interface AudioAnalysisResult {
  available: boolean;
  implemented: boolean;
  spectralScore: number;
  pitchScore: number;
  noiseScore: number;
  syncScore: number;
  syntheticProbability: number;
  findings: string[];
}

export interface GradCAMResult {
  heatmapDataUrl: string;
  overlayDataUrl: string;
  topRegions: { x: number; y: number; intensity: number; label: string }[];
}

export interface VisualAnalysisResult {
  score: number;
  faceDetected: boolean;
  faceCount: number;
  faceRegions: { x: number; y: number; width: number; height: number }[];
  textureScore: number;
  lightingScore: number;
  blendingScore: number;
  noiseScore: number;
  facialFeatureScore: number;
  compressionScore: number;
  findings: string[];
}

export interface TemporalAnalysisResult {
  available: boolean;
  frameCount: number;
  consistencyScore: number;
  flickerScore: number;
  motionScore: number;
  frameScores: number[];
  suspiciousFrames: number[];
  findings: string[];
}

export interface EvidenceFusion {
  visualWeight: number;
  temporalWeight: number;
  audioWeight: number;
  forensicWeight: number;
  modelWeight: number;
  combinedScore: number;
  confidence: number;
  riskScore: number;
  evidenceBreakdown: { source: string; score: number; weight: number; contribution: number }[];
}

export interface AnalysisResult {
  analysisId: string;
  fileName: string;
  mediaType: MediaType;
  result: DetectionResult;
  confidence: number;
  riskScore: number;
  modelPrediction: number;
  visualAnalysis: VisualAnalysisResult;
  temporalAnalysis: TemporalAnalysisResult;
  audioAnalysis: AudioAnalysisResult;
  forensicIndicators: ForensicIndicator[];
  metadataInfo: MetadataInfo;
  frameResults: FrameResult[];
  gradcam?: GradCAMResult;
  evidenceFusion: EvidenceFusion;
  modelName: string;
  processingTimeMs: number;
  timestamp: string;
  originalDataUrl?: string;
  heatmapDataUrl?: string;
  overlayDataUrl?: string;
  videoMetadata?: {
    duration: number;
    fps: number;
    width: number;
    height: number;
    totalFrames: number;
    analyzedFrames: number;
  };
}

export interface AnalysisRecord {
  id: string;
  analysis_id: string;
  file_name: string;
  media_type: MediaType;
  file_size: number;
  mime_type: string | null;
  result: DetectionResult;
  confidence: number;
  risk_score: number;
  model_prediction: number | null;
  visual_score: number | null;
  temporal_score: number | null;
  audio_score: number | null;
  metadata_info: Record<string, unknown>;
  forensic_indicators: ForensicIndicator[];
  frame_results: FrameResult[];
  heatmap_data: string | null;
  model_name: string;
  processing_time_ms: number;
  status: AnalysisStatus;
  created_at: string;
  video_metadata: Record<string, unknown> | null;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  organization: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  confusionMatrix: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number };
  trainingLoss: { epoch: number; loss: number; valLoss: number }[];
}

export interface ModelComparison {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  parameters: string;
  inferenceTime: number;
}
