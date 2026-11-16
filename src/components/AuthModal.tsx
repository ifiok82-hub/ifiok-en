import { LogIn, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { connectWithPi } from '../lib/pi.ts';
import type { UserProfile } from '../types/platform.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePiAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const session = await connectWithPi(['username', 'payments', 'wallet_address']);
      const meRes = await fetch('/api/auth/me', { credentials: 'include' }).catch(() => null);
      if (meRes && meRes.ok) {
        const data = (await meRes.json().catch(() => ({}))) as { user?: UserProfile | null };
        if (data.user) {
          onAuthenticated(data.user);
          onClose();
          return;
        }
      }
      onAuthenticated({
        id: 0,
        email: null,
        full_name: `@${session.username}`,
        account_type: 'member',
        country: 'Global',
        timezone: 'UTC',
        preferred_currency: 'PI',
        preferred_language: 'en',
        education_level: 'undergraduate',
        age_group: 'adult',
        phone_country_code: '+1',
        phone_number: '',
        bio: '',
        pi_username: session.username,
        pi_uid: session.uid,
        mfa_enabled: 0,
        status: 'active',
        roles: ['member'],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pi Network authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" showWordmark={false} />
            <h2 id="auth-modal-title" className="text-lg font-display font-bold text-slate-900 dark:text-white truncate">
              Sign in with Pi
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-lg border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              IFIOK-EN uses Official Pi SDK authentication only. Sign in inside Pi Browser or Pi App Studio to connect your Pi account.
            </span>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void handlePiAuth()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-[#4C1D95] to-[#0E1A36] hover:from-[#5B21B6] hover:to-[#172952] dark:from-amber-500 dark:to-amber-400 text-white dark:text-slate-950 font-bold text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Signing in...' : 'Sign in with Pi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
