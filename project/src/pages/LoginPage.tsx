import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, AlertCircle, ArrowRight, ScanLine, FileText, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isLocalMode } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex bg-cyber-bg grid-bg">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyber-accent/5 to-transparent" />
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <Shield className="w-12 h-12 text-cyber-accent" />
              <div className="absolute inset-0 animate-ping-slow opacity-30">
                <Shield className="w-12 h-12 text-cyber-accent" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-cyber-text">DeepGuard</h1>
              <p className="text-sm text-cyber-accent font-mono tracking-wider">AI DEEPFAKE DETECTION & FORENSICS</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-cyber-text mb-4 leading-tight">
            Detect manipulated media with <span className="text-cyber-accent text-glow">AI-powered</span> forensic analysis
          </h2>
          <p className="text-cyber-text-dim mb-8 text-lg">
            Upload images or videos and get a genuine deep-learning analysis with Grad-CAM heatmaps, temporal consistency checks, and evidence-fusion scoring.
          </p>

          <div className="space-y-4">
            {[
              { icon: ScanLine, title: 'CNN-based Detection', desc: 'Xception-style deep learning model' },
              { icon: FileText, title: 'Forensic Reports', desc: 'Professional PDF analysis reports' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Track detection history and metrics' },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyber-accent/10 flex items-center justify-center border border-cyber-accent/30">
                  <f.icon className="w-5 h-5 text-cyber-accent" />
                </div>
                <div>
                  <p className="text-cyber-text font-medium">{f.title}</p>
                  <p className="text-sm text-cyber-text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <Shield className="w-10 h-10 text-cyber-accent" />
            <h1 className="text-2xl font-bold text-cyber-text">DeepGuard</h1>
          </div>

          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-cyber-text mb-2">Welcome back</h2>
            <p className="text-cyber-text-muted mb-6">Sign in to your forensic analysis account</p>

            {isLocalMode && (
              <p className="mb-4 text-xs text-cyber-text-muted">
                Offline mode: accounts and history are stored in this browser. New here? Register first.
              </p>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-cyber-danger/10 border border-cyber-danger/30 text-cyber-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-cyber-text-dim mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="cyber-input w-full pl-11"
                    placeholder="analyst@deepguard.ai"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-cyber-text-dim mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="cyber-input w-full pl-11"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cyber-btn w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-cyber-bg/30 border-t-cyber-bg rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-cyber-text-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-cyber-accent hover:underline font-medium">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
