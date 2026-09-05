import React from 'react';
import { ShieldCheck, BarChart3, Sliders, ScrollText, UserCheck, LogIn, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'queue' | 'metrics' | 'simulator' | 'audit' | 'integration';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenLogin: () => void;
}

const TABS: Array<{ id: NavTab; label: string; icon: React.ElementType }> = [
  { id: 'queue', label: 'Disputes', icon: ShieldCheck },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'simulator', label: 'Simulator', icon: Sliders },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'integration', label: 'Razorpay', icon: Zap },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenLogin }) => {
  const { reviewer, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand / Logo */}
          <div
            className="flex items-center space-x-2.5 cursor-pointer shrink-0"
            onClick={() => setActiveTab('queue')}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink">
              <ShieldCheck className="w-4 h-4 text-white" />
            </span>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-ink tracking-tight">ChargebackGuard</span>
              </div>
              <p className="text-[11px] text-ink-tertiary -mt-0.5">Track 02 &middot; AI Risk Manager</p>
            </div>
          </div>

          {/* Navigation — segmented control */}
          <nav className="flex items-center gap-0.5 bg-surface rounded-full p-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-white text-ink shadow-card'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Reviewer Auth Section */}
          <div className="flex items-center shrink-0">
            {isAuthenticated && reviewer ? (
              <div className="flex items-center gap-2.5 border border-hairline pl-1 pr-2 py-1 rounded-full">
                <span className="w-6 h-6 rounded-full bg-surface text-ink-secondary flex items-center justify-center">
                  <UserCheck className="w-3.5 h-3.5" />
                </span>
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-[12px] font-medium text-ink">{reviewer.name}</div>
                  <div className="text-[10px] text-ink-tertiary">{reviewer.role}</div>
                </div>
                <button
                  onClick={logout}
                  title="Log out"
                  className="text-ink-tertiary hover:text-ink transition-colors p-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-ink text-white hover:bg-black transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reviewer Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
