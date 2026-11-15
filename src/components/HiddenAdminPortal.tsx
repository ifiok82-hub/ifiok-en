import { ArrowLeft, Lock, LogIn, LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PiAuthSession, TestnetPaymentSuccess } from '../lib/pi.ts';
import type { AppView, UserProfile } from '../types/platform.ts';
import { AdminDashboard } from './AdminDashboard.tsx';
import { BrandLogo } from './BrandLogo.tsx';
import { PiTestnetPaymentButton } from './PiTestnetPaymentButton.tsx';

interface PiTestnetPaymentRow {
  id: number | string;
  payment_id: string;
  txid: string;
  username: string;
  amount_pi: number;
  status: string;
  environment: string;
  created_at: string;
}

interface HiddenAdminPortalProps {
  adminUnlocked: boolean;
  piAuth: PiAuthSession | null;
  user: UserProfile | null;
  onConnectPi: () => Promise<void>;
  onLogoutAdmin: () => Promise<void>;
  onBackHome: () => void;
  onNavigateView: (view: AppView) => void;
  onRefreshSummary: () => void;
}

export function isAuthorizedPiAdmin(piAuth: PiAuthSession | null): boolean {
  if (!piAuth?.username) return false;
  return piAuth.username.replace(/^@/, '').trim().toLowerCase() === 'ifiok1967';
}

export function HiddenAdminPortal({
  adminUnlocked,
  piAuth,
  user,
  onConnectPi,
  onLogoutAdmin,
  onBackHome,
  onNavigateView,
  onRefreshSummary,
}: HiddenAdminPortalProps) {
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PiTestnetPaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showFullGovernance, setShowFullGovernance] = useState(false);

  const isAdminUser = isAuthorizedPiAdmin(piAuth);
  const hasDbAdminRole = Boolean(user?.roles.some((r) => ['super_admin', 'moderator', 'finance_admin'].includes(r)));

  const loadPayments = useCallback(async () => {
    if (!piAuth || !isAuthorizedPiAdmin(piAuth)) return;
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/pi/payments', {
        credentials: 'include',
        headers: {
          'x-pi-access-token': piAuth.accessToken,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { payments?: PiTestnetPaymentRow[] };
        if (Array.isArray(data.payments)) {
          setPayments((prev) => {
            const byId = new Map<string, PiTestnetPaymentRow>();
            for (const row of data.payments || []) {
              byId.set(row.payment_id, row);
            }
            for (const row of prev) {
              if (!byId.has(row.payment_id)) byId.set(row.payment_id, row);
            }
            return Array.from(byId.values());
          });
        }
      }
    } catch {
      // Preserve existing session payments silently
    } finally {
      setLoadingPayments(false);
    }
  }, [piAuth]);

  useEffect(() => {
    if (adminUnlocked && isAdminUser) {
      void loadPayments();
    }
  }, [adminUnlocked, isAdminUser, loadPayments]);

  const handleConnect = async () => {
    setAuthError(null);
    setConnecting(true);
    try {
      await onConnectPi();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to authenticate with Pi Network.');
    } finally {
      setConnecting(false);
    }
  };

  const handlePaymentSuccess = (receipt: TestnetPaymentSuccess) => {
    setPayments((prev) => {
      const filtered = prev.filter((p) => p.payment_id !== receipt.paymentId);
      return [
        {
          id: `live-${Date.now()}`,
          payment_id: receipt.paymentId,
          txid: receipt.txid,
          username: receipt.username,
          amount_pi: receipt.amount,
          status: 'completed',
          environment: 'testnet',
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        },
        ...filtered,
      ];
    });
    void loadPayments();
  };

  // Gate 1: Secret unlock check
  if (!adminUnlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-8 text-center space-y-5 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-display font-bold text-slate-950 dark:text-white">
              Access Restricted
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Administrator authentication unlock is required before viewing this console.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </button>
        </div>
      </div>
    );
  }

  // Gate 2: Require Pi Authentication
  if (!piAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-400/40 dark:border-amber-500/30 bg-white dark:bg-[#0D152B] p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <BrandLogo size="sm" />
            <span className="text-xs font-mono font-semibold text-purple-700 dark:text-amber-300">
              Admin Gate
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-display font-bold text-slate-950 dark:text-white">
              Admin Login Required
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Authenticate with your authorized Pi Network administrator account (@Ifiok1967) to access Testnet verification controls.
            </p>
          </div>

          {authError && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-gradient-to-r from-[#4C1D95] to-[#0E1A36] hover:from-[#5B21B6] hover:to-[#172952] dark:from-amber-500 dark:to-amber-400 text-white dark:text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{connecting ? 'Connecting Pi...' : 'Connect with Pi'}</span>
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Site</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 3: Strictly allow only @Ifiok1967
  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#0D152B] p-8 text-center space-y-5 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-display font-bold text-rose-700 dark:text-rose-400">
              Access Denied - Admin Only
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Signed in as <span className="font-mono font-semibold">@{piAuth.username}</span>. Only the authorized administrator account may open this dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B]">
      {/* Top Admin Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" />
            <div>
              <h1 className="text-base sm:text-lg font-display font-bold text-slate-950 dark:text-white">
                IFIOK-EN Admin Management Dashboard
              </h1>
              <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Authorized Admin: @{piAuth.username}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasDbAdminRole && (
              <button
                type="button"
                onClick={() => setShowFullGovernance((prev) => !prev)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {showFullGovernance ? 'Hide Platform Governance' : 'Open Platform Governance'}
              </button>
            )}
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Pi Developer Portal - Sandbox Testnet Verification */}
        <section className="space-y-3">
          <PiTestnetPaymentButton onPaymentSuccess={handlePaymentSuccess} />
        </section>

        {/* Section 2: Last Testnet Payments from pi_testnet_payments */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-bold text-slate-950 dark:text-white">
                Last Testnet Payments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recorded Pi Testnet transactions from pi_testnet_payments
              </p>
            </div>
            <button
              type="button"
              onClick={loadPayments}
              disabled={loadingPayments}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPayments ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              {loadingPayments
                ? 'Loading Testnet payment history...'
                : 'No Testnet payments recorded yet. Click "Pay 0.01 Pi - Testnet Test" above to run a live verification.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50 dark:bg-[#081024]">
                  <tr>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">TXID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.payment_id}>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {p.username ? `@${p.username.replace(/^@/, '')}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {p.amount_pi} π
                      </td>
                      <td className="py-3 px-4 font-mono break-all max-w-[180px]">{p.payment_id}</td>
                      <td className="py-3 px-4 font-mono break-all max-w-[200px]">{p.txid || '—'}</td>
                      <td className="py-3 px-4 font-mono uppercase">
                        <span
                          className={
                            p.status === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : p.status === 'failed'
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-amber-600 dark:text-amber-400 font-semibold'
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{p.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Optional Platform Governance Console for full SQLite super_admin sessions */}
        {hasDbAdminRole && showFullGovernance && user && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <AdminDashboard
              user={user}
              onNavigateView={onNavigateView}
              onRefreshSummary={onRefreshSummary}
            />
          </section>
        )}
      </main>
    </div>
  );
}
