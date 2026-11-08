import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FileText, Download, ChevronRight, FileWarning, Image as ImageIcon, Video } from 'lucide-react';
import type { AnalysisRecord, AnalysisResult } from '@/types';
import { generatePdfReport } from '@/lib/pdfReport';

export default function ReportsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      if (!user) return;
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRecords(data as unknown as AnalysisRecord[]);
      }
      setLoading(false);
    }
    loadReports();
  }, [user]);

  function handleDownload(record: AnalysisRecord) {
    const cached = sessionStorage.getItem(`analysis-${record.analysis_id}`);
    if (cached) {
      generatePdfReport(JSON.parse(cached));
    } else {
      // Reconstruct minimal result for PDF
      generatePdfReport({
        analysisId: record.analysis_id,
        fileName: record.file_name,
        mediaType: record.media_type,
        result: record.result,
        confidence: Number(record.confidence),
        riskScore: Number(record.risk_score),
        visualAnalysis: {
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
        temporalAnalysis: {
          available: record.media_type === 'video',
          frameCount: record.frame_results?.length ?? 0,
          consistencyScore: Number(record.temporal_score ?? 0),
          flickerScore: 0,
          motionScore: 0,
          frameScores: [],
          suspiciousFrames: [],
          findings: [],
        },
        audioAnalysis: {
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
        metadataInfo: record.metadata_info as unknown as AnalysisResult['metadataInfo'],
        frameResults: record.frame_results ?? [],
        evidenceFusion: {
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
        modelPrediction: Number(record.visual_score ?? 0.5),
        modelName: record.model_name,
        processingTimeMs: record.processing_time_ms,
        timestamp: record.created_at,
        heatmapDataUrl: record.heatmap_data ?? undefined,
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Forensic Reports</h1>
        <p className="text-cyber-text-muted mt-1">Download professional PDF reports for your analyses</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileWarning className="w-12 h-12 text-cyber-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-cyber-text mb-2">No reports available</h3>
          <p className="text-cyber-text-muted mb-6">Analyze media first to generate forensic reports.</p>
          <Link to="/analyze" className="cyber-btn inline-flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Analyze Media
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map((record) => (
            <div key={record.id} className="glass-card-hover p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  record.media_type === 'image' ? 'bg-cyber-success/10' : 'bg-cyber-warning/10'
                }`}>
                  {record.media_type === 'image' ? (
                    <ImageIcon className="w-6 h-6 text-cyber-success" />
                  ) : (
                    <Video className="w-6 h-6 text-cyber-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-text truncate">{record.file_name}</p>
                  <p className="text-xs text-cyber-text-muted font-mono mt-0.5">{record.analysis_id}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-cyber-text-muted">
                    <span>{new Date(record.created_at).toLocaleDateString()}</span>
                    <span>{(Number(record.confidence) * 100).toFixed(1)}% confidence</span>
                    <span className={record.result === 'manipulated' ? 'text-cyber-danger' : 'text-cyber-success'}>
                      {record.result}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleDownload(record)}
                  className="cyber-btn flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <Link
                  to={`/results/${record.analysis_id}`}
                  className="cyber-btn-outline flex items-center justify-center gap-1 text-sm px-4"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report info */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-cyber-accent flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-cyber-text mb-2">About Forensic Reports</h3>
            <p className="text-sm text-cyber-text-muted leading-relaxed">
              Each PDF report includes the analysis ID, file information, AI prediction, confidence and risk scores,
              visual artifact analysis, temporal analysis (for videos), audio analysis (when available), forensic indicators,
              Grad-CAM heatmap, evidence fusion breakdown, metadata, and a disclaimer. Reports are generated on-demand
              and contain all relevant analysis data in a professional format suitable for documentation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
