import {
  Activity,
  ArrowLeft,
  BookOpen,
  Building2,
  Database,
  FileWarning,
  Lock,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import type { AppView, UserProfile } from '../types/platform.ts';

type AdminTab =
  | 'analytics'
  | 'members'
  | 'approvals'
  | 'moderation'
  | 'finance'
  | 'settings'
  | 'security'
  | 'backups';

interface AdminDashboardProps {
  user: UserProfile;
  onNavigateView: (view: AppView) => void;
  onRefreshSummary: () => void;
}

interface AdminOverviewData {
  analytics: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    pendingBusinesses: number;
    pendingCourses: number;
    pendingProducts: number;
    pendingOpportunities: number;
    pendingServices: number;
    openDisputes: number;
    completedPaymentsCount: number;
    completedVolumePi: number;
    totalCommissionPi: number;
  };
  settings: Record<string, string>;
  roles: Array<{ id: number; slug: string; name: string }>;
  users: Array<{
    id: number;
    email: string | null;
    pi_username: string | null;
    full_name: string;
    country: string;
    account_type: string;
    status: string;
    roles_csv: string | null;
    created_at: string;
  }>;
  businesses: Array<Record<string, unknown>>;
  instructors: Array<Record<string, unknown>>;
  courses: Array<Record<string, unknown>>;
  sellers: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  communityPosts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  disputes: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  securityEvents: Array<Record<string, unknown>>;
  backupFiles: string[];
}

export function AdminDashboard({ user, onNavigateView, onRefreshSummary }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(res);
      setSettingsForm(res.settings);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load admin console.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const mutate = async (url: string, method: string, body?: unknown, successMsg = 'Updated.') => {
    try {
      await apiRequest(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setNotice({ type: 'ok', text: successMsg });
      await loadAdmin();
      onRefreshSummary();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Operation failed.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate('/api/admin/settings', 'PATCH', { settings: settingsForm }, 'Platform settings & content saved.');
  };

  const handleCreateBackup = async () => {
    await mutate('/api/admin/backups/snapshot', 'POST', undefined, 'Database snapshot backup created.');
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof Activity }> = [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'members', label: 'Members & Roles', icon: Users },
    { id: 'approvals', label: 'Verifications & Approvals', icon: Building2 },
    { id: 'moderation', label: 'Community & Disputes', icon: FileWarning },
    { id: 'finance', label: 'Transactions & Subs', icon: ShoppingBag },
    { id: 'settings', label: 'Content & Commissions', icon: Settings },
    { id: 'security', label: 'Security & Audit Logs', icon: ShieldAlert },
    { id: 'backups', label: 'Database Backups', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] p-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => onNavigateView('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Member View</span>
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400">
            <Lock className="w-3 h-3" /> RBAC
          </span>
        </div>

        <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 sm:p-8 max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Global Administrator Console / <span className="capitalize">{tab}</span>
            </p>
            <h1 className="text-2xl font-display font-bold text-slate-950 dark:text-white">
              IFIOK-EN Governance & Operations
            </h1>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Operator: {user.full_name} ({user.roles.join(', ')})
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4 border ${
              notice.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading || !data ? (
          <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] animate-pulse" />
        ) : (
          <>
            {tab === 'analytics' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Registered Accounts', val: data.analytics.totalUsers },
                  { label: 'Active Accounts', val: data.analytics.activeUsers },
                  { label: 'Suspended Accounts', val: data.analytics.suspendedUsers },
                  { label: 'Pending Businesses', val: data.analytics.pendingBusinesses },
                  { label: 'Pending Courses', val: data.analytics.pendingCourses },
                  { label: 'Pending Market Products', val: data.analytics.pendingProducts },
                  { label: 'Pending Opportunities', val: data.analytics.pendingOpportunities },
                  { label: 'Open Disputes', val: data.analytics.openDisputes },
                  { label: 'Completed Pi Payments', val: data.analytics.completedPaymentsCount },
                  { label: 'Verified Pi Volume', val: `${data.analytics.completedVolumePi.toFixed(2)} π` },
                  { label: 'Platform Commissions', val: `${data.analytics.totalCommissionPi.toFixed(2)} π` },
                  { label: 'Pi Environment', val: 'Testnet (Mainnet Locked)' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5"
                  >
                    <div className="text-xl font-mono font-bold tabular-nums text-slate-950 dark:text-white">
                      {m.val}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'members' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Identity</th>
                      <th className="py-3 px-4">Country</th>
                      <th className="py-3 px-4">Roles</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.users.map((u) => {
                      const rolesList = (u.roles_csv || '').split(',').filter(Boolean);
                      return (
                        <tr key={u.id}>
                          <td className="py-3 px-4 font-semibold">{u.full_name}</td>
                          <td className="py-3 px-4 font-mono">{u.email || `@${u.pi_username}`}</td>
                          <td className="py-3 px-4">{u.country}</td>
                          <td className="py-3 px-4 font-mono">{rolesList.join(', ')}</td>
                          <td className="py-3 px-4 font-mono uppercase">{u.status}</td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/admin/users/${u.id}/status`,
                                  'PATCH',
                                  { status: u.status === 'active' ? 'suspended' : 'active' },
                                  `User ${u.status === 'active' ? 'suspended' : 'reactivated'}.`
                                )
                              }
                              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            {user.roles.includes('super_admin') && !rolesList.includes('moderator') && (
                              <button
                                type="button"
                                onClick={() =>
                                  mutate(
                                    `/api/admin/users/${u.id}/roles`,
                                    'POST',
                                    { roleSlug: 'moderator', action: 'grant' },
                                    'Moderator role granted.'
                                  )
                                }
                                className="px-2.5 py-1 rounded border border-purple-400 text-purple-700 dark:text-amber-400 cursor-pointer"
                              >
                                +Moderator
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'approvals' && (
              <div className="space-y-8">
                {/* Businesses */}
                <ApprovalSection
                  title="SME Business Verification Queue"
                  icon={Building2}
                  items={data.businesses}
                  renderTitle={(b) => `${String(b.business_name)} (${String(b.sector)} · ${String(b.country)})`}
                  renderStatus={(b) => String(b.verification_status)}
                  onApprove={(id) =>
                    mutate(`/api/admin/businesses/${id}`, 'PATCH', { verificationStatus: 'verified', isFeatured: true })
                  }
                  onReject={(id) =>
                    mutate(`/api/admin/businesses/${id}`, 'PATCH', { verificationStatus: 'rejected', isFeatured: false })
                  }
                />

                {/* Instructors & Courses */}
                <ApprovalSection
                  title="Instructors Approval Queue"
                  icon={BookOpen}
                  items={data.instructors}
                  renderTitle={(i) => `${String(i.full_name)} — ${String(i.headline)}`}
                  renderStatus={(i) => String(i.approval_status)}
                  onApprove={(id) => mutate(`/api/admin/instructors/${id}`, 'PATCH', { approvalStatus: 'approved' })}
                  onReject={(id) => mutate(`/api/admin/instructors/${id}`, 'PATCH', { approvalStatus: 'rejected' })}
                />

                <ApprovalSection
                  title="Academy Courses Queue"
                  icon={BookOpen}
                  items={data.courses}
                  renderTitle={(c) => `${String(c.title)} — ${String(c.price_pi)} π (${String(c.instructor_name)})`}
                  renderStatus={(c) => String(c.approval_status)}
                  onApprove={(id) =>
                    mutate(`/api/admin/courses/${id}`, 'PATCH', { approvalStatus: 'approved', isFeatured: true })
                  }
                  onReject={(id) =>
                    mutate(`/api/admin/courses/${id}`, 'PATCH', { approvalStatus: 'rejected', isFeatured: false })
                  }
                />

                {/* Sellers & Products */}
                <ApprovalSection
                  title="Marketplace Sellers Queue"
                  icon={ShoppingBag}
                  items={data.sellers}
                  renderTitle={(s) => `${String(s.store_name)} — ${String(s.full_name)} (${String(s.country)})`}
                  renderStatus={(s) => String(s.verification_status)}
                  onApprove={(id) => mutate(`/api/admin/sellers/${id}`, 'PATCH', { verificationStatus: 'verified' })}
                  onReject={(id) => mutate(`/api/admin/sellers/${id}`, 'PATCH', { verificationStatus: 'suspended' })}
                />

                <ApprovalSection
                  title="Market Product Listings Queue"
                  icon={ShoppingBag}
                  items={data.products}
                  renderTitle={(p) => `${String(p.title)} — ${String(p.price_pi)} π (${String(p.store_name)})`}
                  renderStatus={(p) => String(p.approval_status)}
                  onApprove={(id) => mutate(`/api/admin/products/${id}`, 'PATCH', { approvalStatus: 'approved' })}
                  onReject={(id) => mutate(`/api/admin/products/${id}`, 'PATCH', { approvalStatus: 'rejected' })}
                />

                {/* Opportunities & Freelance Services */}
                <ApprovalSection
                  title="Jobs, Grants & Scholarships Queue"
                  icon={Users}
                  items={data.opportunities}
                  renderTitle={(o) => `${String(o.title)} (${String(o.opportunity_type)} · ${String(o.organization_name)})`}
                  renderStatus={(o) => String(o.approval_status)}
                  onApprove={(id) => mutate(`/api/admin/opportunities/${id}`, 'PATCH', { approvalStatus: 'approved' })}
                  onReject={(id) => mutate(`/api/admin/opportunities/${id}`, 'PATCH', { approvalStatus: 'rejected' })}
                />

                <ApprovalSection
                  title="Freelance Services Queue"
                  icon={Users}
                  items={data.services}
                  renderTitle={(s) => `${String(s.title)} — ${String(s.price_pi)} π (${String(s.freelancer_name)})`}
                  renderStatus={(s) => String(s.approval_status)}
                  onApprove={(id) => mutate(`/api/admin/services/${id}`, 'PATCH', { approvalStatus: 'approved' })}
                  onReject={(id) => mutate(`/api/admin/services/${id}`, 'PATCH', { approvalStatus: 'rejected' })}
                />
              </div>
            )}

            {tab === 'moderation' && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <h2 className="font-display font-bold text-lg">Disputes, Complaints & Abuse Reports</h2>
                  {data.disputes.length === 0 ? (
                    <p className="text-sm text-slate-500">No disputes or complaints filed.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.disputes.map((d) => (
                        <div
                          key={String(d.id)}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1 max-w-xl">
                            <div className="text-xs font-mono text-slate-500 uppercase">
                              Case #{String(d.id)} · {String(d.target_type)} · {String(d.status)} · By {String(d.reporter_name)}
                            </div>
                            <div className="font-semibold text-sm">{String(d.reason)}</div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{String(d.details)}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(`/api/admin/disputes/${d.id}`, 'PATCH', {
                                  status: 'resolved',
                                  resolutionNotes: 'Reviewed and resolved by Global Administrator.',
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Resolve
                            </button>
                            {d.target_type === 'order' && (
                              <button
                                type="button"
                                onClick={() =>
                                  mutate(`/api/admin/disputes/${d.id}`, 'PATCH', {
                                    status: 'refunded',
                                    resolutionNotes: 'Order refund authorized.',
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
                              >
                                Refund Order
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h2 className="font-display font-bold text-lg">Community Content Moderation</h2>
                  {data.communityPosts.length === 0 ? (
                    <p className="text-sm text-slate-500">No community posts yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
                      {data.communityPosts.map((p) => (
                        <div key={String(p.id)} className="p-4 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-sm">{String(p.title)}</div>
                            <div className="text-xs text-slate-500">
                              By {String(p.author_name)} · Status: {String(p.moderation_status)} · Reports:{' '}
                              <span className="font-mono">{String(p.reports_count)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(`/api/admin/community-posts/${p.id}`, 'PATCH', { moderationStatus: 'active' })
                              }
                              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                mutate(`/api/admin/community-posts/${p.id}`, 'PATCH', { moderationStatus: 'removed' })
                              }
                              className="px-3 py-1 rounded bg-rose-600 text-white text-xs cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'finance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-display font-bold text-lg mb-3">Platform Orders & Pi Settlements</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Order</th>
                          <th className="py-3 px-4">Buyer</th>
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4 text-right">Commission</th>
                          <th className="py-3 px-4">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">
                              No transactions recorded yet.
                            </td>
                          </tr>
                        ) : (
                          data.transactions.map((t) => (
                            <tr key={String(t.id)}>
                              <td className="py-3 px-4 font-mono">#{String(t.id)}</td>
                              <td className="py-3 px-4">{String(t.buyer_name)}</td>
                              <td className="py-3 px-4">{String(t.item_title)}</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">{String(t.total_pi)} π</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
                                {String(t.platform_fee_pi)} π
                              </td>
                              <td className="py-3 px-4 font-mono uppercase">{String(t.payment_status || t.status)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <form
                onSubmit={handleSaveSettings}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4 max-w-3xl"
              >
                <h2 className="font-display font-bold text-lg">Website Content, Commissions & Pi Configuration</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Freelance Commission (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={settingsForm.freelance_commission_pct || '8'}
                      onChange={(e) =>
                        setSettingsForm((s) => ({ ...s, freelance_commission_pct: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Marketplace Commission (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={settingsForm.marketplace_commission_pct || '5'}
                      onChange={(e) =>
                        setSettingsForm((s) => ({ ...s, marketplace_commission_pct: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pro Creator Plan (π/month)</label>
                    <input
                      type="number"
                      min="1"
                      value={settingsForm.subscription_pro_pi || '12'}
                      onChange={(e) => setSettingsForm((s) => ({ ...s, subscription_pro_pi: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Verified Business Plan (π/month)</label>
                    <input
                      type="number"
                      min="1"
                      value={settingsForm.subscription_business_pi || '35'}
                      onChange={(e) =>
                        setSettingsForm((s) => ({ ...s, subscription_business_pi: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Global Announcement Banner (leave blank to hide)</label>
                  <input
                    type="text"
                    value={settingsForm.announcement_banner || ''}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, announcement_banner: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Homepage Hero Headline</label>
                  <input
                    type="text"
                    value={settingsForm.hero_headline || ''}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, hero_headline: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Homepage Hero Description</label>
                  <textarea
                    rows={3}
                    value={settingsForm.hero_subheadline || ''}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, hero_subheadline: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>

                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                  Pi Network Settlement Mode: <strong>Testnet (sandbox: true)</strong>. Mainnet remains locked until official Mainnet credentials and platform approvals are provisioned.
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Save Settings
                </button>
              </form>
            )}

            {tab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-display font-bold text-lg mb-3">Security Events</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Event</th>
                          <th className="py-3 px-4">Severity</th>
                          <th className="py-3 px-4">Details</th>
                          <th className="py-3 px-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.securityEvents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              No security warnings recorded.
                            </td>
                          </tr>
                        ) : (
                          data.securityEvents.map((ev) => (
                            <tr key={String(ev.id)}>
                              <td className="py-3 px-4 font-mono">{String(ev.event_type)}</td>
                              <td className="py-3 px-4 font-mono uppercase">{String(ev.severity)}</td>
                              <td className="py-3 px-4">{String(ev.details)}</td>
                              <td className="py-3 px-4 font-mono">{String(ev.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="font-display font-bold text-lg mb-3">Audit Trail</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Entity</th>
                          <th className="py-3 px-4">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.auditLogs.map((log) => (
                          <tr key={String(log.id)}>
                            <td className="py-3 px-4">{String(log.actor_name || 'System')}</td>
                            <td className="py-3 px-4 font-mono">{String(log.action)}</td>
                            <td className="py-3 px-4 font-mono">
                              {String(log.entity_type)} #{String(log.entity_id)}
                            </td>
                            <td className="py-3 px-4 font-mono">{String(log.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'backups' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5 max-w-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-bold text-lg">Database Backups & Snapshots</h2>
                    <p className="text-xs text-slate-500">
                      Create consistent SQLite database snapshots stored securely on the server.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Create Snapshot
                  </button>
                </div>

                {data.backupFiles.length === 0 ? (
                  <p className="text-sm text-slate-500">No backup snapshots created yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {data.backupFiles.map((file) => (
                      <div key={file} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono">{file}</span>
                        <a
                          href={`/api/admin/backups/download/${encodeURIComponent(file)}`}
                          className="font-semibold text-purple-700 dark:text-amber-400 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ApprovalSection({
  title,
  icon: Icon,
  items,
  renderTitle,
  renderStatus,
  onApprove,
  onReject,
}: {
  title: string;
  icon: typeof Building2;
  items: Array<Record<string, unknown>>;
  renderTitle: (item: Record<string, unknown>) => string;
  renderStatus: (item: Record<string, unknown>) => string;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-purple-700 dark:text-amber-400" />
        <h3 className="font-display font-bold text-base text-slate-950 dark:text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-xs text-slate-500">
          No submissions in this queue.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
          {items.map((item) => {
            const id = Number(item.id);
            const status = renderStatus(item);
            return (
              <div key={id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">{renderTitle(item)}</div>
                  <div className="font-mono uppercase text-slate-500 mt-0.5">Status: {status}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onApprove(id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(id)}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 font-semibold cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
