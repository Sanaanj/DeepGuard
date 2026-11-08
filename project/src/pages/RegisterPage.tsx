import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex bg-cyber-bg grid-bg">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Shield className="w-10 h-10 text-cyber-accent" />
            <h1 className="text-2xl font-bold text-cyber-text">DeepGuard</h1>
          </div>

          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-cyber-text mb-2">Create your account</h2>
            <p className="text-cyber-text-muted mb-6">Start analyzing media for deepfake manipulation</p>

            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-cyber-danger/10 border border-cyber-danger/30 text-cyber-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-cyber-text-dim mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="cyber-input w-full pl-11"
                    placeholder="John Analyst"
                  />
                </div>
              </div>

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
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-cyber-text-dim mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="cyber-input w-full pl-11"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-cyber-text-muted">
                <CheckCircle2 className="w-4 h-4 text-cyber-success flex-shrink-0 mt-0.5" />
                <span>By signing up, you agree that AI predictions are probabilistic and should not be treated as conclusive proof.</span>
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
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-cyber-text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-cyber-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
