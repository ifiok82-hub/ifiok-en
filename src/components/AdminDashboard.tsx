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
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from '../lib/api.ts';
import {
  ACADEMIC_SUBJECTS,
  BUSINESS_HUB_CATEGORIES,
  DELIVERY_METHODS,
  LANGUAGE_OPTIONS,
  MARKET_SUITES,
  OPPORTUNITY_TYPES,
} from '../lib/i18n.ts';
import type {
  AiProviderStatus,
  AppView,
  CopyrightReport,
  SupplierIntegration,
  TeacherSubmission,
  TeacherSubmissionStatus,
  UserProfile,
} from '../types/platform.ts';
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
    pendingTeacherSubmissions?: number;
    openCopyrightReports?: number;
    openSafetyReports?: number;
    openDisputes: number;
    completedPaymentsCount: number;
    completedVolumePi: number;
    totalCommissionPi: number;
    totalDigitalDownloads?: number;
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
  teacherSubmissions?: TeacherSubmission[];
  copyrightReports?: CopyrightReport[];
  communityPosts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  piTestnetPayments: Array<Record<string, unknown>>;
  entitlements: Array<Record<string, unknown>>;
  digitalDownloads?: Array<Record<string, unknown>>;
  supplierIntegrations: SupplierIntegration[];
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
  const [pubCategory, setPubCategory] = useState('Licensed Software');
  const [pubMarketSuite, setPubMarketSuite] = useState('software_productivity');
  const [pubDeliveryMethod, setPubDeliveryMethod] = useState('instant_digital_download');
  const [pubDistPermission, setPubDistPermission] = useState('');
  const [pubRefundTerms, setPubRefundTerms] = useState('');
  const [pubHubCategory, setPubHubCategory] = useState('Verified SMEs');
  const [pubEligibility, setPubEligibility] = useState('');
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
  const [pubProductVersion, setPubProductVersion] = useState('1.0.0');
  const [pubFileMeta, setPubFileMeta] = useState<{
    storageKey: string;
    originalName: string;
    fileFormat: string;
    fileSizeBytes: number;
    fileSha256: string;
  } | null>(null);
  const [uploadingPubFile, setUploadingPubFile] = useState(false);
  const [batchJsonText, setBatchJsonText] = useState('');
  const [batchImporting, setBatchImporting] = useState(false);

  // Course 22-point Verified Publisher fields
  const [pubLanguageCode, setPubLanguageCode] = useState('en');
  const [pubObjectivesText, setPubObjectivesText] = useState('');
  const [pubModulesText, setPubModulesText] = useState('');
  const [pubSlidesText, setPubSlidesText] = useState('');
  const [pubWorkbooksText, setPubWorkbooksText] = useState('');
  const [pubAssignmentsText, setPubAssignmentsText] = useState('');
  const [pubQuizzesText, setPubQuizzesText] = useState('');
  const [pubExamQuestionsText, setPubExamQuestionsText] = useState('');
  const [pubAnswerKeysText, setPubAnswerKeysText] = useState('');
  const [pubExamGuide, setPubExamGuide] = useState('');
  const [pubMediaUrl, setPubMediaUrl] = useState('');
  const [pubInstructorQual, setPubInstructorQual] = useState('');
  const [pubPrerequisites, setPubPrerequisites] = useState('');
  const [pubTargetAudience, setPubTargetAudience] = useState('');
  const [pubCopyright, setPubCopyright] = useState('');
  const [pubCertificateCriteria, setPubCertificateCriteria] = useState('');
  const [pubCourseFiles, setPubCourseFiles] = useState<
    Array<{ storageKey: string; originalName: string; fileFormat: string; fileSizeBytes: number; fileSha256: string }>
  >([]);
  const [uploadingPubCourseFile, setUploadingPubCourseFile] = useState(false);

  // Authorized Supplier Integrations state
  const [supName, setSupName] = useState('');
  const [supSuite, setSupSuite] = useState('software_productivity');
  const [supType, setSupType] = useState<'authorized_api' | 'json_feed' | 'partner_portal'>('json_feed');
  const [supFeedUrl, setSupFeedUrl] = useState('');
  const [supLicense, setSupLicense] = useState('');
  const [supAuthHeader, setSupAuthHeader] = useState('');
  const [syncingSupId, setSyncingSupId] = useState<number | null>(null);

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

  const handleUploadPubProductFile = async (file: File) => {
    setUploadingPubFile(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read digital asset file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{
        storageKey: string;
        originalName: string;
        fileFormat: string;
        fileSizeBytes: number;
        sha256: string;
      }>('/api/uploads/digital-asset', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataBase64: base64 }),
      });
      setPubFileMeta({
        storageKey: res.storageKey,
        originalName: res.originalName,
        fileFormat: res.fileFormat,
        fileSizeBytes: res.fileSizeBytes,
        fileSha256: res.sha256,
      });
      setNotice({ type: 'ok', text: `Private vault asset "${res.originalName}" scanned clean.` });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Digital asset upload rejected.' });
    } finally {
      setUploadingPubFile(false);
    }
  };

  const handleUploadPubCourseFile = async (file: File) => {
    setUploadingPubCourseFile(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read course material file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{
        storageKey: string;
        originalName: string;
        fileFormat: string;
        fileSizeBytes: number;
        sha256: string;
      }>('/api/uploads/course-material', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataBase64: base64 }),
      });
      setPubCourseFiles((prev) => [
        ...prev,
        {
          storageKey: res.storageKey,
          originalName: res.originalName,
          fileFormat: res.fileFormat,
          fileSizeBytes: res.fileSizeBytes,
          fileSha256: res.sha256,
        },
      ]);
      setNotice({ type: 'ok', text: `Course material "${res.originalName}" encrypted & attached.` });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Course material upload rejected.' });
    } finally {
      setUploadingPubCourseFile(false);
    }
  };

  const handleImportBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchImporting(true);
    try {
      const parsed = JSON.parse(batchJsonText);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      const res = await apiRequest<{ imported: number; skipped: Array<{ index: number; reason: string }> }>(
        '/api/admin/import-verified-batch',
        {
          method: 'POST',
          body: JSON.stringify({ items }),
        }
      );
      setNotice({
        type: 'ok',
        text: `Batch imported ${res.imported} verified IFIOK DIGITAL item(s)${res.skipped.length ? ` (${res.skipped.length} skipped)` : ''}.`,
      });
      if (res.imported > 0) setBatchJsonText('');
      await loadAdmin();
      onRefreshSummary();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Invalid batch JSON or import rejected.' });
    } finally {
      setBatchImporting(false);
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
        marketSuite: pubMarketSuite,
        productType: pubSubType,
        pricePi: Number(pubPricePi),
        stockQty: Number(pubStock) || 1,
        deliveryMethod: pubDeliveryMethod,
        distributionPermission: pubDistPermission,
        refundSupportTerms: pubRefundTerms,
        version: pubProductVersion || '1.0.0',
        fileStorageKey: pubFileMeta?.storageKey || '',
        fileOriginalName: pubFileMeta?.originalName || '',
        fileFormat: pubFileMeta?.fileFormat || '',
        fileSizeBytes: pubFileMeta?.fileSizeBytes || 0,
        fileSha256: pubFileMeta?.fileSha256 || '',
        description: pubDescription,
        lockedContent: pubLockedPayload,
      });
    } else if (pubType === 'course') {
      const moduleLines = pubModulesText.split('\n').map((s) => s.trim()).filter(Boolean);
      const parsedModules = moduleLines.map((line) => {
        const [topic, ...rest] = line.split('|');
        return { topic: (topic || line).trim(), notes: rest.join('|').trim() || (topic || line).trim() };
      });
      Object.assign(payload, {
        title: pubTitle,
        category: pubCategory,
        subject: pubCategory,
        languageCode: pubLanguageCode,
        level: pubSubType || 'Intermediate',
        durationHours: Number(pubStock) || 8,
        pricePi: Number(pubPricePi) || 0,
        description: pubDescription,
        syllabus: parsedModules.map((m) => m.topic),
        learningObjectives: pubObjectivesText.split('\n').map((s) => s.trim()).filter(Boolean),
        modulesNotes: parsedModules,
        slidesResources: pubSlidesText.split('\n').map((s) => s.trim()).filter(Boolean),
        workbooksExercises: pubWorkbooksText.split('\n').map((s) => s.trim()).filter(Boolean),
        assignments: pubAssignmentsText.split('\n').map((s) => s.trim()).filter(Boolean),
        quizzes: pubQuizzesText.split('\n').map((s) => s.trim()).filter(Boolean),
        examQuestions: pubExamQuestionsText.split('\n').map((s) => s.trim()).filter(Boolean),
        answerKeysText: pubAnswerKeysText,
        examMarkingGuide: pubExamGuide,
        mediaLessonUrl: pubMediaUrl,
        instructorQualifications: pubInstructorQual,
        prerequisites: pubPrerequisites,
        targetAudience: pubTargetAudience,
        copyrightPermission: pubCopyright,
        certificateCriteria: pubCertificateCriteria,
        courseFiles: pubCourseFiles,
        lockedMaterials: pubLockedPayload,
      });
    } else if (pubType === 'business') {
      Object.assign(payload, {
        businessName: pubTitle,
        sector: pubCategory,
        hubCategory: pubHubCategory,
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
        eligibility: pubEligibility,
        description: pubDescription,
      });
    }

    try {
      await apiRequest('/api/admin/import-verified', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNotice({ type: 'ok', text: `Verified ${pubType} published with provenance timestamp.` });
      await loadAdmin();
      onRefreshSummary();
      setPubTitle('');
      setPubDescription('');
      setPubLockedPayload('');
      setPubImageUrl('');
      setPubDistPermission('');
      setPubRefundTerms('');
      setPubEligibility('');
      setPubFileMeta(null);
      setPubCourseFiles([]);
      setPubWorkbooksText('');
      setPubExamQuestionsText('');
      setPubAnswerKeysText('');
      setPubTargetAudience('');
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Verified import rejected.' });
    }
  };

  const handleAddSupplierIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/supplier-integrations', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: supName,
          categorySuite: supSuite,
          integrationType: supType,
          feedUrl: supFeedUrl,
          distributionLicense: supLicense,
          authHeaderName: supAuthHeader,
        }),
      });
      setNotice({ type: 'ok', text: 'Authorized supplier integration registered.' });
      setSupName('');
      setSupFeedUrl('');
      setSupLicense('');
      setSupAuthHeader('');
      await loadAdmin();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Could not register supplier.' });
    }
  };

  const handleSyncSupplier = async (id: number) => {
    setSyncingSupId(id);
    try {
      const res = await apiRequest<{ imported: number; message?: string }>(`/api/admin/supplier-integrations/${id}/sync`, {
        method: 'POST',
      });
      setNotice({ type: 'ok', text: res.message || `Synced ${res.imported} verified items from supplier feed.` });
      await loadAdmin();
      onRefreshSummary();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Supplier feed sync failed.' });
      await loadAdmin();
    } finally {
      setSyncingSupId(null);
    }
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
                  { label: 'Pending Teacher Submissions', val: data.analytics.pendingTeacherSubmissions ?? 0 },
                  { label: 'Pending Market Products', val: data.analytics.pendingProducts },
                  { label: 'Pending Opportunities', val: data.analytics.pendingOpportunities },
                  { label: 'Open Copyright / IP Reports', val: data.analytics.openCopyrightReports ?? 0 },
                  { label: 'Open Disputes', val: data.analytics.openDisputes },
                  { label: 'Completed Pi Payments', val: data.analytics.completedPaymentsCount },
                  { label: 'Verified Pi Volume', val: `${data.analytics.completedVolumePi.toFixed(2)} π` },
                  { label: 'Platform Commissions', val: `${data.analytics.totalCommissionPi.toFixed(2)} π` },
                  { label: 'Verified Digital Downloads', val: data.analytics.totalDigitalDownloads ?? 0 },
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
                  renderTitle={(b) =>
                    `${String(b.business_name)} (${String(b.hub_category || b.sector)} · ${String(b.country)})`
                  }
                  renderStatus={(b) => String(b.verification_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/businesses/${id}`, 'PATCH', {
                      moderationAction: action,
                      isFeatured: action === 'approve',
                      reviewNotes,
                    })
                  }
                />

                {/* Instructors & Courses */}
                <ApprovalSection
                  title="Instructors Approval Queue"
                  icon={BookOpen}
                  items={data.instructors}
                  renderTitle={(i) => `${String(i.full_name)} — ${String(i.headline)}`}
                  renderStatus={(i) => String(i.approval_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/instructors/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                <ApprovalSection
                  title="IFIOK SCHOOL Courses Queue (22-Point Paid Curriculum Gate)"
                  icon={BookOpen}
                  items={data.courses}
                  renderTitle={(c) => `${String(c.title)} — ${String(c.price_pi)} π (${String(c.instructor_name)})`}
                  renderStatus={(c) => String(c.approval_status)}
                  canApprove={(c) => !(Number(c.price_pi) > 0 && c.completeness_complete === false)}
                  renderExtra={(c) => {
                    const score = Number(c.completeness_score ?? 0);
                    const total = Number(c.completeness_total ?? 22);
                    const missing = Array.isArray(c.completeness_missing) ? (c.completeness_missing as string[]) : [];
                    const blocked = Number(c.price_pi) > 0 && c.completeness_complete === false;
                    return (
                      <div className="mt-1 space-y-1">
                        <div className={`font-mono text-[11px] tabular-nums ${blocked ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          Curriculum Completeness: {score}/{total} {blocked ? `(Approval Blocked until ${total}/${total})` : '(Complete)'}
                        </div>
                        {missing.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            Missing: {missing.slice(0, 4).join('; ')}
                            {missing.length > 4 ? ` (+${missing.length - 4} more)` : ''}
                          </div>
                        )}
                      </div>
                    );
                  }}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/courses/${id}`, 'PATCH', {
                      moderationAction: action,
                      isFeatured: action === 'approve',
                      reviewNotes,
                    })
                  }
                />

                {/* Sellers & Products */}
                <ApprovalSection
                  title="Marketplace Sellers Queue"
                  icon={ShoppingBag}
                  items={data.sellers}
                  renderTitle={(s) => `${String(s.store_name)} — ${String(s.full_name)} (${String(s.country)})`}
                  renderStatus={(s) => String(s.verification_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/sellers/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                <ApprovalSection
                  title="Market & IFIOK DIGITAL Listings Queue (9-State Lifecycle)"
                  icon={ShoppingBag}
                  items={data.products}
                  renderTitle={(p) =>
                    `${String(p.title)} — ${String(p.price_pi)} π (${String(p.store_name)} · Suite: ${String(p.market_suite || p.category)})`
                  }
                  renderStatus={(p) => `${String(p.lifecycle_status || p.approval_status)} (${String(p.approval_status)})`}
                  renderExtra={(p) => {
                    const id = Number(p.id);
                    const avail = String(p.availability_status || 'available');
                    const lifecycle = String(p.lifecycle_status || 'submitted');
                    return (
                      <div className="mt-1.5 space-y-2 text-[11px]">
                        <div className="font-mono text-slate-500">
                          Stock: {String(p.stock_qty)} · v{String(p.version || '1.0.0')}
                          {p.file_format ? ` · ${String(p.file_format)}` : ''}
                          {p.malware_scan_status ? ` · Scan: ${String(p.malware_scan_status)}` : ''}
                          {typeof p.download_count === 'number' ? ` · Downloads: ${p.download_count}` : ''} · Avail:{' '}
                          <strong className="uppercase">{avail}</strong>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-400">Lifecycle:</span>
                          {[
                            { state: 'awaiting_file_verification', label: 'Verify License' },
                            { state: 'published', label: 'Verify File & Publish' },
                            { state: 'suspended', label: 'Suspend' },
                            { state: 'out_of_stock', label: 'Out of Stock' },
                            { state: 'archived', label: 'Archive' },
                          ].map((act) => (
                            <button
                              key={act.state}
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/admin/products/${id}`,
                                  'PATCH',
                                  { lifecycleStatus: act.state },
                                  `Product lifecycle moved to ${act.state}.`
                                )
                              }
                              className={`px-2 py-0.5 rounded border font-mono cursor-pointer ${
                                lifecycle === act.state
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-500'
                              }`}
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/products/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                {/* Opportunities & Freelance Services */}
                <ApprovalSection
                  title="Jobs, Grants, Fellowships & Competitions Queue"
                  icon={Users}
                  items={data.opportunities}
                  renderTitle={(o) => `${String(o.title)} (${String(o.opportunity_type)} · ${String(o.organization_name)})`}
                  renderStatus={(o) => String(o.approval_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/opportunities/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                <ApprovalSection
                  title="Global Schools & Institutions Verification Queue"
                  icon={Building2}
                  items={data.schools || []}
                  renderTitle={(s) => `${String(s.name)} — ${String(s.school_type)} (${String(s.country)})`}
                  renderStatus={(s) => String(s.verification_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/schools/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                <ApprovalSection
                  title="Freelance Services Queue"
                  icon={Users}
                  items={data.services}
                  renderTitle={(s) => `${String(s.title)} — ${String(s.price_pi)} π (${String(s.freelancer_name)})`}
                  renderStatus={(s) => String(s.approval_status)}
                  onModerate={(id, action, reviewNotes) =>
                    mutate(`/api/admin/services/${id}`, 'PATCH', { moderationAction: action, reviewNotes })
                  }
                />

                {/* 9-State Teacher Contributions Moderation Queue */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                    <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                      Teacher Contributions &amp; Lesson Materials Queue (9-State Workflow)
                    </h2>
                  </div>
                  {(data.teacherSubmissions || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No teacher contributions submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(data.teacherSubmissions || []).map((sub) => (
                        <div
                          key={sub.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 max-w-2xl">
                              <div className="text-xs font-mono text-purple-700 dark:text-amber-400">
                                #{sub.id} · Status: <strong>{sub.status}</strong> · v{sub.current_version} · {sub.subject} · {sub.level} · {(sub.language_code || 'en').toUpperCase()}
                              </div>
                              <div className="font-semibold text-sm text-slate-950 dark:text-white">{sub.title}</div>
                              <div className="text-xs text-slate-500">
                                By {sub.author_name || `User #${sub.author_user_id}`}
                                {sub.school_name ? ` · ${sub.school_name}` : ''}
                                {sub.file_original_name ? ` · File: ${sub.file_original_name} (${sub.file_format})` : ''}
                                {sub.file_sha256 ? ` · SHA-256: ${sub.file_sha256.slice(0, 12)}...` : ''}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                Copyright Declaration: {sub.copyright_declared ? 'Confirmed Original / Licensed' : 'Missing'} · License: {sub.license_terms}
                              </div>
                              {sub.accessibility_notes && (
                                <div className="text-xs text-slate-500">Accessibility: {sub.accessibility_notes}</div>
                              )}
                              {sub.review_notes && (
                                <div className="text-xs text-amber-700 dark:text-amber-300">Reviewer Note: {sub.review_notes}</div>
                              )}
                            </div>
                            {sub.file_original_name && (
                              <a
                                href={`/api/academy/teacher-submissions/${sub.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Inspect File
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                            {(
                              [
                                'Under Review',
                                'Revision Required',
                                'Approved',
                                'Published',
                                'Rejected',
                                'Suspended',
                                'Archived',
                              ] as TeacherSubmissionStatus[]
                            ).map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                disabled={sub.status === nextStatus}
                                onClick={() =>
                                  mutate(
                                    `/api/admin/teacher-submissions/${sub.id}`,
                                    'PATCH',
                                    {
                                      status: nextStatus,
                                      reviewNotes:
                                        nextStatus === 'Revision Required'
                                          ? 'Reviewer requested revisions for completeness, citations, or accessibility.'
                                          : nextStatus === 'Published'
                                            ? 'Approved and published to IFIOK SCHOOL library.'
                                            : `Status transitioned to ${nextStatus} by moderation review.`,
                                    },
                                    `Teacher contribution #${sub.id} set to ${nextStatus}.`
                                  )
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-mono border cursor-pointer disabled:opacity-40 ${
                                  sub.status === nextStatus
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500'
                                }`}
                              >
                                {nextStatus}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {['gemini-4-hydrogen', 'gemini-4-argon', 'gemini-2.5-flash'].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    setAiMonitor((p) => (p ? { ...p, config: { ...p.config, model: preset } } : p))
                                  }
                                  className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
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
              <div className="space-y-8 max-w-4xl">
                <form
                  onSubmit={handlePublishVerified}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4"
                >
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                      Verified Inventory & Authorized Feed Publisher
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Publish only genuine owned inventory, authorized supplier feeds, confirmed institutional opportunities, or complete 22-point curricula with recorded provenance.
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
                            setPubCategory('Licensed Software');
                            setPubSubType('digital');
                          } else if (next === 'course') {
                            setPubCategory('Web3 and Blockchain');
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
                        <option value="opportunity">Confirmed Opportunity / Grant / Fellowship</option>
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
                            : pubType === 'course'
                              ? 'Subject'
                              : 'Category'}
                      </label>
                      {pubType === 'course' ? (
                        <select
                          value={pubCategory}
                          onChange={(e) => setPubCategory(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                        >
                          {ACADEMIC_SUBJECTS.map((subj) => (
                            <option key={subj} value={subj}>
                              {subj}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          value={pubCategory}
                          onChange={(e) => setPubCategory(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                        />
                      )}
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
                          {OPPORTUNITY_TYPES.map((ot) => (
                            <option key={ot.id} value={ot.id}>
                              {ot.label}
                            </option>
                          ))}
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
                        {pubType === 'opportunity' ? (
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
                        ) : (
                          <div>
                            <label className="block text-xs font-medium mb-1">Business Hub Category</label>
                            <select
                              value={pubHubCategory}
                              onChange={(e) => setPubHubCategory(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                            >
                              {BUSINESS_HUB_CATEGORIES.map((hc) => (
                                <option key={hc} value={hc}>
                                  {hc}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {pubType === 'product' && (
                    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Market Suite (A–F / P)</label>
                          <select
                            value={pubMarketSuite}
                            onChange={(e) => setPubMarketSuite(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-sm"
                          >
                            {MARKET_SUITES.map((ms) => (
                              <option key={ms.id} value={ms.id}>
                                Suite {ms.code} — {ms.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Delivery / Fulfillment Method</label>
                          <select
                            value={pubDeliveryMethod}
                            onChange={(e) => setPubDeliveryMethod(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-sm"
                          >
                            {DELIVERY_METHODS.map((dm) => (
                              <option key={dm.id} value={dm.id}>
                                {dm.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Distribution / Ownership Rights (Required)</label>
                          <input
                            type="text"
                            required
                            minLength={5}
                            value={pubDistPermission}
                            onChange={(e) => setPubDistPermission(e.target.value)}
                            placeholder="Original Publisher License / Authorized Reseller ID"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Refund & Support Terms (Required)</label>
                          <input
                            type="text"
                            required
                            minLength={8}
                            value={pubRefundTerms}
                            onChange={(e) => setPubRefundTerms(e.target.value)}
                            placeholder="14-day verified Pi dispute & defect support"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs font-medium mb-1">IFIOK DIGITAL Version Tag</label>
                          <input
                            type="text"
                            value={pubProductVersion}
                            onChange={(e) => setPubProductVersion(e.target.value)}
                            placeholder="1.0.0"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Private Binary Asset Vault (PDF/ZIP/DOCX/MP4)</label>
                          <input
                            type="file"
                            accept=".pdf,.zip,.docx,.xlsx,.pptx,.mp3,.mp4,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadPubProductFile(f);
                            }}
                            className="text-xs"
                          />
                          {uploadingPubFile && <span className="block text-[11px] text-slate-500 mt-1">Scanning...</span>}
                          {pubFileMeta && (
                            <span className="block font-mono text-[11px] text-emerald-600 mt-1">
                              {pubFileMeta.originalName} ({pubFileMeta.fileFormat})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {pubType === 'opportunity' && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Eligibility & Target Regions</label>
                      <input
                        type="text"
                        value={pubEligibility}
                        onChange={(e) => setPubEligibility(e.target.value)}
                        placeholder="Open globally to qualified applicants..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  {pubType === 'course' && (
                    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        22-Point Paid Course Curriculum Requirements (Required when Pi Price &gt; 0)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Language</label>
                          <select
                            value={pubLanguageCode}
                            onChange={(e) => setPubLanguageCode(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          >
                            {LANGUAGE_OPTIONS.map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.nativeLabel} ({l.label})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Teaching Media URL (Video/Audio/Slide Deck)</label>
                          <input
                            type="url"
                            value={pubMediaUrl}
                            onChange={(e) => setPubMediaUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Learning Objectives (2+ lines)</label>
                          <textarea
                            rows={2}
                            value={pubObjectivesText}
                            onChange={(e) => setPubObjectivesText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Modules & Lesson Notes (Topic | Notes)</label>
                          <textarea
                            rows={2}
                            value={pubModulesText}
                            onChange={(e) => setPubModulesText(e.target.value)}
                            placeholder="Module 1: Core Foundations | Detailed lesson notes..."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Slides / Reading Materials (1 per line)</label>
                          <textarea
                            rows={2}
                            value={pubSlidesText}
                            onChange={(e) => setPubSlidesText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Practical Workbooks &amp; Exercises (1+ line)</label>
                          <textarea
                            rows={2}
                            value={pubWorkbooksText}
                            onChange={(e) => setPubWorkbooksText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Assignments / Projects (1 per line)</label>
                          <textarea
                            rows={2}
                            value={pubAssignmentsText}
                            onChange={(e) => setPubAssignmentsText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Quizzes / Assessments (1 per line)</label>
                          <textarea
                            rows={2}
                            value={pubQuizzesText}
                            onChange={(e) => setPubQuizzesText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Examination Questions (1+ line)</label>
                          <textarea
                            rows={2}
                            value={pubExamQuestionsText}
                            onChange={(e) => setPubExamQuestionsText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Answer Keys (min 10 chars)</label>
                          <textarea
                            rows={2}
                            value={pubAnswerKeysText}
                            onChange={(e) => setPubAnswerKeysText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Marking Guide &amp; Rubric</label>
                          <textarea
                            rows={2}
                            value={pubExamGuide}
                            onChange={(e) => setPubExamGuide(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Instructor Qualifications</label>
                          <input
                            type="text"
                            value={pubInstructorQual}
                            onChange={(e) => setPubInstructorQual(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Prerequisites</label>
                          <input
                            type="text"
                            value={pubPrerequisites}
                            onChange={(e) => setPubPrerequisites(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Target Audience / Grade Level</label>
                          <input
                            type="text"
                            value={pubTargetAudience}
                            onChange={(e) => setPubTargetAudience(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Copyright / Licensing Permission</label>
                          <input
                            type="text"
                            value={pubCopyright}
                            onChange={(e) => setPubCopyright(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Completion Certificate Criteria</label>
                          <input
                            type="text"
                            value={pubCertificateCriteria}
                            onChange={(e) => setPubCertificateCriteria(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium mb-1">Attach Encrypted Course Files (PDF/DOCX/PPTX/ZIP/MP4)</label>
                          <input
                            type="file"
                            accept=".pdf,.zip,.docx,.xlsx,.pptx,.mp3,.mp4,.txt,.md,.csv"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadPubCourseFile(f);
                            }}
                            className="text-xs"
                          />
                          {uploadingPubCourseFile && <span className="ml-2 text-xs text-slate-500">Scanning...</span>}
                          {pubCourseFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {pubCourseFiles.map((cf) => (
                                <span key={cf.storageKey} className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px]">
                                  {cf.originalName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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

                {/* Batch Verified IFIOK DIGITAL JSON Import */}
                <form
                  onSubmit={handleImportBatch}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4"
                >
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                      Batch Verified IFIOK DIGITAL Import (JSON)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Import up to 100 licensed digital products at once. Each entry must include title, description, positive pricePi, sourceOrigin, distributionPermission, and refundSupportTerms.
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={batchJsonText}
                    onChange={(e) => setBatchJsonText(e.target.value)}
                    placeholder='[{"title": "...", "category": "Digital Books & eBooks", "marketSuite": "digital_learning_publishing", "pricePi": 5, "sourceOrigin": "Authorized Publisher", "distributionPermission": "Commercial License", "refundSupportTerms": "14-day Pi dispute support", "description": "..."}]'
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={batchImporting || !batchJsonText.trim()}
                    className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {batchImporting ? 'Importing Batch...' : 'Import Verified Digital Batch'}
                  </button>
                </form>

                {/* Authorized Supplier API & Structured JSON Feed Integrations */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                      Authorized Supplier API & JSON Feed Integrations
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Connect only authorized supplier feeds with valid public HTTPS endpoints and verified distribution licenses. Private/loopback hosts are blocked by SSRF policy.
                    </p>
                  </div>

                  <form onSubmit={handleAddSupplierIntegration} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                    <div>
                      <label className="block text-xs font-medium mb-1">Supplier / Publisher Name</label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        placeholder="Authorized Partner Name"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Market Suite</label>
                      <select
                        value={supSuite}
                        onChange={(e) => setSupSuite(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        {MARKET_SUITES.map((ms) => (
                          <option key={ms.id} value={ms.id}>
                            Suite {ms.code} — {ms.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Integration Mode</label>
                      <select
                        value={supType}
                        onChange={(e) => setSupType(e.target.value as typeof supType)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        <option value="json_feed">Structured JSON Feed</option>
                        <option value="authorized_api">Authorized Partner API</option>
                        <option value="partner_portal">Partner Portal Import</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Public Feed URL (https://)</label>
                      <input
                        type="url"
                        value={supFeedUrl}
                        onChange={(e) => setSupFeedUrl(e.target.value)}
                        placeholder="https://partner.example.com/catalog.json"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Distribution / Reseller License Proof</label>
                      <input
                        type="text"
                        required
                        minLength={5}
                        value={supLicense}
                        onChange={(e) => setSupLicense(e.target.value)}
                        placeholder="Signed distribution agreement or publisher license ID"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Auth Header Name (Optional)</label>
                      <input
                        type="text"
                        value={supAuthHeader}
                        onChange={(e) => setSupAuthHeader(e.target.value)}
                        placeholder="X-Partner-Key (key stored in server env)"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        Register Authorized Supplier
                      </button>
                    </div>
                  </form>

                  {data.supplierIntegrations.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No external supplier feeds registered yet. Connect an authorized partner feed above when distribution credentials are verified.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {data.supplierIntegrations.map((sup) => (
                        <div key={sup.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white">{sup.supplier_name}</div>
                            <div className="text-slate-500 font-mono">
                              Suite: {sup.category_suite} · {sup.integration_type} · Status: {sup.status} · Imported:{' '}
                              {sup.items_imported_count}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              License: {sup.distribution_license} {sup.last_sync_status ? `· Last sync: ${sup.last_sync_status}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(`/api/admin/supplier-integrations/${sup.id}`, 'PATCH', {
                                  status: sup.status === 'active' ? 'paused' : 'active',
                                })
                              }
                              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                            >
                              {sup.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              disabled={syncingSupId === sup.id || !sup.feed_url}
                              onClick={() => handleSyncSupplier(sup.id)}
                              className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {syncingSupId === sup.id ? 'Syncing...' : 'Sync Feed'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

                {/* Copyright & IP Takedown Reports */}
                <div className="space-y-3">
                  <h2 className="font-display font-bold text-lg">Copyright, IP Infringement &amp; Takedown Reports</h2>
                  {(data.copyrightReports || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No copyright or IP takedown notices filed.</p>
                  ) : (
                    <div className="space-y-3">
                      {(data.copyrightReports || []).map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1 max-w-2xl">
                            <div className="text-xs font-mono text-slate-500 uppercase">
                              IP Notice #{rep.id} · {rep.target_type} #{rep.target_id} · Status:{' '}
                              <strong className="text-purple-700 dark:text-amber-400">{rep.status}</strong>
                            </div>
                            <div className="font-semibold text-sm text-slate-950 dark:text-white">{rep.reason}</div>
                            <div className="text-xs text-slate-500">
                              Claimant: {rep.claimant_name || rep.reporter_name || `User #${rep.reporter_user_id}`}
                              {rep.claimant_email ? ` (${rep.claimant_email})` : ''}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{rep.details}</p>
                            {rep.evidence_url && (
                              <a
                                href={rep.evidence_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-xs text-purple-700 dark:text-amber-400 underline"
                              >
                                Evidence Link
                              </a>
                            )}
                            {rep.admin_notes && (
                              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                                Resolution: {rep.admin_notes}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/admin/copyright-reports/${rep.id}`,
                                  'PATCH',
                                  { status: 'under_review', adminNotes: 'Assigned for IP verification review.' },
                                  `IP notice #${rep.id} moved to under_review.`
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Under Review
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/admin/copyright-reports/${rep.id}`,
                                  'PATCH',
                                  {
                                    status: 'takedown_executed',
                                    adminNotes: 'Content suspended and removed from public discovery pending proof of rights.',
                                  },
                                  `Takedown executed on notice #${rep.id}. Target suspended.`
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Execute Takedown
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/admin/copyright-reports/${rep.id}`,
                                  'PATCH',
                                  { status: 'rejected', adminNotes: 'Insufficient infringement evidence or verified license confirmed.' },
                                  `IP notice #${rep.id} rejected.`
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Reject Notice
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

                <div>
                  <h2 className="font-display font-bold text-lg mb-3">Digital Entitlements Lock / Revoke Control</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Entitlement</th>
                          <th className="py-3 px-4">Member</th>
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-4">Order Status</th>
                          <th className="py-3 px-4">Lock State</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.entitlements.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">
                              No digital product or course entitlements issued yet.
                            </td>
                          </tr>
                        ) : (
                          data.entitlements.map((ent) => {
                            const unlocked = Number(ent.is_unlocked) === 1;
                            const orderPaid = ['paid', 'fulfilled'].includes(String(ent.order_status));
                            return (
                              <tr key={String(ent.id)}>
                                <td className="py-3 px-4 font-mono">
                                  #{String(ent.id)} ({String(ent.item_type)})
                                </td>
                                <td className="py-3 px-4">{String(ent.user_name)}</td>
                                <td className="py-3 px-4">{String(ent.item_title)}</td>
                                <td className="py-3 px-4 font-mono uppercase">{String(ent.order_status)}</td>
                                <td className="py-3 px-4 font-mono uppercase">
                                  {unlocked ? 'UNLOCKED' : 'LOCKED'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    disabled={!unlocked && !orderPaid}
                                    onClick={() =>
                                      mutate(
                                        `/api/admin/entitlements/${ent.id}`,
                                        'PATCH',
                                        { isUnlocked: !unlocked },
                                        unlocked ? 'Entitlement locked/revoked.' : 'Entitlement unlocked.'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer disabled:opacity-40"
                                  >
                                    {unlocked ? 'Revoke / Lock' : orderPaid ? 'Unlock' : 'Unpaid (Blocked)'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="font-display font-bold text-lg mb-3">Pi Network Testnet Payment Audit</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Pi Payment ID</th>
                          <th className="py-3 px-4">Buyer UID</th>
                          <th className="py-3 px-4">Reference</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">TXID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.piTestnetPayments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">
                              No Pi Testnet payments recorded yet.
                            </td>
                          </tr>
                        ) : (
                          data.piTestnetPayments.map((ptp) => (
                            <tr key={String(ptp.id)}>
                              <td className="py-3 px-4 font-mono">{String(ptp.pi_payment_id)}</td>
                              <td className="py-3 px-4 font-mono">{String(ptp.pi_uid || '—')}</td>
                              <td className="py-3 px-4">
                                {String(ptp.target_type || 'checkout')} #{String(ptp.target_id || '0')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">{String(ptp.amount)} π</td>
                              <td className="py-3 px-4 font-mono uppercase">{String(ptp.status)}</td>
                              <td className="py-3 px-4 font-mono">
                                {ptp.txid ? `${String(ptp.txid).slice(0, 14)}...` : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="font-display font-bold text-lg mb-3">IFIOK DIGITAL Verified Download Audit</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Format</th>
                          <th className="py-3 px-4">Member</th>
                          <th className="py-3 px-4">Order</th>
                          <th className="py-3 px-4">Downloaded At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {(data.digitalDownloads || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              No verified digital downloads recorded yet.
                            </td>
                          </tr>
                        ) : (
                          (data.digitalDownloads || []).map((dl) => (
                            <tr key={String(dl.id)}>
                              <td className="py-3 px-4 font-semibold">{String(dl.product_title)}</td>
                              <td className="py-3 px-4 font-mono">{String(dl.file_format || '—')}</td>
                              <td className="py-3 px-4">{String(dl.user_name || dl.user_email)}</td>
                              <td className="py-3 px-4 font-mono">#{String(dl.order_id)}</td>
                              <td className="py-3 px-4 font-mono">{String(dl.downloaded_at)}</td>
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
  renderExtra,
  canApprove,
  onModerate,
}: {
  title: string;
  icon: typeof Building2;
  items: Array<Record<string, unknown>>;
  renderTitle: (item: Record<string, unknown>) => string;
  renderStatus: (item: Record<string, unknown>) => string;
  renderExtra?: (item: Record<string, unknown>) => ReactNode;
  canApprove?: (item: Record<string, unknown>) => boolean;
  onModerate: (id: number, action: 'approve' | 'suspend' | 'request_correction' | 'reject', reviewNotes: string) => void;
}) {
  const [notesById, setNotesById] = useState<Record<number, string>>({});

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
            const modAction = typeof item.moderation_action === 'string' && item.moderation_action ? item.moderation_action : '';
            const existingNotes = typeof item.review_notes === 'string' ? item.review_notes : '';
            const draftNote = notesById[id] ?? existingNotes;
            const approveAllowed = canApprove ? canApprove(item) : true;
            return (
              <div key={id} className="p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{renderTitle(item)}</div>
                    <div className="font-mono uppercase text-slate-500 mt-0.5">
                      Status: {status}
                      {modAction ? ` · Action: ${modAction}` : ''}
                    </div>
                    {renderExtra && renderExtra(item)}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!approveAllowed}
                      onClick={() => onModerate(id, 'approve', draftNote)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onModerate(id, 'request_correction', draftNote)}
                      className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer"
                    >
                      Request Corrections
                    </button>
                    <button
                      type="button"
                      onClick={() => onModerate(id, 'suspend', draftNote)}
                      className="px-3 py-1.5 rounded-lg border border-slate-400 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => onModerate(id, 'reject', draftNote)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={draftNote}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [id]: e.target.value }))}
                  placeholder="Optional admin review feedback / correction notes sent to member..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-1.5 text-xs"
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
