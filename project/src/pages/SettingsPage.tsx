import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Bell, Shield, Palette, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [highResHeatmaps, setHighResHeatmaps] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Settings</h1>
        <p className="text-cyber-text-muted mt-1">Configure your DeepGuard preferences</p>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-cyber-accent" />
          <h3 className="text-sm font-medium text-cyber-text">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyber-text">Analysis notifications</p>
              <p className="text-xs text-cyber-text-muted">Get notified when analysis completes</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-cyber-accent' : 'bg-cyber-border'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-5 h-5 text-cyber-accent" />
          <h3 className="text-sm font-medium text-cyber-text">Analysis Preferences</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyber-text">Auto-save analysis history</p>
              <p className="text-xs text-cyber-text-muted">Save all analyses to your detection history</p>
            </div>
            <button
              onClick={() => setAutoSaveHistory(!autoSaveHistory)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoSaveHistory ? 'bg-cyber-accent' : 'bg-cyber-border'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoSaveHistory ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyber-text">High-resolution heatmaps</p>
              <p className="text-xs text-cyber-text-muted">Generate higher quality Grad-CAM heatmaps (slower)</p>
            </div>
            <button
              onClick={() => setHighResHeatmaps(!highResHeatmaps)}
              className={`relative w-12 h-6 rounded-full transition-colors ${highResHeatmaps ? 'bg-cyber-accent' : 'bg-cyber-border'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${highResHeatmaps ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-cyber-accent" />
          <h3 className="text-sm font-medium text-cyber-text">Security</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyber-success" />
              <div>
                <p className="text-sm text-cyber-text">JWT Authentication</p>
                <p className="text-xs text-cyber-text-muted">Your session is secured with JWT tokens</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyber-success" />
              <div>
                <p className="text-sm text-cyber-text">Row-Level Security</p>
                <p className="text-xs text-cyber-text-muted">Your data is protected by database-level RLS policies</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-bg/50 border border-cyber-border">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyber-success" />
              <div>
                <p className="text-sm text-cyber-text">Password Hashing</p>
                <p className="text-xs text-cyber-text-muted">Passwords are securely hashed by Supabase Auth</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About account */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-cyber-accent" />
          <h3 className="text-sm font-medium text-cyber-text">Account Information</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-cyber-text-muted">Email:</span><span className="text-cyber-text-dim font-mono">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-cyber-text-muted">User ID:</span><span className="text-cyber-text-dim font-mono truncate ml-4 max-w-[200px]">{user?.id}</span></div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-l-4 border-l-cyber-danger">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-cyber-danger" />
          <h3 className="text-sm font-medium text-cyber-danger">Danger Zone</h3>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyber-danger/30 text-cyber-danger hover:bg-cyber-danger/10 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
