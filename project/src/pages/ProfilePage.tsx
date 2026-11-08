import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Building2, Save, CheckCircle2, AlertCircle, Shield, Activity, Clock } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, authentic: 0, manipulated: 0 });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setOrganization(profile.organization ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      const { data } = await supabase
        .from('analyses')
        .select('result')
        .eq('user_id', user.id);
      if (data) {
        setStats({
          total: data.length,
          authentic: data.filter((a) => a.result === 'authentic').length,
          manipulated: data.filter((a) => a.result === 'manipulated').length,
        });
      }
    }
    loadStats();
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        organization,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user!.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Profile</h1>
        <p className="text-cyber-text-muted mt-1">Manage your account information</p>
      </div>

      {/* Profile header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyber-accent to-cyber-purple flex items-center justify-center text-cyber-bg font-bold text-2xl">
            {fullName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-cyber-text">{fullName || 'User'}</h2>
            <p className="text-sm text-cyber-text-muted">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                profile?.role === 'admin'
                  ? 'bg-cyber-purple/10 text-cyber-purple'
                  : 'bg-cyber-accent/10 text-cyber-accent'
              }`}>
                {profile?.role === 'admin' ? 'Administrator' : 'Analyst'}
              </span>
              <span className="text-xs text-cyber-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" /> Joined {new Date(profile?.created_at ?? Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <Activity className="w-6 h-6 text-cyber-accent mx-auto mb-2" />
          <p className="text-2xl font-bold text-cyber-text">{stats.total}</p>
          <p className="text-xs text-cyber-text-muted">Total Analyses</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Shield className="w-6 h-6 text-cyber-success mx-auto mb-2" />
          <p className="text-2xl font-bold text-cyber-text">{stats.authentic}</p>
          <p className="text-xs text-cyber-text-muted">Authentic</p>
        </div>
        <div className="glass-card p-4 text-center">
          <AlertCircle className="w-6 h-6 text-cyber-danger mx-auto mb-2" />
          <p className="text-2xl font-bold text-cyber-text">{stats.manipulated}</p>
          <p className="text-xs text-cyber-text-muted">Manipulated</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-cyber-text-dim mb-4">Edit Profile</h3>
        {message && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-cyber-success/10 border border-cyber-success/30 text-cyber-success'
              : 'bg-cyber-danger/10 border border-cyber-danger/30 text-cyber-danger'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="cyber-input w-full pl-11" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-2">Email (read-only)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
              <input type="email" value={user?.email ?? ''} disabled className="cyber-input w-full pl-11 opacity-50 cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-2">Organization</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
              <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your organization" className="cyber-input w-full pl-11" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-2">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself..." className="cyber-input w-full resize-none" />
          </div>
          <button type="submit" disabled={saving} className="cyber-btn flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-cyber-bg/30 border-t-cyber-bg rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
