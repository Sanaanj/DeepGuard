import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  Download,
  ArrowLeft,
  Clock,
  Cpu,
  Eye,
  Layers,
  AudioLines,
  Database,
  FileText,
  TrendingUp,
  Image as ImageIcon,
  Video,
  Flame,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { generatePdfReport } from '@/lib/pdfReport';
import { supabase } from '@/lib/supabase';
import type { AnalysisResult, AnalysisRecord } from '@/types';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [view, setView] = useState<'original' | 'heatmap' | 'overlay'>('original');

  useEffect(() => {
    async function loadResult() {
      if (!id) return;

      // Try sessionStorage first (fresh analysis)
      const cached = sessionStorage.getItem(`analysis-${id}`);
      if (cached) {
        try {
          const cachedResult = JSON.parse(cached) as AnalysisResult;
          // Fetch heatmap from database to supplement the lightweight cached result
          const { data: dbRecord } = await supabase
            .from('analyses')
            .select('heatmap_data')
            .eq('analysis_id', id)
            .maybeSingle();

          if (dbRecord?.heatmap_data) {
            cachedResult.heatmapDataUrl = dbRecord.heatmap_data;
            cachedResult.overlayDataUrl = dbRecord.heatmap_data;
            if (cachedResult.gradcam) {
              cachedResult.gradcam.heatmapDataUrl = dbRecord.heatmap_data;
              cachedResult.gradcam.overlayDataUrl = dbRecord.heatmap_data;
            }
          }

          setResult(cachedResult);
          setLoading(false);
          return;
        } catch {
          // Fall through to database
        }
      }

      // Load from database
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('analysis_id', id)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const record = data as AnalysisRecord;
      const meta = record.metadata_info as Record<string, unknown>;
      const storedVisual = meta?.visualAnalysis as AnalysisResult['visualAnalysis'] | undefined;
      const storedTemporal = meta?.temporalAnalysis as AnalysisResult['temporalAnalysis'] | undefined;
      const storedAudio = meta?.audioAnalysis as AnalysisResult['audioAnalysis'] | undefined;
      const storedFusion = meta?.evidenceFusion as AnalysisResult['evidenceFusion'] | undefined;
      const storedGradcamRegions = meta?.gradcamTopRegions as { x: number; y: number; intensity: number; label: string }[] | undefined;
      const storedModelPrediction = meta?.modelPrediction as number | undefined;

      // Reconstruct AnalysisResult from database record
      const reconstructed: AnalysisResult = {
        analysisId: record.analysis_id,
        fileName: record.file_name,
        mediaType: record.media_type,
        result: record.result,
        confidence: Number(record.confidence),
        riskScore: Number(record.risk_score),
        modelPrediction: storedModelPrediction ?? Number(record.visual_score ?? 0.5),
        visualAnalysis: storedVisual ?? {
          score: Number(record.visual_score ?? 0.5),
          faceDetected: true,
          faceCount: 0,
          faceRegions: [],
          textureScore: 0,
          lightingScore: 0,
          blendingScore: 0,
          noiseScore: 0,
          facialFeatureScore: 0,
          compressionScore: 0,
          findings: [],
        },
        temporalAnalysis: storedTemporal ?? {
          available: record.media_type === 'video',
          frameCount: record.frame_results?.length ?? 0,
          consistencyScore: Number(record.temporal_score ?? 0),
          flickerScore: 0,
          motionScore: 0,
          frameScores: record.frame_results?.map((f) => f.manipulationProbability) ?? [],
          suspiciousFrames: record.frame_results?.filter((f) => f.suspicious).map((f) => f.frameIndex) ?? [],
          findings: [],
        },
        audioAnalysis: storedAudio ?? {
          available: false,
          implemented: true,
          spectralScore: 0,
          pitchScore: 0,
          noiseScore: 0,
          syncScore: 0,
          syntheticProbability: Number(record.audio_score ?? 0),
          findings: [],
        },
        forensicIndicators: record.forensic_indicators ?? [],
        metadataInfo: {
          fileName: record.file_name,
          fileSize: record.file_size,
          fileType: record.media_type,
          mimeType: record.mime_type ?? '',
          anomalies: (meta?.anomalies as string[]) ?? [],
        } as AnalysisResult['metadataInfo'],
        frameResults: record.frame_results ?? [],
        gradcam: storedGradcamRegions && storedGradcamRegions.length > 0 ? {
          heatmapDataUrl: record.heatmap_data ?? '',
          overlayDataUrl: record.heatmap_data ?? '',
          topRegions: storedGradcamRegions,
        } : undefined,
        heatmapDataUrl: record.heatmap_data ?? undefined,
        overlayDataUrl: record.heatmap_data ?? undefined,
        evidenceFusion: storedFusion ?? {
          visualWeight: 0.35,
          temporalWeight: 0.25,
          audioWeight: 0.15,
          forensicWeight: 0.15,
          modelWeight: 0.25,
          combinedScore: Number(record.confidence),
          confidence: Number(record.confidence),
          riskScore: Number(record.risk_score),
          evidenceBreakdown: [],
        },
        modelName: record.model_name,
        processingTimeMs: record.processing_time_ms,
        timestamp: record.created_at,
      };

      setResult(reconstructed);
      setLoading(false);
    }

    loadResult();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-cyber-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold text-cyber-text mb-2">Analysis Not Found</h2>
        <p className="text-cyber-text-muted mb-6">The analysis you're looking for doesn't exist or has been deleted.</p>
        <Link to="/history" className="cyber-btn inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to History
        </Link>
      </div>
    );
  }

  const isManipulated = result.result === 'manipulated';
  const isInconclusive = result.result === 'inconclusive';
  const confidencePercent = (result.confidence * 100).toFixed(1);
  const riskScore = result.riskScore;
  const modelPredictionPercent = (result.modelPrediction * 100).toFixed(1);

  // Forensic score = weighted average (normalized by total weight)
  const forensicTotalWeight = result.forensicIndicators.reduce((s, i) => s + i.weight, 0);
  const forensicScore = forensicTotalWeight > 0
    ? result.forensicIndicators.reduce((s, i) => s + i.value * i.weight, 0) / forensicTotalWeight
    : 0.2;

  const scoreData = [
    { name: 'CNN Model', score: Math.round(result.modelPrediction * 100), fill: '#00f0ff' },
    { name: 'Visual', score: Math.round(result.visualAnalysis.score * 100), fill: '#3b82f6' },
    ...(result.temporalAnalysis.available ? [{ name: 'Temporal', score: Math.round(result.temporalAnalysis.consistencyScore * 100), fill: '#ffaa00' }] : []),
    ...(result.audioAnalysis.available ? [{ name: 'Audio', score: Math.round(result.audioAnalysis.syntheticProbability * 100), fill: '#a855f7' }] : []),
    { name: 'Forensic', score: Math.round(forensicScore * 100), fill: '#ff3366' },
  ];

  const evidenceData = result.evidenceFusion.evidenceBreakdown.map((e) => ({
    name: e.source,
    contribution: Math.round(e.contribution * 100),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-lg glass-card-hover flex items-center justify-center hover:text-cyber-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-cyber-text">Analysis Results</h1>
            <p className="text-cyber-text-muted text-sm font-mono mt-0.5">{result.analysisId}</p>
          </div>
        </div>
        <button
          onClick={() => generatePdfReport(result)}
          className="cyber-btn flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Forensic Report
        </button>
      </div>

      {/* Main result banner */}
      <div className={`glass-card p-6 border-l-4 ${
        isManipulated ? 'border-l-cyber-danger' : isInconclusive ? 'border-l-cyber-warning' : 'border-l-cyber-success'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isManipulated ? 'bg-cyber-danger/10' : isInconclusive ? 'bg-cyber-warning/10' : 'bg-cyber-success/10'
          }`}>
            {isManipulated ? (
              <AlertTriangle className="w-9 h-9 text-cyber-danger" />
            ) : isInconclusive ? (
              <AlertTriangle className="w-9 h-9 text-cyber-warning" />
            ) : (
              <ShieldCheck className="w-9 h-9 text-cyber-success" />
            )}
          </div>
          <div className="flex-1">
            <h2 className={`text-2xl font-bold ${isManipulated ? 'text-cyber-danger' : isInconclusive ? 'text-cyber-warning' : 'text-cyber-success'}`}>
              {isManipulated ? 'Fake Media (AI-generated or manipulated)' : isInconclusive ? 'Inconclusive Assessment' : 'Real Media'}
            </h2>
            <p className="text-cyber-text-muted mt-1">
              {isManipulated
                ? 'The pretrained detectors found strong signs that this media is AI-generated or manipulated.'
                : isInconclusive
                ? 'The evidence is ambiguous or confidence is too low for a definitive assessment. Additional verification methods are recommended.'
                : 'The pretrained detectors found no significant signs of AI generation or manipulation. This media appears real.'}
            </p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyber-text-muted">Manipulation Probability:</span>
                <span className="text-cyber-text font-mono font-medium">{modelPredictionPercent}%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyber-text-muted">Confidence:</span>
                <span className="text-cyber-text font-mono font-medium">{confidencePercent}%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyber-text-muted">Risk Score:</span>
                <span className={`font-mono font-medium ${riskScore > 60 ? 'text-cyber-danger' : riskScore > 40 ? 'text-cyber-warning' : 'text-cyber-success'}`}>
                  {riskScore}/100
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyber-text-muted">Model:</span>
                <span className="text-cyber-text font-mono">{result.modelName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-cyber-text-muted" />
                <span className="text-cyber-text-muted">{(result.processingTimeMs / 1000).toFixed(2)}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original / Heatmap / Overlay */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cyber-text-dim flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyber-accent" />
              Visual Analysis
            </h3>
            <div className="flex gap-1">
              {(['original', 'heatmap', 'overlay'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    view === v
                      ? 'bg-cyber-accent/20 text-cyber-accent'
                      : 'text-cyber-text-muted hover:text-cyber-text'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-cyber-bg border border-cyber-border min-h-[300px] flex items-center justify-center">
            {view === 'original' && result.originalDataUrl && (
              <img src={result.originalDataUrl} alt="Original" className="w-full h-auto max-h-80 object-contain" />
            )}
            {view === 'original' && !result.originalDataUrl && (
              <div className="text-center p-8">
                <ImageIcon className="w-12 h-12 text-cyber-text-muted mx-auto mb-3" />
                <p className="text-cyber-text-muted text-sm">Original image not available</p>
                <p className="text-cyber-text-muted text-xs mt-1">View heatmap or overlay for visual analysis</p>
              </div>
            )}
            {view === 'heatmap' && result.heatmapDataUrl && (
              <img src={result.heatmapDataUrl} alt="Heatmap" className="w-full h-auto max-h-80 object-contain" />
            )}
            {view === 'overlay' && result.overlayDataUrl && (
              <img src={result.overlayDataUrl} alt="Overlay" className="w-full h-auto max-h-80 object-contain" />
            )}
            {view === 'heatmap' && !result.heatmapDataUrl && (
              <p className="text-cyber-text-muted text-sm p-8">Heatmap not available for this analysis</p>
            )}
            {view === 'overlay' && !result.overlayDataUrl && (
              <p className="text-cyber-text-muted text-sm p-8">Overlay not available for this analysis</p>
            )}
          </div>
          {result.gradcam && result.gradcam.topRegions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-cyber-text-muted mb-2">Grad-CAM model activation strength (regions that most influenced the CNN prediction):</p>
              <div className="space-y-1.5">
                {result.gradcam.topRegions.map((region, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Flame className="w-3.5 h-3.5 text-cyber-warning" />
                    <span className="text-cyber-text-dim">{region.label}</span>
                    <span className="text-cyber-text-muted ml-auto font-mono">
                      Activation: {(region.intensity * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-cyber-text-muted mt-2 italic">
                These values indicate where the model focused its attention, not proof of manipulation in those regions.
              </p>
            </div>
          )}
        </div>

        {/* Score gauges */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyber-accent" />
            Analysis Scores
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="30%" outerRadius="100%" data={scoreData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="score" cornerRadius={6} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2332',
                  border: '1px solid #2a3a4f',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {scoreData.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-sm text-cyber-text-dim">{s.name}</span>
                <span className="text-sm text-cyber-text-muted ml-auto font-mono">{s.score}%</span>
              </div>
            ))}
            {!result.temporalAnalysis.available && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-border" />
                <span className="text-sm text-cyber-text-dim">Temporal</span>
                <span className="text-sm text-cyber-text-muted ml-auto font-mono">N/A</span>
              </div>
            )}
            {!result.audioAnalysis.available && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-border" />
                <span className="text-sm text-cyber-text-dim">Audio</span>
                <span className="text-sm text-cyber-text-muted ml-auto font-mono">N/A</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Evidence fusion breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyber-accent" />
          Evidence Fusion Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={evidenceData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
            <XAxis type="number" stroke="#64748b" fontSize={12} domain={[0, 100]} />
            <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={120} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a2332',
                border: '1px solid #2a3a4f',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="contribution" fill="#00f0ff" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visual analysis details */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyber-accent" />
          Visual Artifact Analysis
        </h3>
        <p className="text-xs text-cyber-text-muted mb-4">Artifact suspicion scores — higher values indicate more suspicious evidence detected by each analysis module, not certainty of manipulation.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Texture', value: result.visualAnalysis.textureScore, icon: Layers },
            { label: 'Lighting', value: result.visualAnalysis.lightingScore, icon: Eye },
            { label: 'Blending', value: result.visualAnalysis.blendingScore, icon: Layers },
            { label: 'Noise', value: result.visualAnalysis.noiseScore, icon: Cpu },
            { label: 'Facial Features', value: result.visualAnalysis.facialFeatureScore, icon: Eye },
            { label: 'Compression', value: result.visualAnalysis.compressionScore, icon: FileText },
          ].map((metric) => (
            <div key={metric.label} className="p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-cyber-text-muted">{metric.label}</span>
                <span className={`text-xs font-mono font-medium ${
                  metric.value > 0.6 ? 'text-cyber-danger' : metric.value > 0.4 ? 'text-cyber-warning' : 'text-cyber-success'
                }`}>
                  {(metric.value * 100).toFixed(0)}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${
                    metric.value > 0.6 ? 'bg-cyber-danger' : metric.value > 0.4 ? 'bg-cyber-warning' : 'bg-cyber-success'
                  }`}
                  style={{ width: `${metric.value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {result.visualAnalysis.findings.length > 0 && (
          <div className="space-y-1.5">
            {result.visualAnalysis.findings.map((finding, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-cyber-text-dim">
                <ChevronRight className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporal analysis (video only) */}
      {!result.temporalAnalysis.available && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyber-accent" />
            Temporal Analysis
            <span className="text-xs text-cyber-text-muted ml-2">(N/A for static images)</span>
          </h3>
          <p className="text-sm text-cyber-text-muted">
            Temporal consistency analysis requires video media with multiple frames. It is not applicable to static images.
          </p>
        </div>
      )}
      {result.temporalAnalysis.available && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyber-accent" />
            Temporal Analysis ({result.temporalAnalysis.frameCount} frames)
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Consistency', value: result.temporalAnalysis.consistencyScore },
              { label: 'Flicker', value: result.temporalAnalysis.flickerScore },
              { label: 'Motion', value: result.temporalAnalysis.motionScore },
            ].map((metric) => (
              <div key={metric.label} className="text-center p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                <p className={`text-2xl font-bold font-mono ${
                  metric.value > 0.6 ? 'text-cyber-danger' : metric.value > 0.4 ? 'text-cyber-warning' : 'text-cyber-success'
                }`}>
                  {(metric.value * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-cyber-text-muted mt-1">{metric.label}</p>
              </div>
            ))}
          </div>

          {/* Frame-by-frame graph */}
          {result.temporalAnalysis.frameScores.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.temporalAnalysis.frameScores.map((score, i) => ({
                frame: i,
                probability: score * 100,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
                <XAxis dataKey="frame" stroke="#64748b" fontSize={12} label={{ value: 'Frame', position: 'insideBottom', offset: -5, fill: '#64748b' }} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} label={{ value: 'Manipulation %', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2332',
                    border: '1px solid #2a3a4f',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#ff3366"
                  strokeWidth={2}
                  dot={{ fill: '#ff3366', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Frame thumbnails */}
          {result.frameResults.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-cyber-text-muted mb-2">Frame inspection (click to examine):</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {result.frameResults.map((frame) => (
                  <button
                    key={frame.frameIndex}
                    onClick={() => setSelectedFrame(selectedFrame === frame.frameIndex ? null : frame.frameIndex)}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedFrame === frame.frameIndex
                        ? 'border-cyber-accent scale-105'
                        : frame.suspicious
                        ? 'border-cyber-danger/50'
                        : 'border-cyber-border'
                    }`}
                  >
                    {frame.thumbnailData && (
                      <img src={frame.thumbnailData} alt={`Frame ${frame.frameIndex}`} className="w-24 h-24 object-cover" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <p className="text-[10px] text-white font-mono text-center">
                        F{frame.frameIndex} • {(frame.manipulationProbability * 100).toFixed(0)}%
                      </p>
                    </div>
                    {frame.suspicious && (
                      <div className="absolute top-1 right-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-cyber-danger" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedFrame !== null && (
                <div className="mt-3 p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                  {(() => {
                    const frame = result.frameResults[selectedFrame];
                    return (
                      <div className="flex gap-4">
                        {frame.thumbnailData && (
                          <img src={frame.thumbnailData} alt={`Frame ${frame.frameIndex}`} className="w-32 h-32 object-cover rounded-lg" />
                        )}
                        <div className="flex-1 space-y-1 text-sm">
                          <p className="text-cyber-text"><span className="text-cyber-text-muted">Frame:</span> {frame.frameIndex}</p>
                          <p className="text-cyber-text"><span className="text-cyber-text-muted">Timestamp:</span> {frame.timestamp.toFixed(2)}s</p>
                          <p className="text-cyber-text"><span className="text-cyber-text-muted">Face detected:</span> {frame.faceDetected ? 'Yes' : 'No'}</p>
                          <p className="text-cyber-text"><span className="text-cyber-text-muted">Manipulation probability:</span> <span className={frame.manipulationProbability > 0.5 ? 'text-cyber-danger' : 'text-cyber-success'}>{(frame.manipulationProbability * 100).toFixed(1)}%</span></p>
                          <p className="text-cyber-text"><span className="text-cyber-text-muted">Status:</span> {frame.suspicious ? <span className="text-cyber-danger">Suspicious</span> : <span className="text-cyber-success">Normal</span>}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {result.temporalAnalysis.findings.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {result.temporalAnalysis.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-cyber-text-dim">
                  <ChevronRight className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio analysis */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <AudioLines className="w-4 h-4 text-cyber-accent" />
          Audio Analysis
          {!result.audioAnalysis.available && (
            <span className="text-xs text-cyber-text-muted ml-2">(N/A — no audio track)</span>
          )}
        </h3>
        {result.audioAnalysis.available ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Spectral', value: result.audioAnalysis.spectralScore },
                { label: 'Pitch', value: result.audioAnalysis.pitchScore },
                { label: 'Noise', value: result.audioAnalysis.noiseScore },
                { label: 'Sync', value: result.audioAnalysis.syncScore },
              ].map((metric) => (
                <div key={metric.label} className="p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-cyber-text-muted">{metric.label}</span>
                    <span className={`text-xs font-mono ${metric.value > 0.6 ? 'text-cyber-danger' : 'text-cyber-success'}`}>
                      {(metric.value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-bar-fill ${metric.value > 0.6 ? 'bg-cyber-danger' : 'bg-cyber-success'}`} style={{ width: `${metric.value * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {result.audioAnalysis.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-cyber-text-dim">
                  <ChevronRight className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-cyber-text-muted">
            Audio analysis is not applicable for this media type. It is only performed when the uploaded media contains an audio track (e.g. video files).
          </p>
        )}
      </div>

      {/* Forensic indicators */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyber-accent" />
          Forensic Analysis
        </h3>
        <p className="text-xs text-cyber-text-muted mb-4">
          Forensic score: <span className="font-mono text-cyber-text">{(forensicScore * 100).toFixed(1)}%</span>
          {forensicTotalWeight > 0 && <span className="ml-2">(weighted average of {result.forensicIndicators.length} indicator{result.forensicIndicators.length !== 1 ? 's' : ''}, total weight: {(forensicTotalWeight * 100).toFixed(0)}%)</span>}
        </p>
        {result.forensicIndicators.length > 0 ? (
          <div className="space-y-2">
            {result.forensicIndicators.map((indicator, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  indicator.severity === 'high' ? 'bg-cyber-danger' :
                  indicator.severity === 'medium' ? 'bg-cyber-warning' : 'bg-cyber-success'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-cyber-text">{indicator.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      indicator.severity === 'high' ? 'bg-cyber-danger/10 text-cyber-danger' :
                      indicator.severity === 'medium' ? 'bg-cyber-warning/10 text-cyber-warning' :
                      'bg-cyber-success/10 text-cyber-success'
                    }`}>
                      {indicator.severity}
                    </span>
                  </div>
                  <p className="text-xs text-cyber-text-muted">{indicator.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-cyber-text-dim">{(indicator.value * 100).toFixed(0)}%</p>
                  <p className="text-xs text-cyber-text-muted">weight: {(indicator.weight * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cyber-text-muted">No forensic anomalies detected by the indicator modules.</p>
        )}
      </div>

      {/* Metadata */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyber-accent" />
          Media Metadata
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'File Name', value: result.metadataInfo.fileName },
            { label: 'File Size', value: `${(result.metadataInfo.fileSize / 1024 / 1024).toFixed(2)} MB` },
            { label: 'Type', value: result.metadataInfo.mimeType },
            { label: 'Resolution', value: result.metadataInfo.width ? `${result.metadataInfo.width}x${result.metadataInfo.height}` : 'N/A' },
            ...(result.metadataInfo.duration ? [{ label: 'Duration', value: `${result.metadataInfo.duration.toFixed(1)}s` }] : []),
            ...(result.metadataInfo.codec ? [{ label: 'Codec', value: result.metadataInfo.codec }] : []),
            ...(result.metadataInfo.frameRate ? [{ label: 'Frame Rate', value: `${result.metadataInfo.frameRate} fps` }] : []),
            ...(result.metadataInfo.hasAudio !== undefined ? [{ label: 'Audio Track', value: result.metadataInfo.hasAudio ? 'Yes' : 'No' }] : []),
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <p className="text-xs text-cyber-text-muted mb-1">{item.label}</p>
              <p className="text-sm text-cyber-text font-mono truncate">{item.value}</p>
            </div>
          ))}
        </div>
        {result.metadataInfo.anomalies.length > 0 && (
          <div>
            <p className="text-xs text-cyber-text-muted mb-2">Metadata Observations:</p>
            <div className="space-y-1.5">
              {result.metadataInfo.anomalies.map((anomaly, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-cyber-text-dim">
                  <ChevronRight className="w-3.5 h-3.5 text-cyber-accent flex-shrink-0 mt-0.5" />
                  <span>{anomaly}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="glass-card p-4 border-l-4 border-l-cyber-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-cyber-text-dim">
              <strong className="text-cyber-warning">Disclaimer:</strong> AI predictions are probabilistic and should not be treated as conclusive proof without further investigation. The results provided by DeepGuard are based on machine learning models and forensic heuristics that may produce false positives or false negatives. Always use human judgment and additional verification methods for critical decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
