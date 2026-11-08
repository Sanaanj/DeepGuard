import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  History as HistoryIcon,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  Trash2,
  Clock,
  Download,
} from 'lucide-react';
import type { AnalysisRecord } from '@/types';
import { generatePdfReport } from '@/lib/pdfReport';

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'authentic' | 'manipulated'>('all');

  useEffect(() => {
    async function loadHistory() {
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
    loadHistory();
  }, [user]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('analyses').delete().eq('id', id);
    if (!error) {
      setRecords(records.filter((r) => r.id !== id));
    }
  }

  const filtered = records.filter((r) => {
    const matchesSearch = r.file_name.toLowerCase().includes(search.toLowerCase()) ||
      r.analysis_id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'image' && r.media_type === 'image') ||
      (filter === 'video' && r.media_type === 'video') ||
      (filter === 'authentic' && r.result === 'authentic') ||
      (filter === 'manipulated' && r.result === 'manipulated');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Detection History</h1>
        <p className="text-cyber-text-muted mt-1">Browse and manage your past media analyses</p>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
          <input
            type="text"
            placeholder="Search by file name or analysis ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="cyber-input w-full pl-11"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-cyber-text-muted" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="cyber-input"
          >
            <option value="all">All</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="authentic">Authentic</option>
            <option value="manipulated">Manipulated</option>
          </select>
        </div>
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-12 h-12 border-4 border-cyber-border border-t-cyber-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <HistoryIcon className="w-12 h-12 text-cyber-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-cyber-text mb-2">No analyses found</h3>
          <p className="text-cyber-text-muted mb-6">
            {records.length === 0 ? "You haven't analyzed any media yet." : "No records match your filters."}
          </p>
          <Link to="/analyze" className="cyber-btn inline-flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Analyze Media
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <div key={record.id} className="glass-card-hover p-4 group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  record.media_type === 'image' ? 'bg-cyber-success/10' : 'bg-cyber-warning/10'
                }`}>
                  {record.media_type === 'image' ? (
                    <ImageIcon className="w-6 h-6 text-cyber-success" />
                  ) : (
                    <Video className="w-6 h-6 text-cyber-warning" />
                  )}
                </div>

                <Link to={`/results/${record.analysis_id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-sm font-medium text-cyber-text truncate group-hover:text-cyber-accent transition-colors">
                      {record.file_name}
                    </p>
                    {record.result === 'authentic' ? (
                      <span className="cyber-badge-success"><ShieldCheck className="w-3 h-3" /> Authentic</span>
                    ) : record.result === 'manipulated' ? (
                      <span className="cyber-badge-danger"><AlertTriangle className="w-3 h-3" /> Manipulated</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-cyber-warning/10 text-cyber-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Inconclusive</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-cyber-text-muted">
                    <span className="font-mono">{record.analysis_id}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(record.created_at).toLocaleString()}</span>
                    <span>{(record.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </Link>

                <div className="hidden md:flex items-center gap-6 text-right">
                  <div>
                    <p className="text-sm font-mono text-cyber-text-dim">{(Number(record.confidence) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-cyber-text-muted">confidence</p>
                  </div>
                  <div>
                    <p className={`text-sm font-mono font-medium ${Number(record.risk_score) > 60 ? 'text-cyber-danger' : Number(record.risk_score) > 40 ? 'text-cyber-warning' : 'text-cyber-success'}`}>
                      {Number(record.risk_score)}/100
                    </p>
                    <p className="text-xs text-cyber-text-muted">risk score</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const cached = sessionStorage.getItem(`analysis-${record.analysis_id}`);
                      if (cached) {
                        generatePdfReport(JSON.parse(cached));
                      }
                    }}
                    className="p-2 rounded-lg text-cyber-text-muted hover:text-cyber-accent hover:bg-cyber-accent/10 transition-colors"
                    title="Download report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="p-2 rounded-lg text-cyber-text-muted hover:text-cyber-danger hover:bg-cyber-danger/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/results/${record.analysis_id}`}
                    className="p-2 rounded-lg text-cyber-text-muted hover:text-cyber-accent hover:bg-cyber-accent/10 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
