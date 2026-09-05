import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, Info } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('analyst@razorpay.com');
  const [password, setPassword] = useState('Chargeback@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login(email, password);
      login(res.token, res.reviewer);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-popover">
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Reviewer Portal Login</h3>
              <p className="text-[12px] text-ink-tertiary">Authenticated actions for human-in-the-loop overrides</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-ink-tertiary hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-[13px]">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-ink-secondary mb-1.5">Reviewer Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-surface border border-hairline rounded-lg text-[14px] text-ink placeholder-ink-tertiary focus:outline-none focus:border-ink transition-colors"
                placeholder="analyst@razorpay.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-secondary mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-surface border border-hairline rounded-lg text-[14px] text-ink placeholder-ink-tertiary focus:outline-none focus:border-ink transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface text-ink-secondary text-[12px] space-y-1">
            <div className="flex items-center gap-1.5 text-ink font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>Demo credentials pre-filled</span>
            </div>
            <div className="text-[11px] text-ink-tertiary">
              Email: <span className="text-ink-secondary font-mono">analyst@razorpay.com</span> &middot; Password:{' '}
              <span className="text-ink-secondary font-mono">Chargeback@2026</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-[13px] font-medium text-ink-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-full text-[13px] font-medium bg-ink hover:bg-black text-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating…' : 'Sign In as Reviewer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
