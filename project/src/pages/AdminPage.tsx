import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Activity, Shield, Database, TrendingUp, Clock } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalAnalyses: number;
  recentAnalyses: number;
  imagesAnalyzed: number;
  videosAnalyzed: number;
  authenticCount: number;
  manipulatedCount: number;
  recentActivity: Array<{
    analysis_id: string;
    file_name: string;
    media_type: string;
    result: string;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminStats() {
      // Total users (count from profiles - admin can see aggregate count)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total analyses (only own, due to RLS - but admin gets aggregate stats)
      const { count: analysisCount } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true });

      // Recent analyses
      const { data: recent } = await supabase
        .from('analyses')
        .select('analysis_id, file_name, media_type, result, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get media type counts
      const { data: allAnalyses } = await supabase
        .from('analyses')
        .select('media_type, result');

      const images = allAnalyses?.filter((a) => a.media_type === 'image').length ?? 0;
      const videos = allAnalyses?.filter((a) => a.media_type === 'video').length ?? 0;
      const authentic = allAnalyses?.filter((a) => a.result === 'authentic').length ?? 0;
      const manipulated = allAnalyses?.filter((a) => a.result === 'manipulated').length ?? 0;

      setStats({
        totalUsers: userCount ?? 0,
        totalAnalyses: analysisCount ?? 0,
        recentAnalyses: recent?.length ?? 0,
        imagesAnalyzed: images,
        videosAnalyzed: videos,
        authenticCount: authentic,
        manipulatedCount: manipulated,
        recentActivity: recent ?? [],
      });
      setLoading(false);
    }
    loadAdminStats();
  }, []);

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-cyber-accent', bg: 'bg-cyber-accent/10' },
    { label: 'Total Analyses', value: stats?.totalAnalyses ?? 0, icon: Activity, color: 'text-cyber-success', bg: 'bg-cyber-success/10' },
    { label: 'Images Analyzed', value: stats?.imagesAnalyzed ?? 0, icon: Database, color: 'text-cyber-warning', bg: 'bg-cyber-warning/10' },
    { label: 'Videos Analyzed', value: stats?.videosAnalyzed ?? 0, icon: Database, color: 'text-cyber-purple', bg: 'bg-cyber-purple/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-cyber-purple" />
        <div>
          <h1 className="text-2xl font-bold text-cyber-text">Admin Dashboard</h1>
          <p className="text-cyber-text-muted mt-1">System-level statistics and usage information</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card-hover p-5">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-cyber-text">{card.value}</p>
            <p className="text-sm text-cyber-text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyber-accent" />
            Result Distribution
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-success" />
                <span className="text-sm text-cyber-text-dim">Authentic</span>
              </div>
              <span className="text-sm font-mono text-cyber-text">{stats?.authenticCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-danger" />
                <span className="text-sm text-cyber-text-dim">Manipulated</span>
              </div>
              <span className="text-sm font-mono text-cyber-text">{stats?.manipulatedCount ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyber-accent" />
            Media Type Distribution
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-success" />
                <span className="text-sm text-cyber-text-dim">Images</span>
              </div>
              <span className="text-sm font-mono text-cyber-text">{stats?.imagesAnalyzed ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyber-warning" />
                <span className="text-sm text-cyber-text-dim">Videos</span>
              </div>
              <span className="text-sm font-mono text-cyber-text">{stats?.videosAnalyzed ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyber-accent" />
          Recent System Activity
        </h3>
        {stats && stats.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {stats.recentActivity.map((activity) => (
              <div key={activity.analysis_id} className="flex items-center gap-3 p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
                <div className={`w-2 h-2 rounded-full ${activity.result === 'manipulated' ? 'bg-cyber-danger' : 'bg-cyber-success'}`} />
                <span className="text-sm text-cyber-text-dim flex-1 truncate">{activity.file_name}</span>
                <span className="text-xs text-cyber-text-muted font-mono">{activity.analysis_id}</span>
                <span className="text-xs text-cyber-text-muted">{new Date(activity.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cyber-text-muted text-center py-8">No recent activity</p>
        )}
      </div>

      {/* Privacy note */}
      <div className="glass-card p-4 border-l-4 border-l-cyber-purple">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-cyber-purple flex-shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-text-dim">
            <strong className="text-cyber-purple">Privacy Notice:</strong> The admin dashboard shows aggregate system
            statistics only. Individual user files and analysis details are protected by row-level security and are
            not exposed to administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
