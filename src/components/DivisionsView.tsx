import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Flag,
  Lock,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import { ACADEMIC_SUBJECTS, COUNTRIES, formatPiPrice, LANGUAGE_OPTIONS } from '../lib/i18n.ts';
import { startPiPaymentFlow } from '../lib/pi.ts';
import type {
  AcademySubView,
  BusinessProfile,
  CommunityPost,
  Course,
  CurrencyCode,
  DivisionTab,
  FreelanceService,
  LanguageCode,
  Opportunity,
  Product,
  UserProfile,
} from '../types/platform.ts';
import { GlobalAcademyHub } from './GlobalAcademyHub.tsx';

interface DivisionsViewProps {
  activeTab: DivisionTab;
  onChangeTab: (tab: DivisionTab) => void;
  onBackHome: () => void;
  user: UserProfile | null;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  initialAcademySubView?: AcademySubView;
  currency: CurrencyCode;
  usdRate: number;
  onRequireAuth: () => void;
  onRefreshSummary: () => void;
  onNavigateView?: (view: 'privacy' | 'terms') => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface PublicMember {
  id: number;
  full_name: string;
  bio: string;
  country: string;
  account_type: string;
}

export function DivisionsView({
  activeTab,
  onChangeTab,
  onBackHome,
  user,
  language,
  onChangeLanguage,
  initialAcademySubView = 'courses',
  currency,
  usdRate,
  onRequireAuth,
  onRefreshSummary,
  onNavigateView,
}: DivisionsViewProps) {
  const [loading, setLoading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValue, setFilterValue] = useState('All');
  const [courseLangFilter, setCourseLangFilter] = useState('all');

  // Data collections
  const [courses, setCourses] = useState<Course[]>([]);
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [services, setServices] = useState<FreelanceService[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [members, setMembers] = useState<PublicMember[]>([]);

  // Market Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Modals / Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [applyOpp, setApplyOpp] = useState<Opportunity | null>(null);
  const [hireService, setHireService] = useState<FreelanceService | null>(null);
  const [messageMember, setMessageMember] = useState<PublicMember | null>(null);

  // Creation form states
  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState('Digital Skills');
  const [fSubject, setFSubject] = useState<string>(ACADEMIC_SUBJECTS[0]);
  const [fCourseLang, setFCourseLang] = useState<LanguageCode>('en');
  const [fIssuingOrg, setFIssuingOrg] = useState('IFIOK SCHOOL');
  const [fDescription, setFDescription] = useState('');
  const [fExtra1, setFExtra1] = useState('');
  const [fExtra2, setFExtra2] = useState('');
  const [fExtra3, setFExtra3] = useState('');
  const [fNum1, setFNum1] = useState('10');
  const [fNum2, setFNum2] = useState('7');
  const [fBool, setFBool] = useState(true);
  const [fImageUrl, setFImageUrl] = useState('');
  const [fSourceOrigin, setFSourceOrigin] = useState('');
  const [fSourceUrl, setFSourceUrl] = useState('');
  const [fLockedContent, setFLockedContent] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [unlockedPreview, setUnlockedPreview] = useState<{ title: string; content: string; unlockedAt: string } | null>(null);
  const [subMode, setSubMode] = useState<'primary' | 'onboarding'>('primary');

  // Action modal fields
  const [actionNote, setActionNote] = useState('');
  const [actionUrl, setActionUrl] = useState('');

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'academy') {
        const res = await apiRequest<{ courses: Course[] }>(
          `/api/divisions/courses?subject=${encodeURIComponent(filterValue)}&language=${encodeURIComponent(courseLangFilter)}&q=${encodeURIComponent(searchQuery)}`
        );
        setCourses(res.courses);
      } else if (activeTab === 'business') {
        const res = await apiRequest<{ businesses: BusinessProfile[] }>(
          `/api/divisions/businesses?sector=${encodeURIComponent(filterValue)}&q=${encodeURIComponent(searchQuery)}`
        );
        setBusinesses(res.businesses);
      } else if (activeTab === 'freelance') {
        const res = await apiRequest<{ services: FreelanceService[] }>(
          `/api/divisions/services?category=${encodeURIComponent(filterValue)}&q=${encodeURIComponent(searchQuery)}`
        );
        setServices(res.services);
      } else if (activeTab === 'opportunities') {
        const res = await apiRequest<{ opportunities: Opportunity[] }>(
          `/api/divisions/opportunities?type=${encodeURIComponent(filterValue === 'All' ? 'all' : filterValue)}&q=${encodeURIComponent(searchQuery)}`
        );
        setOpportunities(res.opportunities);
      } else if (activeTab === 'market') {
        const res = await apiRequest<{ products: Product[] }>(
          `/api/divisions/products?type=${encodeURIComponent(filterValue === 'All' ? 'all' : filterValue)}&q=${encodeURIComponent(searchQuery)}`
        );
        setProducts(res.products);
      } else if (activeTab === 'community') {
        const res = await apiRequest<{ posts: CommunityPost[]; members: PublicMember[] }>(
          `/api/divisions/community?group=${encodeURIComponent(filterValue)}`
        );
        setPosts(res.posts);
        setMembers(res.members);
      }
    } catch (err) {
      setBannerMsg({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load listings.' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterValue, courseLangFilter, searchQuery]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  useEffect(() => {
    setFilterValue('All');
    setCourseLangFilter('all');
    setSearchQuery('');
    setShowCreateModal(false);
    setSubMode('primary');
  }, [activeTab]);

  const notify = (type: 'ok' | 'err', text: string) => {
    setBannerMsg({ type, text });
  };

  const resetForm = () => {
    setFTitle('');
    setFDescription('');
    setFExtra1('');
    setFExtra2('');
    setFExtra3('');
    setFNum1('10');
    setFNum2('7');
    setFImageUrl('');
    setFSourceOrigin('');
    setFSourceUrl('');
    setFLockedContent('');
  };

  const handleUploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ url: string }>('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ dataBase64: base64 }),
      });
      setFImageUrl(res.url);
      notify('ok', 'Image verified and uploaded securely.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Image upload rejected by security scan.');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleAccessUnlocked = async (itemType: 'product' | 'course', itemId: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{ unlocked: boolean; unlockedAt: string; title: string; content: string }>(
        `/api/payments/entitlements/${itemType}/${itemId}`
      );
      setUnlockedPreview({ title: res.title, content: res.content, unlockedAt: res.unlockedAt });
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Locked until server confirms Pi payment.');
    }
  };

  const handleOpenCreate = (mode: 'primary' | 'onboarding' = 'primary') => {
    if (!user) {
      onRequireAuth();
      return;
    }
    resetForm();
    setSubMode(mode);
    if (activeTab === 'academy') {
      setFCategory('Web3 & Blockchain');
      setFSubject(ACADEMIC_SUBJECTS[0]);
      setFCourseLang(language);
      setFIssuingOrg('IFIOK SCHOOL');
    }
    else if (activeTab === 'market') setFCategory('digital');
    else if (activeTab === 'freelance') setFCategory('Software Development');
    else if (activeTab === 'opportunities') setFCategory('job');
    else if (activeTab === 'community') setFCategory('discussion');
    setShowCreateModal(true);
  };

  const handleEnrolCourse = async (course: Course) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await startPiPaymentFlow({ orderType: 'course', referenceId: course.id });
      notify('ok', res.message);
      onRefreshSummary();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Course enrolment could not complete.');
    }
  };

  const handleHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireService) return;
    try {
      const res = await startPiPaymentFlow({
        orderType: 'service',
        referenceId: hireService.id,
        brief: actionNote,
      });
      notify('ok', res.message);
      setHireService(null);
      setActionNote('');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Project initiation failed.');
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyOpp) return;
    try {
      await apiRequest(`/api/divisions/opportunities/${applyOpp.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverNote: actionNote, portfolioUrl: actionUrl }),
      });
      notify('ok', `Application submitted for "${applyOpp.title}". Track status in your Member Dashboard.`);
      setApplyOpp(null);
      setActionNote('');
      setActionUrl('');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Application failed.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageMember) return;
    try {
      await apiRequest('/api/divisions/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientUserId: messageMember.id,
          subject: actionUrl || 'Collaboration Inquiry',
          body: actionNote,
        }),
      });
      notify('ok', `Direct message delivered to ${messageMember.full_name}.`);
      setMessageMember(null);
      setActionNote('');
      setActionUrl('');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Message failed.');
    }
  };

  const handleReportPost = async (postId: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest(`/api/divisions/community/posts/${postId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Flagged by community member for moderation review' }),
      });
      notify('ok', 'Post reported to IFIOK-EN Trust & Safety moderators.');
      loadTab();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not report post.');
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: Math.min(product.stock_qty, i.quantity + 1) } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const handleCheckoutItem = async (item: CartItem) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await startPiPaymentFlow({
        orderType: 'product',
        referenceId: item.product.id,
        quantity: item.quantity,
      });
      notify('ok', res.message);
      setCart((prev) => prev.filter((c) => c.product.id !== item.product.id));
      loadTab();
      onRefreshSummary();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Checkout could not complete.');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'academy' && subMode === 'onboarding') {
        const res = await apiRequest<{ approvalStatus: string }>('/api/divisions/instructors/apply', {
          method: 'POST',
          body: JSON.stringify({
            headline: fTitle,
            bio: fDescription,
            expertise: fExtra1,
            credentials: fExtra2,
          }),
        });
        notify('ok', `Instructor application submitted (${res.approvalStatus}).`);
      } else if (activeTab === 'academy') {
        const syllabus = fExtra1
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        const res = await apiRequest<{ approvalStatus: string }>('/api/divisions/courses', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            category: fCategory,
            subject: fSubject,
            languageCode: fCourseLang,
            issuingOrganization: fIssuingOrg || 'IFIOK SCHOOL',
            level: fExtra2 || 'Beginner',
            durationHours: Number(fNum2) || 6,
            pricePi: Number(fNum1) || 0,
            description: fDescription,
            syllabus: syllabus.length ? syllabus : undefined,
            imageUrl: fImageUrl,
            sourceOrigin: fSourceOrigin || 'Authorized Educational Material',
            sourceUrl: fSourceUrl,
            lockedMaterials: fLockedContent,
          }),
        });
        notify('ok', `Course created with status: ${res.approvalStatus}.`);
      } else if (activeTab === 'business') {
        const res = await apiRequest<{ verificationStatus: string }>('/api/divisions/businesses', {
          method: 'POST',
          body: JSON.stringify({
            businessName: fTitle,
            sector: fCategory,
            country: fExtra1 || 'Global',
            registrationNumber: fExtra2,
            website: fExtra3,
            summary: fDescription,
            servicesOffered: fExtra2 || fCategory,
            sourceOrigin: fSourceOrigin || 'Verified Business Submission',
            sourceUrl: fSourceUrl || fExtra3,
          }),
        });
        notify('ok', `Business profile submitted (${res.verificationStatus}).`);
      } else if (activeTab === 'freelance') {
        const res = await apiRequest<{ approvalStatus: string }>('/api/divisions/services', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            category: fCategory,
            description: fDescription,
            pricePi: Number(fNum1),
            deliveryDays: Number(fNum2),
            sourceOrigin: fSourceOrigin || 'Verified Freelancer Listing',
          }),
        });
        notify('ok', `Freelance service submitted (${res.approvalStatus}).`);
      } else if (activeTab === 'opportunities') {
        const res = await apiRequest<{ approvalStatus: string }>('/api/divisions/opportunities', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            opportunityType: fCategory,
            organizationName: fExtra1,
            location: fExtra2 || 'Global',
            isRemote: fBool,
            compensationOrAward: fExtra3 || 'Disclosed upon shortlist',
            deadline: fNum1 || '2026-12-31',
            description: fDescription,
            requirements: fDescription,
            sourceOrigin: fSourceOrigin || 'Issuing Organization Confirmed',
            sourceUrl: fSourceUrl,
          }),
        });
        notify('ok', `Opportunity submitted for verification (${res.approvalStatus}).`);
      } else if (activeTab === 'market' && subMode === 'onboarding') {
        const res = await apiRequest<{ verificationStatus: string }>('/api/divisions/sellers/apply', {
          method: 'POST',
          body: JSON.stringify({
            storeName: fTitle,
            description: fDescription,
            country: fExtra1 || 'Global',
          }),
        });
        notify('ok', `Seller storefront application submitted (${res.verificationStatus}).`);
      } else if (activeTab === 'market') {
        const res = await apiRequest<{ approvalStatus: string }>('/api/divisions/products', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            productType: fCategory,
            category: fExtra1 || 'Electronics & Tech',
            description: fDescription,
            pricePi: Number(fNum1),
            stockQty: Number(fNum2) || 1,
            imageUrl: fImageUrl,
            sourceOrigin: fSourceOrigin || 'Genuine Seller Submission',
            sourceUrl: fSourceUrl,
            lockedContent: fLockedContent,
          }),
        });
        notify('ok', `Marketplace listing submitted (${res.approvalStatus}).`);
      } else if (activeTab === 'community') {
        await apiRequest('/api/divisions/community/posts', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            postType: fCategory,
            groupName: fExtra1 || 'Global Builders',
            body: fDescription,
          }),
        });
        notify('ok', 'Community post published.');
      }

      setShowCreateModal(false);
      loadTab();
      onRefreshSummary();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const tabs: Array<{ id: DivisionTab; label: string; icon: typeof BookOpen }> = [
    { id: 'academy', label: 'IFIOK SCHOOL', icon: BookOpen },
    { id: 'business', label: 'Business Hub', icon: Building2 },
    { id: 'freelance', label: 'Freelance', icon: Briefcase },
    { id: 'opportunities', label: 'Opportunities', icon: CheckCircle2 },
    { id: 'market', label: 'Market', icon: ShoppingBag },
    { id: 'community', label: 'Community', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] py-8">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-6">
        {/* Top contextual breadcrumb + division switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          {activeTab === 'market' && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              <span className="font-mono tabular-nums">Cart ({cart.reduce((s, c) => s + c.quantity, 0)})</span>
            </button>
          )}
        </div>

        {/* Division segmented tabs */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-200/70 dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#19284E] text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {bannerMsg && (
          <div
            className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4 border ${
              bannerMsg.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <span>{bannerMsg.text}</span>
            <button type="button" onClick={() => setBannerMsg(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Toolbar: Search + Filter + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'academy' ? 'IFIOK SCHOOL' : activeTab}...`}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {activeTab === 'academy' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All 17 Subjects</option>
                {ACADEMIC_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'freelance' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All Services</option>
                <option value="Graphic Design">Graphic Design</option>
                <option value="Website Development">Website Development</option>
                <option value="Software Development">Software Development</option>
                <option value="Writing & Translation">Writing & Translation</option>
                <option value="Digital Marketing">Digital Marketing</option>
                <option value="Consulting">Consulting</option>
              </select>
            )}

            {activeTab === 'opportunities' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All Types</option>
                <option value="job">Jobs</option>
                <option value="internship">Internships</option>
                <option value="scholarship">Scholarships</option>
                <option value="grant">Grants</option>
                <option value="partnership">Partnerships</option>
              </select>
            )}

            {activeTab === 'market' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All Product Types</option>
                <option value="physical">Physical Products (Electronics, Fashion, Home & Office)</option>
                <option value="digital">Digital Products & Software</option>
                <option value="service">Digital Services</option>
                <option value="web3">Web3 Products & Services</option>
                <option value="pi_app">Verified Pi Apps</option>
                <option value="gaming_asset">Blockchain Gaming Assets</option>
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'academy' && (
              <button
                type="button"
                onClick={() => handleOpenCreate('onboarding')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Become an Instructor
              </button>
            )}
            {activeTab === 'market' && (
              <button
                type="button"
                onClick={() => handleOpenCreate('onboarding')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Register Seller Store
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenCreate('primary')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-[#192A54] dark:hover:bg-amber-400 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeTab === 'academy' && 'Publish Course'}
                {activeTab === 'business' && 'Register Business'}
                {activeTab === 'freelance' && 'List Service'}
                {activeTab === 'opportunities' && 'Post Opportunity'}
                {activeTab === 'market' && 'Add Product'}
                {activeTab === 'community' && 'New Post'}
              </span>
            </button>
          </div>
        </div>

        {/* DIVISION CONTENT */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* ACADEMY (Unified Global Academy Hub: 17 Subjects, IFIOK Professor AI, Virtual Classroom, Schools, Certificates) */}
            {activeTab === 'academy' && (
              <GlobalAcademyHub
                user={user}
                language={language}
                onChangeLanguage={onChangeLanguage}
                currency={currency}
                usdRate={usdRate}
                courses={courses}
                subjectFilter={filterValue}
                onChangeSubjectFilter={setFilterValue}
                languageFilter={courseLangFilter}
                onChangeLanguageFilter={setCourseLangFilter}
                initialSubView={initialAcademySubView}
                onRequireAuth={onRequireAuth}
                onEnrolCourse={handleEnrolCourse}
                onAccessUnlockedCourse={(courseId) => handleAccessUnlocked('course', courseId)}
                onOpenCreateCourse={() => handleOpenCreate('primary')}
                onNotify={notify}
              />
            )}

            {/* BUSINESS HUB */}
            {activeTab === 'business' && (
              <div>
                {businesses.length === 0 ? (
                  <EmptyDivisionState
                    title="No verified businesses listed yet"
                    description="Verified SMEs and corporate service partners undergo registration review before public listing."
                    actionLabel="Submit Business Profile"
                    onAction={() => handleOpenCreate('primary')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {businesses.map((b) => (
                      <article
                        key={b.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-3"
                      >
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {b.sector} · {b.country} · {b.source_origin || 'Verified SME'}
                          {b.last_verified_at ? ` · Verified ${b.last_verified_at.slice(0, 10)}` : ''}
                        </div>
                        <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                          {b.business_name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{b.summary}</p>
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          <div>Services: {b.services_offered}</div>
                          {b.registration_number && <div className="font-mono">Reg ID: {b.registration_number}</div>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FREELANCE */}
            {activeTab === 'freelance' && (
              <div>
                {services.length === 0 ? (
                  <EmptyDivisionState
                    title="No approved freelance services listed yet"
                    description="Publish your graphic design, software engineering, writing, or consulting service to collaborate with global clients."
                    actionLabel="List a Freelance Service"
                    onAction={() => handleOpenCreate('primary')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((s) => {
                      const price = formatPiPrice(s.price_pi, currency, usdRate);
                      return (
                        <article
                          key={s.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 flex flex-col justify-between space-y-5"
                        >
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {s.category} · {s.delivery_days} days delivery
                              {s.approval_status !== 'approved' && ` · ${s.approval_status}`}
                            </div>
                            <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">{s.title}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{s.description}</p>
                            <p className="text-xs text-slate-500">
                              Specialist: {s.freelancer_name} ({s.freelancer_country})
                            </p>
                          </div>
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-mono font-bold text-slate-950 dark:text-amber-400">{price.primary}</div>
                              {price.reference && <div className="text-[11px] font-mono text-slate-500">{price.reference}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!user) return onRequireAuth();
                                setActionNote('');
                                setHireService(s);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                            >
                              PAY WITH PI
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* OPPORTUNITIES */}
            {activeTab === 'opportunities' && (
              <div>
                {opportunities.length === 0 ? (
                  <EmptyDivisionState
                    title="No verified opportunities currently open"
                    description="IFIOK-EN strictly forbids fake job offers, synthetic grants, or unverified scholarships. Verified organisations can submit real opportunities for approval."
                    actionLabel="Post Real Opportunity"
                    onAction={() => handleOpenCreate('primary')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {opportunities.map((o) => (
                      <article
                        key={o.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                              {o.opportunity_type} · {o.organization_name} · {o.is_remote ? 'Remote' : o.location}
                            </div>
                            <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white mt-1">
                              {o.title}
                            </h3>
                          </div>
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
                            Due {o.deadline}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{o.description}</p>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Source: {o.source_origin || 'Issuing Organization Confirmed'}
                          {o.last_verified_at ? ` · Verified ${o.last_verified_at.slice(0, 10)}` : ''}
                        </div>
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {o.compensation_or_award}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!user) return onRequireAuth();
                              setActionNote('');
                              setActionUrl('');
                              setApplyOpp(o);
                            }}
                            className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                          >
                            Apply Now
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MARKET */}
            {activeTab === 'market' && (
              <div>
                {products.length === 0 ? (
                  <EmptyDivisionState
                    title="No approved marketplace products yet"
                    description="We never populate IFIOK Market with fake products, fake prices, or fake sellers. Verified sellers can register a storefront and list genuine items."
                    actionLabel="Register Seller Storefront"
                    onAction={() => handleOpenCreate('onboarding')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => {
                      const price = formatPiPrice(p.price_pi, currency, usdRate);
                      return (
                        <article
                          key={p.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            {p.image_url && (
                              <div className="h-44 bg-slate-900">
                                <img
                                  src={p.image_url}
                                  alt={p.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-6 space-y-2">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {p.product_type.replace('_', ' ')} · {p.category} · Stock {p.stock_qty} ·{' '}
                                {p.availability_status || 'available'}
                                {p.approval_status !== 'approved' && ` · ${p.approval_status}`}
                              </div>
                              <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">{p.title}</h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{p.description}</p>
                              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                                <div>
                                  Seller: {p.store_name} ({p.seller_country})
                                </div>
                                <div>
                                  Origin: {p.source_origin || 'Seller Submission'}
                                  {p.last_verified_at ? ` · Verified ${p.last_verified_at.slice(0, 10)}` : ''}
                                </div>
                              </div>
                              {p.product_type !== 'physical' && (
                                <div className="flex items-center justify-between pt-1 text-xs">
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                    <Lock className="w-3.5 h-3.5" /> Auto-locked until Pi verified
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAccessUnlocked('product', p.id)}
                                    className="text-purple-700 dark:text-amber-300 hover:underline font-semibold cursor-pointer"
                                  >
                                    Access
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-mono font-bold text-slate-950 dark:text-amber-400">{price.primary}</div>
                              {price.reference && <div className="text-[11px] font-mono text-slate-500">{price.reference}</div>}
                            </div>
                            <button
                              type="button"
                              disabled={p.stock_qty < 1}
                              onClick={() => addToCart(p)}
                              className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-40"
                            >
                              {p.stock_qty < 1 ? 'Out of Stock' : 'Add to Pi Cart'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* COMMUNITY */}
            {activeTab === 'community' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-4">
                  <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    Community Discussions & Announcements
                  </h3>
                  {posts.length === 0 ? (
                    <EmptyDivisionState
                      title="No community posts published yet"
                      description="Start a constructive discussion, business announcement, or collaboration thread with global IFIOK-EN members."
                      actionLabel="Create First Post"
                      onAction={() => handleOpenCreate('primary')}
                    />
                  ) : (
                    posts.map((post) => (
                      <article
                        key={post.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {post.group_name} · {post.post_type} · {post.author_name} ({post.author_country})
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReportPost(post.id)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Report</span>
                          </button>
                        </div>
                        <h4 className="font-display font-bold text-slate-950 dark:text-white">{post.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {post.body}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">Member Directory</h3>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] divide-y divide-slate-200 dark:divide-slate-800">
                    {members.length === 0 ? (
                      <div className="p-6 text-xs text-slate-500">No active members registered yet.</div>
                    ) : (
                      members.map((m) => (
                        <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {m.full_name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                              {m.account_type} · {m.country}
                            </div>
                          </div>
                          {user && user.id !== m.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionNote('');
                                setActionUrl('');
                                setMessageMember(m);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Message</span>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE / ONBOARDING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                {activeTab === 'academy' && subMode === 'onboarding' && 'Apply as IFIOK SCHOOL Educator / Instructor'}
                {activeTab === 'academy' && subMode === 'primary' && 'Publish IFIOK SCHOOL Course'}
                {activeTab === 'business' && 'Register SME Business Profile'}
                {activeTab === 'freelance' && 'Publish Freelance Service'}
                {activeTab === 'opportunities' && 'Submit Verified Opportunity'}
                {activeTab === 'market' && subMode === 'onboarding' && 'Register Verified Seller Storefront'}
                {activeTab === 'market' && subMode === 'primary' && 'List Marketplace Product'}
                {activeTab === 'community' && 'Create Community Post'}
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {activeTab === 'business'
                    ? 'Business Name'
                    : subMode === 'onboarding' && activeTab === 'market'
                      ? 'Storefront Name'
                      : subMode === 'onboarding' && activeTab === 'academy'
                        ? 'Instructor Headline'
                        : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              {subMode === 'primary' && activeTab !== 'business' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {activeTab === 'opportunities'
                        ? 'Opportunity Type'
                        : activeTab === 'market'
                          ? 'Product Type'
                          : activeTab === 'community'
                            ? 'Post Type'
                            : 'Category'}
                    </label>
                    {activeTab === 'academy' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="Web3 & Blockchain">Web3 & Blockchain</option>
                        <option value="Programming & Software">Programming & Software</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Graphic Design">Graphic Design</option>
                        <option value="Business Management">Business Management</option>
                        <option value="Entrepreneurship">Entrepreneurship</option>
                        <option value="Financial Literacy">Financial Literacy</option>
                        <option value="Digital Skills">Digital Skills</option>
                        <option value="Technology Training">Technology Training</option>
                      </select>
                    )}
                    {activeTab === 'freelance' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="Software Development">Software Development</option>
                        <option value="Website Development">Website Development</option>
                        <option value="Graphic Design">Graphic Design</option>
                        <option value="Writing & Translation">Writing & Translation</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Consulting">Consulting</option>
                      </select>
                    )}
                    {activeTab === 'opportunities' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="job">Job</option>
                        <option value="internship">Internship</option>
                        <option value="scholarship">Scholarship</option>
                        <option value="grant">Grant / Funding</option>
                        <option value="partnership">Business Partnership</option>
                      </select>
                    )}
                    {activeTab === 'market' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="digital">Digital Product</option>
                        <option value="physical">Physical Product</option>
                        <option value="service">Digital Service</option>
                        <option value="web3">Web3 Product</option>
                        <option value="pi_app">Verified Pi App</option>
                        <option value="gaming_asset">Gaming Asset</option>
                      </select>
                    )}
                    {activeTab === 'community' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        <option value="discussion">Discussion</option>
                        <option value="announcement">Business Announcement</option>
                        <option value="collaboration">Collaboration</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {activeTab === 'opportunities'
                        ? 'Organization Name'
                        : activeTab === 'community'
                          ? 'Group Name'
                          : activeTab === 'market'
                            ? 'Sub-Category'
                            : 'Price in Pi (π)'}
                    </label>
                    {['opportunities', 'community', 'market'].includes(activeTab) ? (
                      <input
                        type="text"
                        required={activeTab === 'opportunities'}
                        value={fExtra1}
                        onChange={(e) => setFExtra1(e.target.value)}
                        placeholder={activeTab === 'community' ? 'Global Builders' : ''}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    ) : (
                      <input
                        type="number"
                        min={activeTab === 'academy' ? 0 : 1}
                        step="0.1"
                        required
                        value={fNum1}
                        onChange={(e) => setFNum1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'business' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Sector</label>
                    <input
                      type="text"
                      required
                      value={fCategory}
                      onChange={(e) => setFCategory(e.target.value)}
                      placeholder="Technology & Consulting"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                    <select
                      value={fExtra1 || 'Global'}
                      onChange={(e) => setFExtra1(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'market' && subMode === 'primary' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Price in Pi (π)</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      required
                      value={fNum1}
                      onChange={(e) => setFNum1(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={fNum2}
                      onChange={(e) => setFNum2(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'opportunities' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Location</label>
                    <input
                      type="text"
                      value={fExtra2}
                      onChange={(e) => setFExtra2(e.target.value)}
                      placeholder="London / Remote"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Award / Compensation</label>
                    <input
                      type="text"
                      value={fExtra3}
                      onChange={(e) => setFExtra3(e.target.value)}
                      placeholder="Competitive / Grant"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Deadline</label>
                    <input
                      type="date"
                      required
                      value={fNum1 === '10' ? '2026-12-31' : fNum1}
                      onChange={(e) => setFNum1(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {subMode === 'onboarding' && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {activeTab === 'academy' ? 'Expertise Areas' : 'Country'}
                  </label>
                  <input
                    type="text"
                    required
                    value={fExtra1}
                    onChange={(e) => setFExtra1(e.target.value)}
                    placeholder={activeTab === 'academy' ? 'Web3, TypeScript, SME Finance' : 'United Kingdom'}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description / Details
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={15}
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              {activeTab === 'academy' && subMode === 'primary' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Academic Subject</label>
                      <select
                        value={fSubject}
                        onChange={(e) => {
                          setFSubject(e.target.value);
                          setFCategory(e.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        {ACADEMIC_SUBJECTS.map((subj) => (
                          <option key={subj} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Language</label>
                      <select
                        value={fCourseLang}
                        onChange={(e) => setFCourseLang(e.target.value as LanguageCode)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        {LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.nativeLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Issuing Organization</label>
                      <input
                        type="text"
                        value={fIssuingOrg}
                        onChange={(e) => setFIssuingOrg(e.target.value)}
                        placeholder="IFIOK SCHOOL"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Syllabus Lessons (one per line)</label>
                    <textarea
                      rows={3}
                      value={fExtra1}
                      onChange={(e) => setFExtra1(e.target.value)}
                      placeholder={'Module 1: Architecture Foundations\nModule 2: Security & Payments\nModule 3: Capstone'}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'opportunities' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={fBool} onChange={(e) => setFBool(e.target.checked)} />
                  <span>Remote-friendly opportunity</span>
                </label>
              )}

              {subMode === 'primary' && ['market', 'academy', 'business', 'opportunities', 'freelance'].includes(activeTab) && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Source Origin (Provenance)</label>
                      <input
                        type="text"
                        value={fSourceOrigin}
                        onChange={(e) => setFSourceOrigin(e.target.value)}
                        placeholder={
                          activeTab === 'market'
                            ? 'Genuine Seller Inventory'
                            : activeTab === 'academy'
                              ? 'Authorized Educational Material'
                              : 'Issuing Organization Confirmed'
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Source Reference URL (Optional)</label>
                      <input
                        type="url"
                        value={fSourceUrl}
                        onChange={(e) => setFSourceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  {(activeTab === 'market' || activeTab === 'academy') && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Verified Image Upload (PNG / JPEG / WEBP, malware-scanned)
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadImage(file);
                            }}
                            className="text-xs"
                          />
                          {uploadingImg && <span className="text-xs text-slate-500">Scanning image...</span>}
                          {fImageUrl && <span className="font-mono text-xs text-emerald-600">{fImageUrl}</span>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Locked Paid Content / Materials (Encrypted, unlocked only after Pi verification)
                        </label>
                        <textarea
                          rows={2}
                          value={fLockedContent}
                          onChange={(e) => setFLockedContent(e.target.value)}
                          placeholder="Download link, access instructions, or course syllabus materials..."
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPLY TO OPPORTUNITY MODAL */}
      {applyOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">Apply: {applyOpp.title}</h3>
              <button type="button" onClick={() => setApplyOpp(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApplySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Cover Note & Qualifications</label>
                <textarea
                  rows={4}
                  required
                  minLength={20}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Portfolio or LinkedIn URL (Optional)</label>
                <input
                  type="url"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold cursor-pointer"
              >
                Submit Application
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COMMISSION FREELANCE SERVICE MODAL */}
      {hireService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">
                Commission: {hireService.title}
              </h3>
              <button type="button" onClick={() => setHireService(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleHireSubmit} className="space-y-3">
              <p className="text-xs text-slate-500">
                Service Fee: <span className="font-mono font-semibold">{hireService.price_pi} π</span> (+ platform commission). Settled via Official Pi Network Testnet.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1">Project Brief & Deliverables</label>
                <textarea
                  rows={4}
                  required
                  minLength={15}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Describe your project goals, milestones, and technical requirements..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold cursor-pointer"
              >
                PAY WITH PI (Testnet)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT MESSAGE MODAL */}
      {messageMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">
                Message {messageMember.full_name}
              </h3>
              <button type="button" onClick={() => setMessageMember(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="Partnership or collaboration inquiry"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold cursor-pointer"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MARKET SHOPPING CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-[#0D152B] h-full border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">Marketplace Cart</h3>
                <button type="button" onClick={() => setCartOpen(false)} className="cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {cart.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Your cart is empty.</p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-slate-900 dark:text-white">
                            {item.product.title}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {item.product.price_pi} π × {item.quantity}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCart((prev) => prev.filter((c) => c.product.id !== item.product.id))}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCheckoutItem(item)}
                        className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        PAY WITH PI ({(item.product.price_pi * item.quantity).toFixed(2)} π Testnet)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-4">
              Pi Network is the exclusive payment method. Digital items stay locked until server verifies Pi Testnet settlement.
            </p>
          </div>
        </div>
      )}

      {/* UNLOCKED DIGITAL ENTITLEMENT MODAL */}
      {unlockedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-display font-bold text-slate-950 dark:text-white">{unlockedPreview.title}</h3>
              </div>
              <button type="button" onClick={() => setUnlockedPreview(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {unlockedPreview.content}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Unlocked via verified Pi payment at {unlockedPreview.unlockedAt}</span>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] mt-10 py-6">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>© {new Date().getFullYear()} IFIOK-EN · Contact: ifiok82@gmail.com</span>
          <div className="flex items-center gap-4">
            <a
              href="/privacy"
              onClick={(e) => {
                if (onNavigateView) {
                  e.preventDefault();
                  onNavigateView('privacy');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white underline"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                if (onNavigateView) {
                  e.preventDefault();
                  onNavigateView('terms');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white underline"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EmptyDivisionState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] p-12 text-center space-y-3">
      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onAction}
          className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
