import {
  ArrowLeft,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CreditCard,
  Flag,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Shield,
  ShoppingBag,
  UserCheck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import { COUNTRIES, PHONE_CODES, TIMEZONES } from '../lib/i18n.ts';
import { startPiPaymentFlow } from '../lib/pi.ts';
import type { AppView, DivisionTab, PlatformSettingsPublic, UserProfile } from '../types/platform.ts';

type MemberTab =
  | 'overview'
  | 'profile'
  | 'academy'
  | 'business'
  | 'freelance'
  | 'orders'
  | 'opportunities'
  | 'messages'
  | 'notifications'
  | 'transactions'
  | 'support';

interface MemberDashboardProps {
  user: UserProfile;
  settings: PlatformSettingsPublic | null;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onBackHome: () => void;
  onOpenDivision: (tab: DivisionTab) => void;
  onNavigateView: (view: AppView) => void;
}

interface DashboardData {
  enrolments: Array<{
    id: number;
    course_id: number;
    course_title: string;
    category: string;
    level: string;
    duration_hours: number;
    syllabus_json: string;
    completed_lessons_json: string;
    progress_percent: number;
    certificate_code: string | null;
    status: string;
    instructor_name: string;
  }>;
  instructorProfile: Record<string, unknown> | null;
  myCourses: Array<Record<string, unknown>>;
  businesses: Array<Record<string, unknown>>;
  myServices: Array<Record<string, unknown>>;
  projects: Array<{
    id: number;
    title: string;
    brief: string;
    budget_pi: number;
    status: string;
    client_user_id: number;
    freelancer_user_id: number;
    client_name: string;
    freelancer_name: string;
  }>;
  sellerProfile: Record<string, unknown> | null;
  myProducts: Array<Record<string, unknown>>;
  applications: Array<{
    id: number;
    opportunity_title: string;
    opportunity_type: string;
    organization_name: string;
    deadline: string;
    status: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: number;
    category: string;
    title: string;
    message: string;
    is_read: number;
    created_at: string;
  }>;
  messages: Array<{
    id: number;
    sender_user_id: number;
    recipient_user_id: number;
    sender_name: string;
    recipient_name: string;
    subject: string;
    body: string;
    is_reported: number;
    created_at: string;
  }>;
  subscriptions: Array<Record<string, unknown>>;
  disputes: Array<Record<string, unknown>>;
  orders: Array<{
    id: number;
    order_type: string;
    item_title: string;
    subtotal_pi: number;
    platform_fee_pi: number;
    total_pi: number;
    status: string;
    pi_payment_id: string | null;
    txid: string | null;
    environment: string | null;
    payment_status: string | null;
    created_at: string;
  }>;
}

export function MemberDashboard({
  user,
  settings,
  onUserUpdated,
  onLogout,
  onBackHome,
  onOpenDivision,
  onNavigateView,
}: MemberDashboardProps) {
  const [tab, setTab] = useState<MemberTab>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState(user.full_name);
  const [bio, setBio] = useState(user.bio || '');
  const [country, setCountry] = useState(user.country || 'Global');
  const [timezone, setTimezone] = useState(user.timezone || 'UTC');
  const [phoneCode, setPhoneCode] = useState(user.phone_country_code || '+1');
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number || '');

  // Support ticket form
  const [supportType, setSupportType] = useState<'support' | 'fraud' | 'order' | 'project'>('support');
  const [supportReason, setSupportReason] = useState('');
  const [supportDetails, setSupportDetails] = useState('');

  const isAdmin = user.roles.some((r) => ['super_admin', 'moderator', 'finance_admin'].includes(r));

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard/overview');
      setData(res);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load dashboard.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          bio,
          country,
          timezone,
          phoneCountryCode: phoneCode,
          phoneNumber,
        }),
      });
      onUserUpdated(res.user);
      setNotice({ type: 'ok', text: 'Profile preferences saved.' });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Could not update profile.' });
    }
  };

  const handleToggleLesson = async (courseId: number, currentCompleted: number[], lessonIdx: number) => {
    const next = currentCompleted.includes(lessonIdx)
      ? currentCompleted.filter((i) => i !== lessonIdx)
      : [...currentCompleted, lessonIdx];
    try {
      const res = await apiRequest<{ progressPercent: number; certificateCode: string | null }>(
        `/api/divisions/enrolments/${courseId}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ completedLessons: next }),
        }
      );
      if (res.certificateCode && res.progressPercent === 100) {
        setNotice({ type: 'ok', text: `Course completed! Certificate issued: ${res.certificateCode}` });
      }
      fetchOverview();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Could not update progress.' });
    }
  };

  const handleProjectAction = async (projectId: number, status: 'delivered' | 'completed' | 'disputed') => {
    try {
      await apiRequest(`/api/divisions/projects/${projectId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice({ type: 'ok', text: `Project updated to ${status}.` });
      fetchOverview();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Action failed.' });
    }
  };

  const handleMarkNotificationsRead = async () => {
    await apiRequest('/api/dashboard/notifications/mark-read', { method: 'POST' });
    fetchOverview();
  };

  const handleReportMessage = async (msgId: number) => {
    try {
      await apiRequest(`/api/divisions/messages/${msgId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Abusive or suspicious direct message reported by member' }),
      });
      setNotice({ type: 'ok', text: 'Message reported to Trust & Safety moderators.' });
      fetchOverview();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Report failed.' });
    }
  };

  const handleSubscribe = async (planSlug: 'pro_creator' | 'verified_business' | 'enterprise') => {
    try {
      const res = await startPiPaymentFlow({ orderType: 'subscription', referenceId: 0, planSlug });
      setNotice({ type: 'ok', text: res.message });
      fetchOverview();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Subscription checkout failed.' });
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/dashboard/support/disputes', {
        method: 'POST',
        body: JSON.stringify({
          targetType: supportType,
          reason: supportReason,
          details: supportDetails,
        }),
      });
      setSupportReason('');
      setSupportDetails('');
      setNotice({ type: 'ok', text: 'Support ticket / report logged for administrator review.' });
      fetchOverview();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Submission failed.' });
    }
  };

  const unreadCount = data?.notifications.filter((n) => n.is_read === 0).length ?? 0;

  const navItems: Array<{ id: MemberTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'Account Profile', icon: UserCheck },
    { id: 'academy', label: 'Academy Courses', icon: BookOpen },
    { id: 'business', label: 'Business Hub', icon: Building2 },
    { id: 'freelance', label: 'Freelance Projects', icon: Briefcase },
    { id: 'orders', label: 'Market & Orders', icon: ShoppingBag },
    { id: 'opportunities', label: 'Opportunities', icon: Shield },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'notifications', label: `Notifications (${unreadCount})`, icon: Bell },
    { id: 'transactions', label: 'Transactions & Plans', icon: CreditCard },
    { id: 'support', label: 'Support Centre', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigateView('admin')}
                className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Admin Console
              </button>
            )}
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
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="hidden lg:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer mt-6"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 sm:p-8 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Member Workspace / <span className="capitalize">{tab}</span>
            </p>
            <h1 className="text-2xl font-display font-bold text-slate-950 dark:text-white mt-0.5">
              Welcome, {user.full_name}
            </h1>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Roles: {user.roles.join(', ')} · {user.country} ({user.timezone})
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
          <div className="space-y-4">
            <div className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] animate-pulse" />
            <div className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] animate-pulse" />
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Course Enrolments', val: data.enrolments.length },
                    { label: 'Business Profiles', val: data.businesses.length },
                    { label: 'Freelance Projects', val: data.projects.length },
                    { label: 'Applications', val: data.applications.length },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5"
                    >
                      <div className="text-2xl font-mono font-bold tabular-nums text-slate-950 dark:text-white">
                        {s.val}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4">
                  <h2 className="font-display font-bold text-slate-950 dark:text-white">Quick Division Access</h2>
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        ['academy', 'IFIOK Academy'],
                        ['business', 'Business Hub'],
                        ['freelance', 'Freelance'],
                        ['opportunities', 'Opportunities'],
                        ['market', 'IFIOK Market'],
                        ['community', 'Community'],
                      ] as Array<[DivisionTab, string]>
                    ).map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onOpenDivision(d)}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <form
                onSubmit={handleSaveProfile}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4 max-w-2xl"
              >
                <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">Account Profile</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email / Pi Handle</label>
                    <input
                      type="text"
                      disabled
                      value={user.email || (user.pi_username ? `@${user.pi_username}` : '')}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-sm text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Country</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Time Zone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">International Phone Number</label>
                  <div className="flex gap-2">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-sm"
                    >
                      {PHONE_CODES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Save Profile
                </button>
              </form>
            )}

            {tab === 'academy' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    My Academy Enrolments
                  </h2>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy')}
                    className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Browse Courses
                  </button>
                </div>
                {data.enrolments.length === 0 ? (
                  <p className="text-sm text-slate-500">You have not enrolled in any courses yet.</p>
                ) : (
                  <div className="space-y-4">
                    {data.enrolments.map((enr) => {
                      const syllabus = JSON.parse(enr.syllabus_json || '[]') as string[];
                      const completed = JSON.parse(enr.completed_lessons_json || '[]') as number[];
                      return (
                        <div
                          key={enr.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-display font-bold text-slate-950 dark:text-white">
                                {enr.course_title}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {enr.category} · {enr.instructor_name} · Progress:{' '}
                                <span className="font-mono font-semibold">{enr.progress_percent}%</span>
                              </p>
                            </div>
                            {enr.certificate_code && enr.status === 'completed' && (
                              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Certificate: {enr.certificate_code}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                            {syllabus.map((lesson, idx) => (
                              <label key={lesson} className="flex items-center gap-2.5 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={completed.includes(idx)}
                                  onChange={() => handleToggleLesson(enr.course_id, completed, idx)}
                                />
                                <span>{lesson}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'business' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    My Business Profiles
                  </h2>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('business')}
                    className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Submit Business Profile
                  </button>
                </div>
                {data.businesses.length === 0 ? (
                  <p className="text-sm text-slate-500">No business profiles registered yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
                    {data.businesses.map((b) => (
                      <div key={String(b.id)} className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-sm">{String(b.business_name)}</div>
                          <div className="text-xs text-slate-500">
                            {String(b.sector)} · {String(b.country)}
                          </div>
                        </div>
                        <span className="font-mono text-xs uppercase text-slate-700 dark:text-amber-400">
                          {String(b.verification_status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'freelance' && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Freelance Projects & Services
                </h2>
                {data.projects.length === 0 ? (
                  <p className="text-sm text-slate-500">No active freelance projects yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.projects.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <div className="font-semibold text-slate-950 dark:text-white">{p.title}</div>
                          <div className="text-xs text-slate-500">
                            Client: {p.client_name} · Freelancer: {p.freelancer_name} ·{' '}
                            <span className="font-mono">{p.budget_pi} π</span> · Status:{' '}
                            <span className="font-mono uppercase">{p.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {user.id === p.freelancer_user_id && p.status === 'in_progress' && (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(p.id, 'delivered')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {user.id === p.client_user_id && p.status === 'delivered' && (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(p.id, 'completed')}
                              className="px-3 py-1.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                            >
                              Approve Completion
                            </button>
                          )}
                          {['in_progress', 'delivered'].includes(p.status) && (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(p.id, 'disputed')}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold cursor-pointer"
                            >
                              Open Dispute
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'orders' && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Marketplace Orders & Seller Storefront
                </h2>
                {data.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">No marketplace or platform orders yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Order</th>
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-4 text-right">Total (π)</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="py-3 px-4 font-mono">#{o.id}</td>
                            <td className="py-3 px-4">{o.item_title}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{o.total_pi} π</td>
                            <td className="py-3 px-4 font-mono uppercase">{o.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'opportunities' && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Submitted Applications
                </h2>
                {data.applications.length === 0 ? (
                  <p className="text-sm text-slate-500">No applications submitted yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
                    {data.applications.map((a) => (
                      <div key={a.id} className="p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-sm">{a.opportunity_title}</div>
                          <div className="text-xs text-slate-500 capitalize">
                            {a.opportunity_type} · {a.organization_name} · Deadline {a.deadline}
                          </div>
                        </div>
                        <span className="font-mono text-xs uppercase">{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'messages' && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">Direct Messages</h2>
                {data.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">No direct messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.messages.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            From <strong>{m.sender_name}</strong> to <strong>{m.recipient_name}</strong>
                          </span>
                          {m.recipient_user_id === user.id && !m.is_reported && (
                            <button
                              type="button"
                              onClick={() => handleReportMessage(m.id)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:underline cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              <span>Report Abuse</span>
                            </button>
                          )}
                        </div>
                        <div className="font-semibold text-sm">{m.subject}</div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{m.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'notifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkNotificationsRead}
                      className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
                  {data.notifications.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">No notifications.</div>
                  ) : (
                    data.notifications.map((n) => (
                      <div key={n.id} className="p-4 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="capitalize">{n.category}</span>
                          <span className="font-mono">{n.is_read ? 'Read' : 'Unread'}</span>
                        </div>
                        <div className="font-semibold text-sm">{n.title}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'transactions' && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white mb-3">
                    Membership Subscriptions (Pi Testnet Settlement)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        slug: 'pro_creator' as const,
                        name: 'Pro Creator & Freelancer',
                        price: settings?.subscriptionProPi ?? 12,
                        desc: 'Priority directory indexing, instructor curriculum analytics, and creator verification.',
                      },
                      {
                        slug: 'verified_business' as const,
                        name: 'Verified Business Hub',
                        price: settings?.subscriptionBusinessPi ?? 35,
                        desc: 'Featured SME placement, corporate advisory access, and partner opportunity slots.',
                      },
                      {
                        slug: 'enterprise' as const,
                        name: 'Global Organisation',
                        price: settings?.subscriptionEnterprisePi ?? 90,
                        desc: 'Dedicated recruitment channels, institutional training seats, and priority dispute care.',
                      },
                    ].map((plan) => (
                      <div
                        key={plan.slug}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="font-display font-bold text-slate-950 dark:text-white">{plan.name}</div>
                          <div className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                            {plan.price} π / month
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{plan.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSubscribe(plan.slug)}
                          className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                        >
                          Subscribe with Pi
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white mb-3">
                    Pi Payment Transaction Ledger
                  </h2>
                  {data.orders.length === 0 ? (
                    <p className="text-sm text-slate-500">No payment transactions recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <tr>
                            <th className="py-3 px-4">Order</th>
                            <th className="py-3 px-4">Item</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                            <th className="py-3 px-4">Environment</th>
                            <th className="py-3 px-4">TXID</th>
                            <th className="py-3 px-4">Payment State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {data.orders.map((o) => (
                            <tr key={o.id}>
                              <td className="py-3 px-4 font-mono">#{o.id}</td>
                              <td className="py-3 px-4">{o.item_title}</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">{o.total_pi} π</td>
                              <td className="py-3 px-4 font-mono uppercase">{o.environment || 'testnet'}</td>
                              <td className="py-3 px-4 font-mono">{o.txid ? `${o.txid.slice(0, 12)}...` : '—'}</td>
                              <td className="py-3 px-4 font-mono uppercase">{o.payment_status || o.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'support' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form
                  onSubmit={handleSupportSubmit}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4"
                >
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    Support Centre & Fraud Reporting
                  </h2>
                  <div>
                    <label className="block text-xs font-medium mb-1">Case Type</label>
                    <select
                      value={supportType}
                      onChange={(e) => setSupportType(e.target.value as typeof supportType)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      <option value="support">General Support Inquiry</option>
                      <option value="order">Marketplace Order / Refund Request</option>
                      <option value="project">Freelance Project Dispute</option>
                      <option value="fraud">Fraud or Security Report</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={supportReason}
                      onChange={(e) => setSupportReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Details</label>
                    <textarea
                      rows={4}
                      required
                      minLength={15}
                      value={supportDetails}
                      onChange={(e) => setSupportDetails(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    Submit Case
                  </button>
                </form>

                <div className="space-y-3">
                  <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">My Support Cases</h2>
                  {data.disputes.length === 0 ? (
                    <p className="text-sm text-slate-500">No open support tickets or disputes.</p>
                  ) : (
                    data.disputes.map((d) => (
                      <div
                        key={String(d.id)}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="uppercase font-mono">{String(d.target_type)}</span>
                          <span className="uppercase font-mono">{String(d.status)}</span>
                        </div>
                        <div className="font-semibold text-sm">{String(d.reason)}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{String(d.details)}</p>
                        {Boolean(d.resolution_notes) && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            Resolution: {String(d.resolution_notes)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
