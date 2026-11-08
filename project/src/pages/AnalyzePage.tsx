import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  ScanLine,
  Image as ImageIcon,
  Video,
  X,
  AlertCircle,
  FileText,
  Loader2,
  CheckCircle2,
  Cpu,
  Eye,
  Layers,
  AudioLines,
  Database,
  Brain,
} from 'lucide-react';
import { analyzeImage, analyzeVideo, type AnalysisProgress } from '@/lib/ai/analysisPipeline';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AnalysisResult, MediaType } from '@/types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

const PIPELINE_STEPS = [
  { icon: FileText, label: 'File Validation' },
  { icon: Eye, label: 'Media Preprocessing' },
  { icon: ScanLine, label: 'Face Detection' },
  { icon: Brain, label: 'CNN Inference' },
  { icon: Layers, label: 'Visual Analysis' },
  { icon: Cpu, label: 'Temporal Analysis' },
  { icon: AudioLines, label: 'Audio Analysis' },
  { icon: Database, label: 'Evidence Fusion' },
];

export default function AnalyzePage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFile = useCallback((f: File) => {
    setError(null);

    if (f.size > MAX_FILE_SIZE) {
      setError('File size exceeds 100MB limit');
      return;
    }

    if (!ACCEPTED_TYPES.includes(f.type) && !f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('Unsupported file type. Please upload JPG, PNG, WEBP, MP4, AVI, or MOV files.');
      return;
    }

    const isImage = f.type.startsWith('image/');
    setMediaType(isImage ? 'image' : 'video');
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setError(null);
    setProgress(null);
    setCompletedSteps(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function handleAnalyze() {
    if (!file || !mediaType || !user) return;

    setAnalyzing(true);
    setError(null);
    setProgress({ step: 'Initializing', progress: 0 });
    setCompletedSteps(0);

    try {
      let result: AnalysisResult;

      if (mediaType === 'image') {
        const img = new Image();
        img.src = previewUrl!;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        result = await analyzeImage(file, img, (p) => {
          setProgress(p);
          setCompletedSteps(Math.floor((p.progress / 100) * PIPELINE_STEPS.length));
        });
      } else {
        const video = document.createElement('video');
        video.src = previewUrl!;
        video.muted = true;
        video.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        result = await analyzeVideo(file, video, (p) => {
          setProgress(p);
          setCompletedSteps(Math.floor((p.progress / 100) * PIPELINE_STEPS.length));
        });
      }

      // Save to database
      const { error: dbError, data: dbData } = await supabase.from('analyses').insert({
        user_id: user.id,
        analysis_id: result.analysisId,
        file_name: result.fileName,
        media_type: result.mediaType,
        file_size: file.size,
        mime_type: file.type,
        result: result.result,
        confidence: result.confidence,
        risk_score: result.riskScore,
        model_prediction: result.modelPrediction,
        visual_score: result.visualAnalysis.score,
        temporal_score: result.temporalAnalysis.available ? result.temporalAnalysis.consistencyScore : null,
        audio_score: result.audioAnalysis.available ? result.audioAnalysis.syntheticProbability : null,
        metadata_info: {
          ...result.metadataInfo,
          visualAnalysis: result.visualAnalysis,
          temporalAnalysis: {
            available: result.temporalAnalysis.available,
            frameCount: result.temporalAnalysis.frameCount,
            consistencyScore: result.temporalAnalysis.consistencyScore,
            flickerScore: result.temporalAnalysis.flickerScore,
            motionScore: result.temporalAnalysis.motionScore,
            findings: result.temporalAnalysis.findings,
          },
          audioAnalysis: {
            available: result.audioAnalysis.available,
            implemented: result.audioAnalysis.implemented,
            spectralScore: result.audioAnalysis.spectralScore,
            pitchScore: result.audioAnalysis.pitchScore,
            noiseScore: result.audioAnalysis.noiseScore,
            syncScore: result.audioAnalysis.syncScore,
            syntheticProbability: result.audioAnalysis.syntheticProbability,
            findings: result.audioAnalysis.findings,
          },
          evidenceFusion: result.evidenceFusion,
          gradcamTopRegions: result.gradcam?.topRegions ?? [],
          modelPrediction: result.modelPrediction,
        },
        forensic_indicators: result.forensicIndicators,
        frame_results: result.frameResults,
        heatmap_data: result.heatmapDataUrl,
        model_name: result.modelName,
        processing_time_ms: result.processingTimeMs,
        video_metadata: result.videoMetadata ?? {},
        status: 'completed',
      }).select('id');

      if (dbError) {
        console.error('[DeepGuard] Database save error:', dbError.message, 'Code:', dbError.code, 'Details:', dbError.details);
        setError(`Analysis completed but failed to save to history: ${dbError.message}`);
        setAnalyzing(false);
        return;
      }
      console.log('[DeepGuard] Database save successful. Record ID:', dbData?.[0]?.id ?? 'unknown');

      // Store lightweight result in sessionStorage (strip only the heaviest base64 image data)
      const lightweightResult = {
        ...result,
        heatmapDataUrl: undefined,
        overlayDataUrl: undefined,
        gradcam: result.gradcam ? { ...result.gradcam, heatmapDataUrl: undefined, overlayDataUrl: undefined } : undefined,
        frameResults: result.frameResults.map((f) => ({ ...f, thumbnailData: undefined })),
      };
      try {
        sessionStorage.setItem(`analysis-${result.analysisId}`, JSON.stringify(lightweightResult));
      } catch (e) {
        // If still too large, strip original image too
        try {
          const ultraLight = {
            ...lightweightResult,
            originalDataUrl: undefined,
          };
          sessionStorage.setItem(`analysis-${result.analysisId}`, JSON.stringify(ultraLight));
        } catch {
          console.warn('SessionStorage quota exceeded, falling back to database-only load');
        }
      }

      setCompletedSteps(PIPELINE_STEPS.length);
      setTimeout(() => {
        navigate(`/results/${result.analysisId}`);
      }, 500);
    } catch (err) {
      setError(`Analysis failed: ${(err as Error).message}`);
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Analyze Media</h1>
        <p className="text-cyber-text-muted mt-1">
          Upload an image or video for AI-powered deepfake detection and forensic analysis
        </p>
      </div>

      {/* Upload zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            dragging
              ? 'border-cyber-accent bg-cyber-accent/5 scale-[1.02]'
              : 'border-cyber-border hover:border-cyber-accent/50 hover:bg-cyber-card/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              dragging ? 'bg-cyber-accent/20 scale-110' : 'bg-cyber-accent/10'
            }`}>
              <Upload className={`w-10 h-10 text-cyber-accent transition-transform duration-300 ${
                dragging ? 'scale-110' : ''
              }`} />
            </div>
            <div>
              <p className="text-lg font-medium text-cyber-text">
                {dragging ? 'Drop your file here' : 'Drag and drop your media here'}
              </p>
              <p className="text-sm text-cyber-text-muted mt-1">
                or <span className="text-cyber-accent">browse files</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {['JPG', 'PNG', 'WEBP', 'MP4', 'AVI', 'MOV'].map((fmt) => (
                <span key={fmt} className="px-2.5 py-1 rounded-md bg-cyber-card border border-cyber-border text-xs font-mono text-cyber-text-muted">
                  {fmt}
                </span>
              ))}
            </div>
            <p className="text-xs text-cyber-text-muted mt-2">Maximum file size: 100MB</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-cyber-danger/10 border border-cyber-danger/30 text-cyber-danger text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview */}
      {file && previewUrl && (
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cyber-text-dim flex items-center gap-2">
              {mediaType === 'image' ? <ImageIcon className="w-4 h-4 text-cyber-success" /> : <Video className="w-4 h-4 text-cyber-warning" />}
              {mediaType === 'image' ? 'Image Preview' : 'Video Preview'}
            </h3>
            {!analyzing && (
              <button onClick={removeFile} className="text-cyber-text-muted hover:text-cyber-danger transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Media preview */}
            <div className="flex-1">
              <div className="relative rounded-lg overflow-hidden bg-cyber-bg border border-cyber-border">
                {mediaType === 'image' ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-80 object-contain" />
                ) : (
                  <video src={previewUrl} controls className="w-full h-auto max-h-80 object-contain" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-cyber-text-muted">
                <span className="font-mono">{file.name}</span>
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="uppercase">{file.type}</span>
              </div>
            </div>

            {/* Analysis controls */}
            <div className="lg:w-80 flex flex-col gap-4">
              {!analyzing && !progress && (
                <>
                  <div className="p-4 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                    <h4 className="text-sm font-medium text-cyber-text mb-3">Analysis Pipeline</h4>
                    <div className="space-y-2">
                      {PIPELINE_STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-cyber-text-muted">
                          <step.icon className="w-3.5 h-3.5" />
                          <span>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleAnalyze} className="cyber-btn w-full flex items-center justify-center gap-2">
                    <ScanLine className="w-5 h-5" />
                    Analyze Media
                  </button>
                </>
              )}

              {analyzing && progress && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 text-cyber-accent animate-spin" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-cyber-text">{progress.step}</p>
                        {progress.detail && (
                          <p className="text-xs text-cyber-text-muted mt-0.5">{progress.detail}</p>
                        )}
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill bg-gradient-to-r from-cyber-accent to-cyber-success"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-cyber-text-muted mt-2 text-right font-mono">
                      {progress.progress.toFixed(0)}%
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {PIPELINE_STEPS.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                          i < completedSteps
                            ? 'text-cyber-success'
                            : i === completedSteps
                            ? 'text-cyber-accent'
                            : 'text-cyber-text-muted'
                        }`}
                      >
                        {i < completedSteps ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : i === completedSteps ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <step.icon className="w-4 h-4 opacity-40" />
                        )}
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info section */}
      {!file && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Brain,
              title: 'Deep Learning Model',
              desc: 'Xception-style CNN with depthwise separable convolutions for face manipulation detection',
              color: 'text-cyber-accent',
            },
            {
              icon: Eye,
              title: 'Explainable AI',
              desc: 'Grad-CAM heatmaps show which regions influenced the model\'s prediction',
              color: 'text-cyber-success',
            },
            {
              icon: Database,
              title: 'Evidence Fusion',
              desc: 'Combines visual, temporal, audio, and forensic evidence into a unified risk score',
              color: 'text-cyber-warning',
            },
          ].map((item) => (
            <div key={item.title} className="glass-card-hover p-5">
              <item.icon className={`w-8 h-8 ${item.color} mb-3`} />
              <h4 className="text-sm font-medium text-cyber-text mb-1">{item.title}</h4>
              <p className="text-xs text-cyber-text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
