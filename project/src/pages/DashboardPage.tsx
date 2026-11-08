import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ScanLine,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  Activity,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardStats {
  totalAnalyses: number;
  imagesAnalyzed: number;
  videosAnalyzed: number;
  authenticCount: number;
  manipulatedCount: number;
  avgConfidence: number;
  recentAnalyses: Array<{
    analysis_id: string;
    file_name: string;
    media_type: string;
    result: string;
    confidence: number;
    risk_score: number;
    created_at: string;
  }>;
  activityData: Array<{ date: string; count: number }>;
  distributionData: Array<{ name: string; value: number; color: string }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;

      const { data: analyses } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!analyses) {
        setLoading(false);
        return;
      }

      const images = analyses.filter((a) => a.media_type === 'image');
      const videos = analyses.filter((a) => a.media_type === 'video');
      const authentic = analyses.filter((a) => a.result === 'authentic');
      const manipulated = analyses.filter((a) => a.result === 'manipulated');
      const avgConf = analyses.length > 0
        ? analyses.reduce((sum, a) => sum + Number(a.confidence), 0) / analyses.length
        : 0;

      // Activity over last 7 days
      const activityData: Array<{ date: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = analyses.filter((a) => a.created_at.startsWith(dateStr)).length;
        activityData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count,
        });
      }

      setStats({
        totalAnalyses: analyses.length,
        imagesAnalyzed: images.length,
        videosAnalyzed: videos.length,
        authenticCount: authentic.length,
        manipulatedCount: manipulated.length,
        avgConfidence: avgConf,
        recentAnalyses: analyses.slice(0, 5).map((a) => ({
          analysis_id: a.analysis_id,
          file_name: a.file_name,
          media_type: a.media_type,
          result: a.result,
          confidence: Number(a.confidence),
          risk_score: Number(a.risk_score),
          created_at: a.created_at,
        })),
        activityData,
        distributionData: [
          { name: 'Authentic', value: authentic.length, color: '#00ff88' },
          { name: 'Manipulated', value: manipulated.length, color: '#ff3366' },
        ],
      });
      setLoading(false);
    }

    loadStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Analyses', value: stats?.totalAnalyses ?? 0, icon: Activity, color: 'text-cyber-accent', bg: 'bg-cyber-accent/10' },
    { label: 'Images Analyzed', value: stats?.imagesAnalyzed ?? 0, icon: ImageIcon, color: 'text-cyber-success', bg: 'bg-cyber-success/10' },
    { label: 'Videos Analyzed', value: stats?.videosAnalyzed ?? 0, icon: Video, color: 'text-cyber-warning', bg: 'bg-cyber-warning/10' },
    { label: 'Avg Confidence', value: `${((stats?.avgConfidence ?? 0) * 100).toFixed(1)}%`, icon: TrendingUp, color: 'text-cyber-purple', bg: 'bg-cyber-purple/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cyber-text">Forensic Dashboard</h1>
          <p className="text-cyber-text-muted mt-1">Overview of your deepfake detection activity</p>
        </div>
        <Link to="/analyze" className="cyber-btn flex items-center gap-2">
          <ScanLine className="w-4 h-4" />
          New Analysis
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-cyber-text">{card.value}</p>
            <p className="text-sm text-cyber-text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-accent" />
            Analysis Activity (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats?.activityData}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4f" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2332',
                  border: '1px solid #2a3a4f',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#00f0ff"
                strokeWidth={2}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution pie */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyber-accent" />
            Detection Distribution
          </h3>
          {stats && stats.totalAnalyses > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stats.distributionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2332',
                    border: '1px solid #2a3a4f',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-text-muted text-sm">
              No analyses yet
            </div>
          )}
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyber-success" />
              <span className="text-sm text-cyber-text-dim">Authentic ({stats?.authenticCount ?? 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyber-danger" />
              <span className="text-sm text-cyber-text-dim">Manipulated ({stats?.manipulatedCount ?? 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent analyses */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-cyber-text-dim flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyber-accent" />
            Recent Analyses
          </h3>
          <Link to="/history" className="text-sm text-cyber-accent hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {stats && stats.recentAnalyses.length > 0 ? (
          <div className="space-y-2">
            {stats.recentAnalyses.map((analysis) => (
              <Link
                key={analysis.analysis_id}
                to={`/results/${analysis.analysis_id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-cyber-card/50 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  analysis.media_type === 'image' ? 'bg-cyber-success/10' : 'bg-cyber-warning/10'
                }`}>
                  {analysis.media_type === 'image' ? (
                    <ImageIcon className="w-5 h-5 text-cyber-success" />
                  ) : (
                    <Video className="w-5 h-5 text-cyber-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-text truncate group-hover:text-cyber-accent transition-colors">
                    {analysis.file_name}
                  </p>
                  <p className="text-xs text-cyber-text-muted font-mono">
                    {analysis.analysis_id} • {new Date(analysis.created_at).toLocaleDateString()}
                  </p>
                </div>
                {analysis.result === 'authentic' ? (
                  <span className="cyber-badge-success">
                    <ShieldCheck className="w-3 h-3" /> Authentic
                  </span>
                ) : (
                  <span className="cyber-badge-danger">
                    <AlertTriangle className="w-3 h-3" /> Manipulated
                  </span>
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-mono text-cyber-text-dim">
                    {(analysis.confidence * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-cyber-text-muted">confidence</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-cyber-text-muted mx-auto mb-3" />
            <p className="text-cyber-text-muted">No analyses yet</p>
            <Link to="/analyze" className="text-cyber-accent text-sm hover:underline mt-2 inline-block">
              Start your first analysis
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
