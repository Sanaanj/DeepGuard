import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanLine,
  History,
  FileText,
  BarChart3,
  Info,
  User,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze Media', icon: ScanLine },
  { to: '/history', label: 'Detection History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/about', label: 'About', icon: Info },
];

const bottomNavItems = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-cyber-bg grid-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-cyber-surface border-r border-cyber-border z-40 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-cyber-border">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Shield className="w-8 h-8 text-cyber-accent" />
              <div className="absolute inset-0 animate-ping-slow opacity-50">
                <Shield className="w-8 h-8 text-cyber-accent" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-cyber-text tracking-tight">DeepGuard</h1>
              <p className="text-[10px] text-cyber-text-muted font-mono tracking-wider">AI FORENSICS</p>
            </div>
          </div>
          <button
            className="lg:hidden text-cyber-text-muted hover:text-cyber-text"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-cyber-accent/10 text-cyber-accent border-l-2 border-cyber-accent'
                    : 'text-cyber-text-dim hover:text-cyber-text hover:bg-cyber-card/50'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-cyber-purple/10 text-cyber-purple border-l-2 border-cyber-purple'
                    : 'text-cyber-text-dim hover:text-cyber-text hover:bg-cyber-card/50'
                }`
              }
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        {/* Bottom nav */}
        <div className="px-3 py-3 border-t border-cyber-border space-y-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-cyber-accent/10 text-cyber-accent'
                    : 'text-cyber-text-dim hover:text-cyber-text hover:bg-cyber-card/50'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-cyber-danger/80 hover:text-cyber-danger hover:bg-cyber-danger/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-t border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyber-accent to-cyber-purple flex items-center justify-center text-cyber-bg font-bold text-sm">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-cyber-text truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-cyber-text-muted truncate">
                {profile?.role === 'admin' ? 'Administrator' : 'Analyst'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-cyber-border bg-cyber-surface sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-cyber-text-muted hover:text-cyber-text"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyber-accent" />
            <span className="font-bold text-cyber-text">DeepGuard</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
