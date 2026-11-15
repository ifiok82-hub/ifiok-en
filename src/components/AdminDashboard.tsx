import {
  Activity,
  ArrowLeft,
  BookOpen,
  Bot,
  Building2,
  Database,
  FileWarning,
  Lock,
  PlusCircle,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import type { AiProviderStatus, AppView, UserProfile } from '../types/platform.ts';
import { BrandLogo } from './BrandLogo.tsx';

type AdminTab =
  | 'analytics'
  | 'members'
  | 'approvals'
  | 'ai'
  | 'publisher'
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
    pendingSchools?: number;
    openSafetyReports?: number;
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
  schools?: Array<Record<string, unknown>>;
  communityPosts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  disputes: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  securityEvents: Array<Record<string, unknown>>;
  securityAlerts: Array<Record<string, unknown>>;
  backupFiles: string[];
}

export function AdminDashboard({ user, onNavigateView, onRefreshSummary }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  // Verified Publisher form state
  const [pubType, setPubType] = useState<'product' | 'course' | 'business' | 'opportunity'>('product');
  const [pubTitle, setPubTitle] = useState('');
  const [pubCategory, setPubCategory] = useState('Electronics & Tech');
  const [pubSubType, setPubSubType] = useState('digital');
  const [pubPricePi, setPubPricePi] = useState('5');
  const [pubStock, setPubStock] = useState('10');
  const [pubDescription, setPubDescription] = useState('');
  const [pubSourceOrigin, setPubSourceOrigin] = useState('Authorized Supplier Feed');
  const [pubSourceUrl, setPubSourceUrl] = useState('');
  const [pubImageUrl, setPubImageUrl] = useState('');
  const [pubLockedPayload, setPubLockedPayload] = useState('');
  const [pubExtraOrg, setPubExtraOrg] = useState('');
  const [pubDeadline, setPubDeadline] = useState('2026-12-31');
  const [uploadingPubImg, setUploadingPubImg] = useState(false);

  // AI Governance & Monitoring state
  const [aiMonitor, setAiMonitor] = useState<{
    status: AiProviderStatus;
    config: {
      provider: 'gemini' | 'openai_compatible';
      model: string;
      dailyUserLimit: number;
      monthlyCostCapUsd: number;
      childSafetyMode: 'strict' | 'standard';
    };
    summary: Record<string, number>;
    recentLogs: Array<Record<string, unknown>>;
    safetyReports: Array<Record<string, unknown>>;
  } | null>(null);
  const [testingAi, setTestingAi] = useState(false);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [res, aiRes] = await Promise.all([
        apiRequest<AdminOverviewData>('/api/admin/overview'),
        apiRequest<{
          status: AiProviderStatus;
          config: {
            provider: 'gemini' | 'openai_compatible';
            model: string;
            dailyUserLimit: number;
            monthlyCostCapUsd: number;
            childSafetyMode: 'strict' | 'standard';
          };
          summary: Record<string, number>;
          recentLogs: Array<Record<string, unknown>>;
          safetyReports: Array<Record<string, unknown>>;
        }>('/api/academy/ai/admin/monitoring').catch(() => null),
      ]);
      setData(res);
      setSettingsForm(res.settings);
      if (aiRes) setAiMonitor(aiRes);
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

  const handleUploadPubImage = async (file: File) => {
    setUploadingPubImg(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ url: string }>('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ dataBase64: base64 }),
      });
      setPubImageUrl(res.url);
      setNotice({ type: 'ok', text: 'Verified image scanned and uploaded.' });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Image upload rejected.' });
    } finally {
      setUploadingPubImg(false);
    }
  };

  const handlePublishVerified = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      entityType: pubType,
      sourceOrigin: pubSourceOrigin,
      sourceUrl: pubSourceUrl,
      availabilityStatus: 'available',
      imageUrl: pubImageUrl,
    };
    if (pubType === 'product') {
      Object.assign(payload, {
        title: pubTitle,
        category: pubCategory,
        productType: pubSubType,
        pricePi: Number(pubPricePi),
        stockQty: Number(pubStock) || 1,
        description: pubDescription,
        lockedContent: pubLockedPayload,
      });
    } else if (pubType === 'course') {
      Object.assign(payload, {
        title: pubTitle,
        category: pubCategory,
        level: pubSubType || 'Intermediate',
        durationHours: Number(pubStock) || 8,
        pricePi: Number(pubPricePi) || 0,
        description: pubDescription,
        lockedMaterials: pubLockedPayload,
      });
    } else if (pubType === 'business') {
      Object.assign(payload, {
        businessName: pubTitle,
        sector: pubCategory,
        country: pubExtraOrg || 'Global',
        website: pubSourceUrl,
        summary: pubDescription,
        servicesOffered: pubSubType,
      });
    } else {
      Object.assign(payload, {
        title: pubTitle,
        opportunityType: pubSubType || 'job',
        organizationName: pubExtraOrg,
        location: pubCategory || 'Global / Remote',
        deadline: pubDeadline,
        description: pubDescription,
      });
    }

    await mutate('/api/admin/import-verified', 'POST', payload, `Verified ${pubType} published with provenance timestamp.`);
    setPubTitle('');
    setPubDescription('');
    setPubLockedPayload('');
    setPubImageUrl('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate('/api/admin/settings', 'PATCH', { settings: settingsForm }, 'Platform settings & content saved.');
  };

  const handleCreateBackup = async () => {
    await mutate('/api/admin/backups/snapshot', 'POST', undefined, 'Database snapshot backup created.');
  };

  const handleTestAiProvider = async () => {
    setTestingAi(true);
    try {
      const res = await apiRequest<{ result: { ok: boolean; message: string; latencyMs: number } }>(
        '/api/academy/ai/admin/test',
        { method: 'POST' }
      );
      setNotice({ type: 'ok', text: `${res.result.message} (${res.result.latencyMs}ms)` });
      await loadAdmin();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'AI provider live test failed.' });
      await loadAdmin();
    } finally {
      setTestingAi(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof Activity }> = [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'members', label: 'Members & Roles', icon: Users },
    { id: 'approvals', label: 'Verifications & Approvals', icon: Building2 },
    { id: 'ai', label: 'AI Governance & Safety', icon: Bot },
    { id: 'publisher', label: 'Verified Publisher', icon: PlusCircle },
    { id: 'moderation', label: 'Community & Disputes', icon: FileWarning },
    { id: 'finance', label: 'Transactions & Subs', icon: ShoppingBag },
    { id: 'settings', label: 'Content & Commissions', icon: Settings },
    { id: 'security', label: 'Security & Alerts', icon: ShieldAlert },
    { id: 'backups', label: 'Database Backups', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] p-4 space-y-4">
        <div className="px-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <BrandLogo size="sm" />
        </div>
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
                  title="IFIOK SCHOOL Courses Queue"
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
                  title="Global Schools & Institutions Verification Queue"
                  icon={Building2}
                  items={data.schools || []}
                  renderTitle={(s) => `${String(s.name)} — ${String(s.school_type)} (${String(s.country)})`}
                  renderStatus={(s) => String(s.verification_status)}
                  onApprove={(id) => mutate(`/api/admin/schools/${id}`, 'PATCH', { verificationStatus: 'verified' })}
                  onReject={(id) => mutate(`/api/admin/schools/${id}`, 'PATCH', { verificationStatus: 'rejected' })}
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

            {tab === 'ai' && (
              <div className="space-y-6">
                {!aiMonitor ? (
                  <p className="text-sm text-slate-500">AI governance telemetry unavailable.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Provider Status', val: aiMonitor.status.operational ? 'OPERATIONAL' : aiMonitor.status.lastTestedStatus.toUpperCase() },
                        { label: 'Total AI Calls', val: aiMonitor.summary.totalCalls ?? 0 },
                        { label: 'Safety Blocks', val: aiMonitor.summary.safetyBlocks ?? 0 },
                        { label: 'Est. Monthly Cost', val: `$${Number(aiMonitor.status.monthlyEstimatedCostUsd || 0).toFixed(4)}` },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4">
                          <div className="font-mono font-bold text-lg text-slate-950 dark:text-white">{stat.val}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4 max-w-3xl">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                            IFIOK Professor AI Provider Governance
                          </h2>
                          <p className="text-xs text-slate-500">
                            Credentials are managed exclusively via server environment variables (GEMINI_API_KEY / OPENAI_COMPAT_API_KEY). Switch models, set daily student rate limits, enforce monthly cost caps, and run live server connectivity checks below.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={testingAi}
                          onClick={handleTestAiProvider}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {testingAi ? 'Testing Connection...' : 'Test Live Provider'}
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          mutate('/api/academy/ai/admin/config', 'PATCH', aiMonitor.config, 'AI Governance settings updated.');
                        }}
                        className="space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">Active Provider Adapter</label>
                            <select
                              value={aiMonitor.config.provider}
                              onChange={(e) =>
                                setAiMonitor((p) =>
                                  p ? { ...p, config: { ...p.config, provider: e.target.value as 'gemini' | 'openai_compatible' } } : p
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                            >
                              {aiMonitor.status.availableProviders.map((prov) => (
                                <option key={prov.id} value={prov.id}>
                                  {prov.label} ({prov.configured ? 'Server Env Ready' : 'Env Key Missing'})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Model Identifier</label>
                            <input
                              type="text"
                              required
                              value={aiMonitor.config.model}
                              onChange={(e) =>
                                setAiMonitor((p) => (p ? { ...p, config: { ...p.config, model: e.target.value } } : p))
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Daily Student Rate Limit (Prompts/Day)</label>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={aiMonitor.config.dailyUserLimit}
                              onChange={(e) =>
                                setAiMonitor((p) =>
                                  p ? { ...p, config: { ...p.config, dailyUserLimit: Number(e.target.value) } } : p
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Monthly Cost Cap (USD)</label>
                            <input
                              type="number"
                              min={1}
                              max={5000}
                              value={aiMonitor.config.monthlyCostCapUsd}
                              onChange={(e) =>
                                setAiMonitor((p) =>
                                  p ? { ...p, config: { ...p.config, monthlyCostCapUsd: Number(e.target.value) } } : p
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Child Protection & Safety Filter Mode</label>
                          <select
                            value={aiMonitor.config.childSafetyMode}
                            onChange={(e) =>
                              setAiMonitor((p) =>
                                p
                                  ? { ...p, config: { ...p.config, childSafetyMode: e.target.value as 'strict' | 'standard' } }
                                  : p
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                          >
                            <option value="strict">Strict Child-Safe Filtering (Recommended)</option>
                            <option value="standard">Standard Educational Filtering</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                        >
                          Save AI Governance Policy
                        </button>
                      </form>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-base">Student Safety & AI Reports</h3>
                      {aiMonitor.safetyReports.length === 0 ? (
                        <p className="text-xs text-slate-500">No child safety or AI reports filed.</p>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
                          {aiMonitor.safetyReports.map((rep) => (
                            <div key={String(rep.id)} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div>
                                <div className="font-semibold text-sm">{String(rep.reason)}</div>
                                <div className="text-slate-500">
                                  Reporter: {String(rep.reporter_name)} · Context: {String(rep.context_type)} · Status: {String(rep.status)}
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 mt-1">{String(rep.details)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  mutate(`/api/academy/ai/admin/safety-reports/${rep.id}`, 'PATCH', { status: 'resolved' })
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'publisher' && (
              <form
                onSubmit={handlePublishVerified}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4 max-w-3xl"
              >
                <div>
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    Verified Inventory & Authorized Feed Publisher
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Publish only genuine owned inventory, authorized supplier feeds, confirmed institutional opportunities, or accredited curricula with recorded source provenance.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Catalog Type</label>
                    <select
                      value={pubType}
                      onChange={(e) => {
                        const next = e.target.value as typeof pubType;
                        setPubType(next);
                        if (next === 'product') {
                          setPubCategory('Electronics & Tech');
                          setPubSubType('digital');
                        } else if (next === 'course') {
                          setPubCategory('Web3 & Blockchain');
                          setPubSubType('Intermediate');
                        } else if (next === 'business') {
                          setPubCategory('Technology & Consulting');
                          setPubSubType('Enterprise Services');
                        } else {
                          setPubCategory('Global / Remote');
                          setPubSubType('job');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      <option value="product">IFIOK Market Product</option>
                      <option value="course">IFIOK SCHOOL Course</option>
                      <option value="business">Verified Business Hub SME</option>
                      <option value="opportunity">Confirmed Opportunity / Grant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Source Origin (Mandatory Provenance)</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={pubSourceOrigin}
                      onChange={(e) => setPubSourceOrigin(e.target.value)}
                      placeholder="IFIOK-EN Inventory / Authorized Supplier"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {pubType === 'business' ? 'Registered Business Name' : 'Listing Title'}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={pubTitle}
                      onChange={(e) => setPubTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {pubType === 'business'
                        ? 'Sector'
                        : pubType === 'opportunity'
                          ? 'Location'
                          : 'Category'}
                    </label>
                    <input
                      type="text"
                      required
                      value={pubCategory}
                      onChange={(e) => setPubCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {pubType === 'product'
                        ? 'Product Type'
                        : pubType === 'course'
                          ? 'Level'
                          : pubType === 'opportunity'
                            ? 'Opportunity Type'
                            : 'Services Offered'}
                    </label>
                    {pubType === 'product' ? (
                      <select
                        value={pubSubType}
                        onChange={(e) => setPubSubType(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="digital">Digital Product</option>
                        <option value="physical">Physical Product</option>
                        <option value="service">Digital Service</option>
                        <option value="web3">Web3 Product</option>
                        <option value="pi_app">Verified Pi App</option>
                        <option value="gaming_asset">Gaming Asset</option>
                      </select>
                    ) : pubType === 'opportunity' ? (
                      <select
                        value={pubSubType}
                        onChange={(e) => setPubSubType(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="job">Job</option>
                        <option value="internship">Internship</option>
                        <option value="scholarship">Scholarship</option>
                        <option value="grant">Grant</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={pubSubType}
                        onChange={(e) => setPubSubType(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    )}
                  </div>

                  {(pubType === 'product' || pubType === 'course') && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">Pi Price (π)</label>
                        <input
                          type="number"
                          min={pubType === 'course' ? 0 : 0.1}
                          step="0.1"
                          value={pubPricePi}
                          onChange={(e) => setPubPricePi(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          {pubType === 'product' ? 'Verified Stock Qty' : 'Duration (Hours)'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pubStock}
                          onChange={(e) => setPubStock(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </>
                  )}

                  {(pubType === 'business' || pubType === 'opportunity') && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          {pubType === 'business' ? 'Country' : 'Issuing Organization'}
                        </label>
                        <input
                          type="text"
                          required
                          value={pubExtraOrg}
                          onChange={(e) => setPubExtraOrg(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                        />
                      </div>
                      {pubType === 'opportunity' && (
                        <div>
                          <label className="block text-xs font-medium mb-1">Deadline</label>
                          <input
                            type="date"
                            required
                            value={pubDeadline}
                            onChange={(e) => setPubDeadline(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Source Reference URL (Optional)</label>
                  <input
                    type="url"
                    value={pubSourceUrl}
                    onChange={(e) => setPubSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>

                {(pubType === 'product' || pubType === 'course') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Verified Image Upload (PNG/JPEG/WEBP, scanned server-side)
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadPubImage(f);
                          }}
                          className="text-xs"
                        />
                        {uploadingPubImg && <span className="text-xs text-slate-500">Scanning...</span>}
                        {pubImageUrl && <span className="font-mono text-xs text-emerald-600">{pubImageUrl}</span>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Locked Digital Content / Course Materials (AES-256 encrypted, unlocked ONLY after Pi completion)
                      </label>
                      <textarea
                        rows={3}
                        value={pubLockedPayload}
                        onChange={(e) => setPubLockedPayload(e.target.value)}
                        placeholder="Download URLs, license instructions, or protected curriculum syllabus..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1">Verified Description / Summary</label>
                  <textarea
                    rows={4}
                    required
                    minLength={15}
                    value={pubDescription}
                    onChange={(e) => setPubDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Publish Verified Entry
                </button>
              </form>
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
                  <h2 className="font-display font-bold text-lg mb-3">Automated Security & Fraud Alerts</h2>
                  {data.securityAlerts.length === 0 ? (
                    <p className="text-sm text-slate-500">No security alerts active.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.securityAlerts.map((al) => (
                        <div
                          key={String(al.id)}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1 max-w-2xl">
                            <div className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
                              {String(al.severity)} · {String(al.alert_type)} · Status: {String(al.status)}
                            </div>
                            <p className="text-sm text-slate-800 dark:text-slate-200">{String(al.summary)}</p>
                            <div className="text-[11px] font-mono text-slate-500">{String(al.created_at)}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => mutate(`/api/admin/security-alerts/${al.id}`, 'PATCH', { status: 'acknowledged' })}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Acknowledge
                            </button>
                            <button
                              type="button"
                              onClick={() => mutate(`/api/admin/security-alerts/${al.id}`, 'PATCH', { status: 'resolved' })}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
