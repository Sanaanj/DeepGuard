import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Cpu,
  Target,
  Award,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { modelComparisons, benchmarkResults } from '@/lib/ai/training';

interface AnalyticsData {
  totalAnalyses: number;
  imagesAnalyzed: number;
  videosAnalyzed: number;
  authenticCount: number;
  manipulatedCount: number;
  avgConfidence: number;
  avgRiskScore: number;
  avgProcessingTime: number;
  activityData: Array<{ date: string; count: number }>;
  mediaTypeData: Array<{ name: string; value: number; color: string }>;
  resultData: Array<{ name: string; value: number; color: string }>;
  confidenceDistribution: Array<{ range: string; count: number }>;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!user) return;
      const { data: analyses } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!analyses || analyses.length === 0) {
        setLoading(false);
        return;
      }

      const images = analyses.filter((a) => a.media_type === 'image');
      const videos = analyses.filter((a) => a.media_type === 'video');
      const authentic = analyses.filter((a) => a.result === 'authentic');
      const manipulated = analyses.filter((a) => a.result === 'manipulated');
      const avgConf = analyses.reduce((s, a) => s + Number(a.confidence), 0) / analyses.length;
      const avgRisk = analyses.reduce((s, a) => s + Number(a.risk_score), 0) / analyses.length;
      const avgTime = analyses.reduce((s, a) => s + a.processing_time_ms, 0) / analyses.length;

      // Activity over last 30 days
      const activityData: Array<{ date: string; count: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = analyses.filter((a) => a.created_at.startsWith(dateStr)).length;
        activityData.push({ date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
      }

      // Confidence distribution
      const ranges = [
        { range: '0-20%', min: 0, max: 0.2, count: 0 },
        { range: '20-40%', min: 0.2, max: 0.4, count: 0 },
        { range: '40-60%', min: 0.4, max: 0.6, count: 0 },
        { range: '60-80%', min: 0.6, max: 0.8, count: 0 },
        { range: '80-100%', min: 0.8, max: 1.0, count: 0 },
      ];
      analyses.forEach((a) => {
        const conf = Number(a.confidence);
        const bucket = ranges.find((r) => conf >= r.min && conf < r.max);
        if (bucket) bucket.count++;
      });

      setData({
        totalAnalyses: analyses.length,
        imagesAnalyzed: images.length,
        videosAnalyzed: videos.length,
        authenticCount: authentic.length,
        manipulatedCount: manipulated.length,
        avgConfidence: avgConf,
        avgRiskScore: avgRisk,
        avgProcessingTime: avgTime,
        activityData,
        mediaTypeData: [
          { name: 'Images', value: images.length, color: '#00ff88' },
          { name: 'Videos', value: videos.length, color: '#ffaa00' },
        ],
        resultData: [
          { name: 'Authentic', value: authentic.length, color: '#00ff88' },
          { name: 'Manipulated', value: manipulated.length, color: '#ff3366' },
        ],
        confidenceDistribution: ranges.map((r) => ({ range: r.range, count: r.count })),
      });
      setLoading(false);
    }
    loadAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: '#1a2332',
    border: '1px solid #2a3a4f',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Analytics</h1>
        <p className="text-cyber-text-muted mt-1">Comprehensive analytics and model performance metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Analyses', value: data?.totalAnalyses ?? 0, icon: Activity, color: 'text-cyber-accent' },
          { label: 'Avg Confidence', value: `${((data?.avgConfidence ?? 0) * 100).toFixed(1)}%`, icon: Target, color: 'text-cyber-success' },
          { label: 'Avg Risk Score', value: `${(data?.avgRiskScore ?? 0).toFixed(0)}/100`, icon: TrendingUp, color: 'text-cyber-warning' },
          { label: 'Avg Processing Time', value: `${((data?.avgProcessingTime ?? 0) / 1000).toFixed(2)}s`, icon: Cpu, color: 'text-cyber-purple' },
        ].map((card) => (
          <div key={card.label} className="glass-card-hover p-5">
            <card.icon className={`w-6 h-6 ${card.color} mb-3`} />
            <p className="text-2xl font-bold text-cyber-text">{card.value}</p>
            <p className="text-sm text-cyber-text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyber-accent" />
          Analysis Activity (30 Days)
        </h3>
        {data && data.totalAnalyses > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.activityData}>
              <defs>
                <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} interval={4} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#00f0ff" strokeWidth={2} fill="url(#activityGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-cyber-text-muted text-sm">No data available</div>
        )}
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-cyber-success" /> Media Type Distribution
          </h3>
          {data && data.totalAnalyses > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.mediaTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {data.mediaTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-cyber-text-muted text-sm">No data</div>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyber-success" /> Result Distribution
          </h3>
          {data && data.totalAnalyses > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.resultData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {data.resultData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-cyber-text-muted text-sm">No data</div>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-cyber-accent" /> Confidence Distribution
          </h3>
          {data && data.totalAnalyses > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.confidenceDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
                <XAxis dataKey="range" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#00f0ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-cyber-text-muted text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Model comparison */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-cyber-accent" />
          Model Comparison (Experimental Results)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyber-border">
                <th className="text-left py-3 px-4 text-cyber-text-muted font-medium">Model</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">Accuracy</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">Precision</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">Recall</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">F1-Score</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">ROC-AUC</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">Params</th>
                <th className="text-right py-3 px-4 text-cyber-text-muted font-medium">Inference</th>
              </tr>
            </thead>
            <tbody>
              {modelComparisons.map((model, i) => (
                <tr key={i} className="border-b border-cyber-border/50 hover:bg-cyber-card/30 transition-colors">
                  <td className="py-3 px-4 text-cyber-text font-medium">{model.modelName}</td>
                  <td className="py-3 px-4 text-right text-cyber-text-dim font-mono">{(model.accuracy * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-cyber-text-dim font-mono">{(model.precision * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-cyber-text-dim font-mono">{(model.recall * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-cyber-text-dim font-mono">{(model.f1Score * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-cyber-text-dim font-mono">{(model.rocAuc * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-cyber-text-muted font-mono">{model.parameters}</td>
                  <td className="py-3 px-4 text-right text-cyber-text-muted font-mono">{model.inferenceTime}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Benchmark results */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyber-accent" />
          Published Benchmark Results
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={benchmarkResults.map((b) => ({ name: b.method, accuracy: b.accuracy * 100, dataset: b.dataset }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={9} angle={-15} textAnchor="end" height={70} />
            <YAxis stroke="#64748b" fontSize={12} domain={[80, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="accuracy" name="Accuracy %" fill="#00f0ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-cyber-text-muted mt-3">
          Benchmark results sourced from published academic papers on deepfake detection. Results are on respective
          test sets and may not be directly comparable across datasets.
        </p>
      </div>

      {/* Model info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyber-accent" />
          Model Architecture Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-cyber-text mb-3">DeepGuard-CNN-v1</h4>
            <div className="space-y-2 text-sm text-cyber-text-muted">
              <div className="flex justify-between"><span>Architecture:</span><span className="text-cyber-text-dim font-mono">Xception-style</span></div>
              <div className="flex justify-between"><span>Input Size:</span><span className="text-cyber-text-dim font-mono">128x128x3</span></div>
              <div className="flex justify-between"><span>Parameters:</span><span className="text-cyber-text-dim font-mono">~1.2M</span></div>
              <div className="flex justify-between"><span>Conv Blocks:</span><span className="text-cyber-text-dim font-mono">4 (separable)</span></div>
              <div className="flex justify-between"><span>Optimizer:</span><span className="text-cyber-text-dim font-mono">Adam (1e-4)</span></div>
              <div className="flex justify-between"><span>Loss:</span><span className="text-cyber-text-dim font-mono">Binary CE</span></div>
              <div className="flex justify-between"><span>Framework:</span><span className="text-cyber-text-dim font-mono">TensorFlow.js</span></div>
              <div className="flex justify-between"><span>XAI:</span><span className="text-cyber-text-dim font-mono">Grad-CAM</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-cyber-text mb-3">Training Configuration</h4>
            <div className="space-y-2 text-sm text-cyber-text-muted">
              <div className="flex justify-between"><span>Train/Val/Test:</span><span className="text-cyber-text-dim font-mono">70/15/15</span></div>
              <div className="flex justify-between"><span>Batch Size:</span><span className="text-cyber-text-dim font-mono">32</span></div>
              <div className="flex justify-between"><span>Epochs:</span><span className="text-cyber-text-dim font-mono">50 (early stop)</span></div>
              <div className="flex justify-between"><span>Augmentation:</span><span className="text-cyber-text-dim font-mono">Flip, Rotation</span></div>
              <div className="flex justify-between"><span>Face Detection:</span><span className="text-cyber-text-dim font-mono">BlazeFace</span></div>
              <div className="flex justify-between"><span>Recommended Datasets:</span><span className="text-cyber-text-dim font-mono">FF++, Celeb-DF</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
