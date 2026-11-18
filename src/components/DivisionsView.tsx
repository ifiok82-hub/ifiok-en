import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Download,
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
import {
  ACADEMIC_SUBJECTS,
  BUSINESS_HUB_CATEGORIES,
  COMMUNITY_SPACES,
  COUNTRIES,
  DELIVERY_METHODS,
  formatPiPrice,
  FREELANCE_CATEGORIES,
  IFIOK_DIGITAL_12_CATEGORIES,
  IFIOK_DIGITAL_CATEGORIES,
  LANGUAGE_OPTIONS,
  MARKET_SUITES,
  OPPORTUNITY_TYPES,
} from '../lib/i18n.ts';
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

  // Division-specific filters & detail modal
  const [hubCategoryFilter, setHubCategoryFilter] = useState('All');
  const [marketSuiteFilter, setMarketSuiteFilter] = useState('all');
  const [marketCategoryFilter, setMarketCategoryFilter] = useState('All');
  const [selectedDigitalCatId, setSelectedDigitalCatId] = useState<string>('all');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [ipReportProduct, setIpReportProduct] = useState<Product | null>(null);
  const [ipReason, setIpReason] = useState('Copyright Infringement / Unlicensed File');
  const [ipDetails, setIpDetails] = useState('');
  const [ipEvidenceUrl, setIpEvidenceUrl] = useState('');
  const [submittingIp, setSubmittingIp] = useState(false);

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
  const [unlockedPreview, setUnlockedPreview] = useState<{
    itemType: 'product' | 'course';
    itemId: number;
    title: string;
    content: string;
    unlockedAt: string;
    hasFile?: boolean;
    fileOriginalName?: string;
    fileFormat?: string;
    fileSizeBytes?: number;
    version?: string;
    courseFiles?: Array<{ storageKey: string; originalName: string; fileFormat?: string; fileSizeBytes?: number }>;
  } | null>(null);
  const [downloadingAsset, setDownloadingAsset] = useState(false);
  const [subMode, setSubMode] = useState<'primary' | 'onboarding'>('primary');

  // Expanded division creation fields
  const [fHubCategory, setFHubCategory] = useState<string>(BUSINESS_HUB_CATEGORIES[0]);
  const [fMarketSuite, setFMarketSuite] = useState<string>(MARKET_SUITES[0].id);
  const [fDeliveryMethod, setFDeliveryMethod] = useState<string>(DELIVERY_METHODS[0].id);
  const [fDistPermission, setFDistPermission] = useState('');
  const [fRefundTerms, setFRefundTerms] = useState('');
  const [fProductVersion, setFProductVersion] = useState('1.0.0');
  const [fSupportInfo, setFSupportInfo] = useState('');
  const [fOwnershipAttested, setFOwnershipAttested] = useState(true);
  const [fSubmitLifecycle, setFSubmitLifecycle] = useState<'draft' | 'submitted'>('submitted');
  const [fProductFile, setFProductFile] = useState<{
    storageKey: string;
    originalName: string;
    fileFormat: string;
    fileSizeBytes: number;
    fileSha256: string;
  } | null>(null);
  const [uploadingProductFile, setUploadingProductFile] = useState(false);

  const [fDeliverables, setFDeliverables] = useState('');
  const [fCredentials, setFCredentials] = useState('');
  const [fEligibility, setFEligibility] = useState('');
  const [fEventDate, setFEventDate] = useState('');
  const [fEventLocation, setFEventLocation] = useState('');
  // 22-point IFIOK SCHOOL curriculum fields
  const [fObjectives, setFObjectives] = useState('');
  const [fModulesNotes, setFModulesNotes] = useState('');
  const [fMediaUrl, setFMediaUrl] = useState('');
  const [fSlides, setFSlides] = useState('');
  const [fWorkbooks, setFWorkbooks] = useState('');
  const [fAssignments, setFAssignments] = useState('');
  const [fQuizzes, setFQuizzes] = useState('');
  const [fExamQuestions, setFExamQuestions] = useState('');
  const [fAnswerKeys, setFAnswerKeys] = useState('');
  const [fExamGuide, setFExamGuide] = useState('');
  const [fInstructorQual, setFInstructorQual] = useState('');
  const [fPrerequisites, setFPrerequisites] = useState('');
  const [fTargetAudience, setFTargetAudience] = useState('');
  const [fCopyright, setFCopyright] = useState('');
  const [fCertCriteria, setFCertCriteria] = useState('');
  const [fCourseFiles, setFCourseFiles] = useState<
    Array<{ storageKey: string; originalName: string; fileFormat: string; fileSizeBytes: number; fileSha256: string }>
  >([]);
  const [uploadingCourseFile, setUploadingCourseFile] = useState(false);

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
          `/api/divisions/businesses?sector=${encodeURIComponent(filterValue)}&hubCategory=${encodeURIComponent(hubCategoryFilter)}&q=${encodeURIComponent(searchQuery)}`
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
          `/api/divisions/products?type=${encodeURIComponent(filterValue === 'All' ? 'all' : filterValue)}&suite=${encodeURIComponent(marketSuiteFilter)}&category=${encodeURIComponent(marketCategoryFilter)}&q=${encodeURIComponent(searchQuery)}`
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
  }, [activeTab, filterValue, courseLangFilter, searchQuery, hubCategoryFilter, marketSuiteFilter, marketCategoryFilter]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  useEffect(() => {
    setFilterValue('All');
    setHubCategoryFilter('All');
    setMarketSuiteFilter('all');
    setMarketCategoryFilter('All');
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
    setFHubCategory(BUSINESS_HUB_CATEGORIES[0]);
    setFMarketSuite(MARKET_SUITES[0].id);
    setFDeliveryMethod(DELIVERY_METHODS[0].id);
    setFDistPermission('');
    setFRefundTerms('');
    setFProductVersion('1.0.0');
    setFSupportInfo('');
    setFOwnershipAttested(true);
    setFSubmitLifecycle('submitted');
    setFProductFile(null);
    setFDeliverables('');
    setFCredentials('');
    setFEligibility('');
    setFEventDate('');
    setFEventLocation('');
    setFObjectives('');
    setFModulesNotes('');
    setFMediaUrl('');
    setFSlides('');
    setFWorkbooks('');
    setFAssignments('');
    setFQuizzes('');
    setFExamQuestions('');
    setFAnswerKeys('');
    setFExamGuide('');
    setFInstructorQual('');
    setFPrerequisites('');
    setFTargetAudience('');
    setFCopyright('');
    setFCertCriteria('');
    setFCourseFiles([]);
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

  const handleUploadProductFile = async (file: File) => {
    setUploadingProductFile(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected digital asset.'));
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
      setFProductFile({
        storageKey: res.storageKey,
        originalName: res.originalName,
        fileFormat: res.fileFormat,
        fileSizeBytes: res.fileSizeBytes,
        fileSha256: res.sha256,
      });
      notify('ok', `Digital asset "${res.originalName}" scanned clean and stored in private vault.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Digital asset rejected by security scan.');
    } finally {
      setUploadingProductFile(false);
    }
  };

  const handleUploadCourseFile = async (file: File) => {
    setUploadingCourseFile(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected course file.'));
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
      setFCourseFiles((prev) => [
        ...prev,
        {
          storageKey: res.storageKey,
          originalName: res.originalName,
          fileFormat: res.fileFormat,
          fileSizeBytes: res.fileSizeBytes,
          fileSha256: res.sha256,
        },
      ]);
      notify('ok', `Course material "${res.originalName}" encrypted & attached.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Course material rejected by security scan.');
    } finally {
      setUploadingCourseFile(false);
    }
  };

  const handleAccessUnlocked = async (itemType: 'product' | 'course', itemId: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{
        unlocked: boolean;
        unlockedAt: string;
        title: string;
        content: string;
        hasFile?: boolean;
        fileOriginalName?: string;
        fileFormat?: string;
        fileSizeBytes?: number;
        version?: string;
        courseFiles?: Array<{ storageKey: string; originalName: string; fileFormat?: string; fileSizeBytes?: number }>;
      }>(`/api/payments/entitlements/${itemType}/${itemId}`);
      setUnlockedPreview({
        itemType,
        itemId,
        title: res.title,
        content: res.content,
        unlockedAt: res.unlockedAt,
        hasFile: res.hasFile,
        fileOriginalName: res.fileOriginalName,
        fileFormat: res.fileFormat,
        fileSizeBytes: res.fileSizeBytes,
        version: res.version,
        courseFiles: res.courseFiles,
      });
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Locked until server confirms Pi payment.');
    }
  };

  const handleDownloadEntitlementFile = async (
    itemType: 'product' | 'course',
    itemId: number,
    fileKey?: string
  ) => {
    setDownloadingAsset(true);
    try {
      const res = await apiRequest<{ downloadUrl: string; fileName: string }>(
        `/api/payments/entitlements/${itemType}/${itemId}/download-token`,
        {
          method: 'POST',
          body: JSON.stringify(fileKey ? { fileKey } : {}),
        }
      );
      const link = document.createElement('a');
      link.href = res.downloadUrl;
      link.download = res.fileName || 'ifiok-digital-asset';
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('ok', `Download started for ${res.fileName} (signed 300s single-session token).`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Unable to generate download token.');
    } finally {
      setDownloadingAsset(false);
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
      setFExtra2('Beginner');
    } else if (activeTab === 'market') {
      setFCategory('digital');
      setFMarketSuite(MARKET_SUITES[0].id);
      setFExtra1(MARKET_SUITES[0].subcategories[0]);
      setFDeliveryMethod(DELIVERY_METHODS[0].id);
    } else if (activeTab === 'freelance') {
      setFCategory(FREELANCE_CATEGORIES[0]);
    } else if (activeTab === 'opportunities') {
      setFCategory('job');
    } else if (activeTab === 'community') {
      setFCategory('discussion');
      setFExtra1(COMMUNITY_SPACES[0]);
    }
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

  const parsedModulesNotes = fModulesNotes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|');
      return {
        topic: (parts[0] || '').trim(),
        notes: (parts.slice(1).join('|') || '').trim(),
      };
    });

  const courseCompletenessPreview = (() => {
    const syllabusCount = fExtra1.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const objCount = fObjectives.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const topicCount = parsedModulesNotes.filter((m) => m.topic.length >= 3).length;
    const noteCount = parsedModulesNotes.filter((m) => m.notes.length >= 15).length;
    const slideCount = fSlides.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const workbookCount = fWorkbooks.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const assignCount = fAssignments.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const quizCount = fQuizzes.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const examQCount = fExamQuestions.split('\n').map((s) => s.trim()).filter((s) => s.length >= 3).length;
    const checks = [
      fTitle.trim().length >= 5,
      fDescription.trim().length >= 30,
      fSubject.trim().length >= 2 || fCategory.trim().length >= 2,
      syllabusCount >= 2,
      objCount >= 2,
      topicCount >= 2,
      noteCount >= 1,
      fMediaUrl.trim().length >= 8 || fLockedContent.trim().length >= 12 || noteCount >= 2,
      slideCount >= 1 || fCourseFiles.length >= 1,
      workbookCount >= 1,
      assignCount >= 1,
      quizCount >= 1,
      examQCount >= 1,
      fAnswerKeys.trim().length >= 10 && fExamGuide.trim().length >= 12,
      fInstructorQual.trim().length >= 5,
      Number(fNum2) >= 1,
      (fExtra2 || 'Beginner').trim().length >= 3,
      fCourseLang.length >= 2,
      fPrerequisites.trim().length >= 3,
      fTargetAudience.trim().length >= 3,
      fCopyright.trim().length >= 5,
      fCertCriteria.trim().length >= 8,
    ];
    return checks.filter(Boolean).length;
  })();

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
        const syllabus = fExtra1.split('\n').map((s) => s.trim()).filter(Boolean);
        const learningObjectives = fObjectives.split('\n').map((s) => s.trim()).filter(Boolean);
        const slidesResources = fSlides.split('\n').map((s) => s.trim()).filter(Boolean);
        const workbooksExercises = fWorkbooks.split('\n').map((s) => s.trim()).filter(Boolean);
        const assignments = fAssignments.split('\n').map((s) => s.trim()).filter(Boolean);
        const quizzes = fQuizzes.split('\n').map((s) => s.trim()).filter(Boolean);
        const examQuestions = fExamQuestions.split('\n').map((s) => s.trim()).filter(Boolean);
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
            learningObjectives,
            modulesNotes: parsedModulesNotes,
            mediaLessonUrl: fMediaUrl,
            slidesResources,
            workbooksExercises,
            assignments,
            quizzes,
            examQuestions,
            answerKeysText: fAnswerKeys,
            examMarkingGuide: fExamGuide,
            instructorQualifications: fInstructorQual,
            prerequisites: fPrerequisites,
            targetAudience: fTargetAudience,
            copyrightPermission: fCopyright,
            certificateCriteria: fCertCriteria,
            courseFiles: fCourseFiles,
            imageUrl: fImageUrl,
            sourceOrigin: fSourceOrigin || 'Authorized Educational Material',
            sourceUrl: fSourceUrl,
            lockedMaterials: fLockedContent,
          }),
        });
        notify('ok', `Course submitted with status: ${res.approvalStatus} (${courseCompletenessPreview}/22 curriculum checklist).`);
      } else if (activeTab === 'business') {
        const res = await apiRequest<{ verificationStatus: string }>('/api/divisions/businesses', {
          method: 'POST',
          body: JSON.stringify({
            businessName: fTitle,
            sector: fCategory,
            hubCategory: fHubCategory,
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
            deliverables: fDeliverables,
            credentialsSummary: fCredentials,
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
            eligibility: fEligibility,
            deadline: fNum1 === '10' ? '2026-12-31' : fNum1 || '2026-12-31',
            description: fDescription,
            requirements: fEligibility || fDescription,
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
        const res = await apiRequest<{ approvalStatus: string; lifecycleStatus?: string }>('/api/divisions/products', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            productType: fCategory,
            marketSuite: fMarketSuite,
            category: fExtra1 || MARKET_SUITES[0].subcategories[0],
            description: fDescription,
            pricePi: Number(fNum1),
            stockQty: Number(fNum2) || 1,
            deliveryMethod: fDeliveryMethod,
            distributionPermission: fDistPermission,
            refundSupportTerms: fRefundTerms,
            version: fProductVersion || '1.0.0',
            supportInfo: fSupportInfo || fRefundTerms,
            creatorOwnershipAttested: fOwnershipAttested,
            lifecycleStatus: fSubmitLifecycle,
            fileStorageKey: fProductFile?.storageKey || '',
            fileOriginalName: fProductFile?.originalName || '',
            fileFormat: fProductFile?.fileFormat || '',
            fileSizeBytes: fProductFile?.fileSizeBytes || 0,
            fileSha256: fProductFile?.fileSha256 || '',
            imageUrl: fImageUrl,
            sourceOrigin: fSourceOrigin || 'Genuine Seller Submission',
            sourceUrl: fSourceUrl,
            lockedContent: fLockedContent,
          }),
        });
        notify(
          'ok',
          res.lifecycleStatus === 'draft'
            ? 'IFIOK DIGITAL draft saved. Submit it for verification from your Member Dashboard when ready.'
            : `Marketplace listing submitted (${res.lifecycleStatus || res.approvalStatus}).`
        );
      } else if (activeTab === 'community') {
        await apiRequest('/api/divisions/community/posts', {
          method: 'POST',
          body: JSON.stringify({
            title: fTitle,
            postType: fCategory,
            groupName: fExtra1 || COMMUNITY_SPACES[0],
            body: fDescription,
            eventDate: fEventDate,
            eventLocation: fEventLocation,
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

  const handleSubmitProductIpReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!ipReportProduct) return;
    setSubmittingIp(true);
    try {
      await apiRequest('/api/divisions/copyright-reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'product',
          targetId: ipReportProduct.id,
          reason: ipReason,
          details: ipDetails,
          evidenceUrl: ipEvidenceUrl,
        }),
      });
      notify('ok', `Copyright / IP report submitted for "${ipReportProduct.title}". Review queued.`);
      setIpReportProduct(null);
      setIpDetails('');
      setIpEvidenceUrl('');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Unable to submit IP report.');
    } finally {
      setSubmittingIp(false);
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
                <option value="All">All 20 Subjects</option>
                {ACADEMIC_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'business' && (
              <select
                value={hubCategoryFilter}
                onChange={(e) => setHubCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All Business Hub Categories</option>
                {BUSINESS_HUB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
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
                <option value="All">All 8 Freelance Categories</option>
                {FREELANCE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'opportunities' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All 7 Opportunity Types</option>
                {OPPORTUNITY_TYPES.map((ot) => (
                  <option key={ot.id} value={ot.id}>
                    {ot.label}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'market' && (
              <>
                <select
                  value={marketSuiteFilter}
                  onChange={(e) => {
                    setMarketSuiteFilter(e.target.value);
                    setMarketCategoryFilter('All');
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="all">All Market Suites (A–F & Physical)</option>
                  {MARKET_SUITES.map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      Suite {suite.code}: {suite.label}
                    </option>
                  ))}
                </select>
                <select
                  value={marketCategoryFilter}
                  onChange={(e) => setMarketCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="All">All Categories</option>
                  {(marketSuiteFilter === 'all'
                    ? MARKET_SUITES.flatMap((s) => [...s.subcategories])
                    : [...(MARKET_SUITES.find((s) => s.id === marketSuiteFilter)?.subcategories || [])]
                  ).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="All">All Fulfillment Formats</option>
                  <option value="digital">Digital Products & Software</option>
                  <option value="physical">Verified Physical Goods</option>
                  <option value="service">Digital Services</option>
                  <option value="web3">Web3 Products & Services</option>
                  <option value="pi_app">Verified Pi Apps</option>
                  <option value="gaming_asset">Blockchain Gaming Assets</option>
                </select>
              </>
            )}

            {activeTab === 'community' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="All">All 6 Community Spaces</option>
                {COMMUNITY_SPACES.map((space) => (
                  <option key={space} value={space}>
                    {space}
                  </option>
                ))}
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
            {/* ACADEMY (Unified Global Academy Hub: 20 Subjects, IFIOK Professor AI, Virtual Classroom, Schools, Certificates) */}
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
                          {b.hub_category || 'Verified SMEs'} · {b.sector} · {b.country} · {b.source_origin || 'Verified SME'}
                          {b.last_verified_at ? ` · Verified ${b.last_verified_at.slice(0, 10)}` : ''}
                        </div>
                        <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                          {b.business_name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{b.summary}</p>
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          <div>Services: {b.services_offered}</div>
                          {b.registration_number && <div className="font-mono">Reg ID: {b.registration_number}</div>}
                          {b.website && (
                            <div>
                              Website:{' '}
                              <a
                                href={b.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-700 dark:text-amber-400 hover:underline break-all"
                              >
                                {b.website}
                              </a>
                            </div>
                          )}
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
                    description="Publish verified services across Programming, Graphic Design, Website Development, Writing, Translation, Video Editing, Digital Marketing, or Consulting."
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
                            {s.deliverables && (
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                Deliverables: {s.deliverables}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              Specialist: {s.freelancer_name} ({s.freelancer_country})
                              {s.credentials_summary ? ` · ${s.credentials_summary}` : ''}
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
                    description="IFIOK-EN strictly forbids fake job offers, synthetic grants, or unverified scholarships. Verified organisations can submit real jobs, internships, scholarships, grants, fellowships, competitions, or partnerships for approval."
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
                        {o.eligibility && (
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            Eligibility: {o.eligibility}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Free to Apply · Not a Paid Product · Source: {o.source_origin || 'Issuing Organization Confirmed'}
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

            {/* MARKET · IFIOK DIGITAL */}
            {activeTab === 'market' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 max-w-3xl">
                    <div className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-amber-400">
                      IFIOK DIGITAL · Official Digital Products Department ({IFIOK_DIGITAL_CATEGORIES.length} Digital Categories)
                    </div>
                    <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                      Instant Encrypted Digital Vault &amp; Pi-Only Settlement
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      IFIOK-EN prioritizes instant, license-verified digital products across software, eBooks, academic notes, design kits, spreadsheets, and Web3 utilities. All uploaded digital files stay encrypted in private vault storage until Pi Testnet completion issues a signed 300-second download token.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1 text-right">
                    <div>Malware &amp; Signature Scan: Active</div>
                    <div>Settlement: Exclusive Pi Network (Testnet)</div>
                  </div>
                </div>

                {/* 12 Official IFIOK DIGITAL Categories Quick Filter */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    12 Official IFIOK DIGITAL Categories &amp; Verified Physical Commerce
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDigitalCatId('all');
                        setMarketSuiteFilter('all');
                        setMarketCategoryFilter('All');
                        setFilterValue('All');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        selectedDigitalCatId === 'all' && filterValue !== 'physical'
                          ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      All Products
                    </button>
                    {IFIOK_DIGITAL_12_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        title={cat.description}
                        onClick={() => {
                          setSelectedDigitalCatId(cat.id);
                          setMarketSuiteFilter('all');
                          setMarketCategoryFilter('All');
                          setFilterValue('All');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                          selectedDigitalCatId === cat.id
                            ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDigitalCatId('physical');
                        setMarketSuiteFilter('all');
                        setMarketCategoryFilter('All');
                        setFilterValue('physical');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        selectedDigitalCatId === 'physical' || filterValue === 'physical'
                          ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Verified Physical Goods
                    </button>
                  </div>
                </div>

                {(() => {
                  const filteredMarketProducts = [...products]
                    .filter((p) => {
                      if (selectedDigitalCatId === 'all' || selectedDigitalCatId === 'physical') return true;
                      const hay = `${p.title} ${p.category} ${p.market_suite} ${p.description}`.toLowerCase();
                      switch (selectedDigitalCatId) {
                        case 'ebooks_textbooks':
                          return hay.includes('ebook') || hay.includes('e-book') || hay.includes('guide') || hay.includes('textbook') || hay.includes('skills');
                        case 'study_exam_packs':
                          return hay.includes('study') || hay.includes('exam') || hay.includes('math') || hay.includes('practice');
                        case 'teacher_packs':
                          return hay.includes('teacher') || hay.includes('classroom') || hay.includes('rubric') || hay.includes('lesson');
                        case 'software_tools':
                          return hay.includes('software') || hay.includes('utility') || hay.includes('tool') || hay.includes('sdk');
                        case 'website_ui_kits':
                          return hay.includes('website') || hay.includes('ui') || hay.includes('theme') || hay.includes('starter kit');
                        case 'accounting_finance':
                          return hay.includes('accounting') || hay.includes('finance') || hay.includes('spreadsheet') || hay.includes('ledger');
                        case 'business_plans_cv':
                          return hay.includes('business') || hay.includes('entrepreneur') || hay.includes('cv') || hay.includes('resume');
                        case 'marketing_growth':
                          return hay.includes('marketing') || hay.includes('seo') || hay.includes('growth');
                        case 'design_branding':
                          return hay.includes('design') || hay.includes('branding') || hay.includes('creative') || hay.includes('presentation');
                        case 'audio_media':
                          return hay.includes('audio') || hay.includes('video') || hay.includes('media') || hay.includes('preset');
                        case 'web3_pi_apps':
                          return hay.includes('web3') || hay.includes('pi') || hay.includes('blockchain');
                        case 'creator_collectibles':
                          return hay.includes('collectible') || hay.includes('creator') || hay.includes('gaming');
                        default:
                          return true;
                      }
                    })
                    .sort((a, b) => (a.product_type === 'physical' ? 1 : 0) - (b.product_type === 'physical' ? 1 : 0));

                  return filteredMarketProducts.length === 0 ? (
                    <EmptyDivisionState
                      title="No approved IFIOK DIGITAL or marketplace products match this filter"
                      description="IFIOK Market never publishes fake products, synthetic prices, or unverified sellers. Try clearing filters or list a licensed digital package."
                      actionLabel={selectedDigitalCatId !== 'all' ? 'Show All Products' : 'Register Seller Storefront'}
                      onAction={() => {
                        if (selectedDigitalCatId !== 'all') {
                          setSelectedDigitalCatId('all');
                          setMarketSuiteFilter('all');
                          setMarketCategoryFilter('All');
                          setFilterValue('All');
                        } else {
                          handleOpenCreate('onboarding');
                        }
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredMarketProducts.map((p) => {
                      const price = formatPiPrice(p.price_pi, currency, usdRate);
                      const suiteInfo = MARKET_SUITES.find((ms) => ms.id === p.market_suite);
                      const deliveryLabel = DELIVERY_METHODS.find((dm) => dm.id === p.delivery_method)?.label || p.delivery_method;
                      const isDigital = p.product_type !== 'physical';
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
                                {isDigital ? 'IFIOK DIGITAL · ' : ''}
                                {suiteInfo ? `Suite ${suiteInfo.code}: ${suiteInfo.label}` : p.product_type.replace('_', ' ')} · {p.category} ·{' '}
                                {p.availability_status || 'available'} · Stock {p.stock_qty}
                                {p.lifecycle_status && p.lifecycle_status !== 'published' ? ` · ${p.lifecycle_status.replace(/_/g, ' ')}` : ''}
                              </div>
                              <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">{p.title}</h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{p.description}</p>
                              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                                <div>
                                  Seller: {p.store_name} ({p.seller_country})
                                </div>
                                {isDigital && (
                                  <div className="font-mono text-[11px]">
                                    v{p.version || '1.0.0'}
                                    {p.file_format ? ` · ${p.file_format}` : ''}
                                    {p.file_size_bytes ? ` (${(p.file_size_bytes / 1024).toFixed(0)} KB)` : ''}
                                    {p.malware_scan_status && p.malware_scan_status !== 'not_uploaded'
                                      ? ` · Scan: ${p.malware_scan_status}`
                                      : ''}
                                    {typeof p.download_count === 'number' && p.download_count > 0
                                      ? ` · ${p.download_count} downloads`
                                      : ''}
                                  </div>
                                )}
                                {deliveryLabel && <div>Delivery: {deliveryLabel}</div>}
                                <div>
                                  Origin: {p.source_origin || 'Seller Submission'}
                                  {p.last_verified_at ? ` · Verified ${p.last_verified_at.slice(0, 10)}` : ''}
                                </div>
                                {p.distribution_permission && <div>Rights: {p.distribution_permission}</div>}
                              </div>
                              {isDigital && (
                                <div className="flex items-center justify-between pt-1 text-xs">
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                    <Lock className="w-3.5 h-3.5" /> Locked until Pi verified
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
                          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div>
                              <div className="font-mono font-bold tabular-nums text-slate-950 dark:text-amber-400">{price.primary}</div>
                              {price.reference && <div className="text-[11px] font-mono tabular-nums text-slate-500">{price.reference}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailProduct(p)}
                                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                disabled={p.stock_qty < 1 || p.availability_status === 'out_of_stock'}
                                onClick={() => addToCart(p)}
                                className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-40"
                              >
                                {p.stock_qty < 1 || p.availability_status === 'out_of_stock' ? 'Out of Stock' : 'Add to Pi Cart'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* COMMUNITY */}
            {activeTab === 'community' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-4">
                  <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                    Community Discussions, Mentorship & Verified Events
                  </h3>
                  {posts.length === 0 ? (
                    <EmptyDivisionState
                      title="No community posts published yet"
                      description="Start a constructive discussion, business collaboration thread, developer group topic, or verified event announcement with global IFIOK-EN members."
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
                        {(post.event_date || post.event_location) && (
                          <div className="text-xs font-mono text-purple-700 dark:text-amber-400">
                            {post.event_date ? `Event Date: ${post.event_date}` : ''}
                            {post.event_date && post.event_location ? ' · ' : ''}
                            {post.event_location ? `Location: ${post.event_location}` : ''}
                          </div>
                        )}
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
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
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
                          ? 'Fulfillment Format'
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
                        {FREELANCE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}
                    {activeTab === 'opportunities' && (
                      <select
                        value={fCategory}
                        onChange={(e) => setFCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        {OPPORTUNITY_TYPES.map((ot) => (
                          <option key={ot.id} value={ot.id}>
                            {ot.label}
                          </option>
                        ))}
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
                        <option value="announcement">Announcement / Event</option>
                        <option value="collaboration">Collaboration</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {activeTab === 'opportunities'
                        ? 'Organization Name'
                        : activeTab === 'community'
                          ? 'Community Space'
                          : activeTab === 'market'
                            ? 'Market Suite (A–F & Physical)'
                            : 'Price in Pi (π)'}
                    </label>
                    {activeTab === 'opportunities' ? (
                      <input
                        type="text"
                        required
                        value={fExtra1}
                        onChange={(e) => setFExtra1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    ) : activeTab === 'community' ? (
                      <select
                        value={fExtra1 || COMMUNITY_SPACES[0]}
                        onChange={(e) => setFExtra1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        {COMMUNITY_SPACES.map((space) => (
                          <option key={space} value={space}>
                            {space}
                          </option>
                        ))}
                      </select>
                    ) : activeTab === 'market' ? (
                      <select
                        value={fMarketSuite}
                        onChange={(e) => {
                          const nextSuiteId = e.target.value;
                          setFMarketSuite(nextSuiteId);
                          const matchedSuite = MARKET_SUITES.find((ms) => ms.id === nextSuiteId);
                          if (matchedSuite) setFExtra1(matchedSuite.subcategories[0]);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        {MARKET_SUITES.map((ms) => (
                          <option key={ms.id} value={ms.id}>
                            Suite {ms.code}: {ms.label}
                          </option>
                        ))}
                      </select>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Hub Category</label>
                    <select
                      value={fHubCategory}
                      onChange={(e) => setFHubCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    >
                      {BUSINESS_HUB_CATEGORIES.map((hc) => (
                        <option key={hc} value={hc}>
                          {hc}
                        </option>
                      ))}
                    </select>
                  </div>
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

              {activeTab === 'freelance' && subMode === 'primary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Deliverables Included</label>
                    <input
                      type="text"
                      value={fDeliverables}
                      onChange={(e) => setFDeliverables(e.target.value)}
                      placeholder="Source repository, deployment docs & 2 revisions"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Delivery Timeline (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={fNum2}
                      onChange={(e) => setFNum2(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Credentials & Portfolio Summary</label>
                    <input
                      type="text"
                      value={fCredentials}
                      onChange={(e) => setFCredentials(e.target.value)}
                      placeholder="Verified specialist background or portfolio reference"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'market' && subMode === 'primary' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Suite Sub-Category</label>
                      <select
                        value={fExtra1}
                        onChange={(e) => setFExtra1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        {(MARKET_SUITES.find((ms) => ms.id === fMarketSuite)?.subcategories || []).map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Delivery Method</label>
                      <select
                        value={fDeliveryMethod}
                        onChange={(e) => setFDeliveryMethod(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      >
                        {DELIVERY_METHODS.map((dm) => (
                          <option key={dm.id} value={dm.id}>
                            {dm.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                      <label className="block text-xs font-medium mb-1">Stock / License Units</label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Ownership / Distribution Permission (Required)
                      </label>
                      <input
                        type="text"
                        required
                        minLength={5}
                        value={fDistPermission}
                        onChange={(e) => setFDistPermission(e.target.value)}
                        placeholder="Original Creator Copyright / Authorized Reseller License"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Refund & Support Terms (Required)
                      </label>
                      <input
                        type="text"
                        required
                        minLength={8}
                        value={fRefundTerms}
                        onChange={(e) => setFRefundTerms(e.target.value)}
                        placeholder="14-day verified Pi dispute & defective license support"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Version / Release Tag</label>
                      <input
                        type="text"
                        value={fProductVersion}
                        onChange={(e) => setFProductVersion(e.target.value)}
                        placeholder="1.0.0"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Buyer Support &amp; Updates Contact</label>
                      <input
                        type="text"
                        value={fSupportInfo}
                        onChange={(e) => setFSupportInfo(e.target.value)}
                        placeholder="Lifetime patch updates & 48h ticket support"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-3 space-y-2">
                    <label className="block text-xs font-medium">
                      IFIOK DIGITAL Private Asset Vault Upload (PDF, ZIP, DOCX, XLSX, PPTX, MP3, MP4 — max 15 MB, scanned)
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,.zip,.docx,.xlsx,.pptx,.mp3,.mp4,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadProductFile(file);
                        }}
                        className="text-xs"
                      />
                      {uploadingProductFile && <span className="text-xs text-slate-500">Scanning &amp; encrypting...</span>}
                      {fProductFile && (
                        <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                          {fProductFile.originalName} ({fProductFile.fileFormat} · {(fProductFile.fileSizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={fOwnershipAttested}
                      onChange={(e) => setFOwnershipAttested(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I attest that I hold full original copyright or authorized commercial redistribution rights to this product and it contains no malware or pirated assets.
                    </span>
                  </label>
                </div>
              )}

              {activeTab === 'opportunities' && (
                <div className="space-y-3">
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
                  <div>
                    <label className="block text-xs font-medium mb-1">Eligibility Criteria</label>
                    <input
                      type="text"
                      value={fEligibility}
                      onChange={(e) => setFEligibility(e.target.value)}
                      placeholder="Open to international students, builders, or qualified applicants"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'community' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Event Date (Optional, for Events/Sessions)</label>
                    <input
                      type="text"
                      value={fEventDate}
                      onChange={(e) => setFEventDate(e.target.value)}
                      placeholder="2026-11-30 16:00 UTC"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Event Location / Online Room (Optional)</label>
                    <input
                      type="text"
                      value={fEventLocation}
                      onChange={(e) => setFEventLocation(e.target.value)}
                      placeholder="Virtual Session / London Hub"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              )}

              {subMode === 'onboarding' && (
                <div className="space-y-3">
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
                  {activeTab === 'academy' && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Verified Credentials & Qualifications</label>
                      <input
                        type="text"
                        required
                        value={fExtra2}
                        onChange={(e) => setFExtra2(e.target.value)}
                        placeholder="MSc Computer Science / Certified Instructor"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description / Details
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={15}
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              {activeTab === 'academy' && subMode === 'primary' && (
                <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#081024] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      IFIOK SCHOOL 22-Point Paid Course Readiness
                    </span>
                    <span className="font-mono tabular-nums text-xs font-bold text-purple-700 dark:text-amber-400">
                      {courseCompletenessPreview}/22 checks complete
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Academic Subject</label>
                      <select
                        value={fSubject}
                        onChange={(e) => {
                          setFSubject(e.target.value);
                          setFCategory(e.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-2.5 py-1.5 text-xs"
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
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-2.5 py-1.5 text-xs"
                      >
                        {LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.nativeLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Level</label>
                      <select
                        value={fExtra2 || 'Beginner'}
                        onChange={(e) => setFExtra2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-2.5 py-1.5 text-xs"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Duration (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={fNum2}
                        onChange={(e) => setFNum2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Issuing Organization</label>
                      <input
                        type="text"
                        value={fIssuingOrg}
                        onChange={(e) => setFIssuingOrg(e.target.value)}
                        placeholder="IFIOK SCHOOL"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Instructor Qualifications</label>
                      <input
                        type="text"
                        value={fInstructorQual}
                        onChange={(e) => setFInstructorQual(e.target.value)}
                        placeholder="Degree, teaching certification, industry experience"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Syllabus Outline (2+ lines)</label>
                      <textarea
                        rows={2}
                        value={fExtra1}
                        onChange={(e) => setFExtra1(e.target.value)}
                        placeholder={'Module 1: Foundations\nModule 2: Applied Labs'}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Learning Objectives (2+ lines)</label>
                      <textarea
                        rows={2}
                        value={fObjectives}
                        onChange={(e) => setFObjectives(e.target.value)}
                        placeholder={'Design secure workflows\nBuild and audit applications'}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Module Topics & Prepared Lesson Notes (2+ lines, format: Topic | Detailed Lesson Notes)
                    </label>
                    <textarea
                      rows={2}
                      value={fModulesNotes}
                      onChange={(e) => setFModulesNotes(e.target.value)}
                      placeholder={'Module 1 Architecture | Step-by-step study notes covering core protocols and worked examples.\nModule 2 Security | Detailed lesson guide on validation, authorization, and edge cases.'}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Teaching Video / Lesson Media URL</label>
                      <input
                        type="url"
                        value={fMediaUrl}
                        onChange={(e) => setFMediaUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Prerequisites</label>
                      <input
                        type="text"
                        value={fPrerequisites}
                        onChange={(e) => setFPrerequisites(e.target.value)}
                        placeholder="Basic digital literacy or introductory algebra"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Target Audience / Grade Level</label>
                    <input
                      type="text"
                      value={fTargetAudience}
                      onChange={(e) => setFTargetAudience(e.target.value)}
                      placeholder="Secondary School (Grades 10-12), University Undergraduates, or SME Founders"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Slides / Resources (1+ line)</label>
                      <textarea
                        rows={2}
                        value={fSlides}
                        onChange={(e) => setFSlides(e.target.value)}
                        placeholder="Lecture Deck PDF & Reference Handouts"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Practical Workbooks &amp; Exercises (1+ line)</label>
                      <textarea
                        rows={2}
                        value={fWorkbooks}
                        onChange={(e) => setFWorkbooks(e.target.value)}
                        placeholder="Workbook Exercise 1: Guided Lab Practice"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Assignments (1+ line)</label>
                      <textarea
                        rows={2}
                        value={fAssignments}
                        onChange={(e) => setFAssignments(e.target.value)}
                        placeholder="Week 1 Applied Exercise"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Quizzes (1+ line)</label>
                      <textarea
                        rows={2}
                        value={fQuizzes}
                        onChange={(e) => setFQuizzes(e.target.value)}
                        placeholder="Module 1 Diagnostic Quiz"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Examination Questions (1+ line)</label>
                      <textarea
                        rows={2}
                        value={fExamQuestions}
                        onChange={(e) => setFExamQuestions(e.target.value)}
                        placeholder="Final Exam Q1: Core System Design Case"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Answer Keys (min 10 chars)</label>
                      <textarea
                        rows={2}
                        value={fAnswerKeys}
                        onChange={(e) => setFAnswerKeys(e.target.value)}
                        placeholder="Q1 Answer: Key architectural steps & formula solution..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Marking Guide &amp; Rubric (min 12 chars)</label>
                      <textarea
                        rows={2}
                        value={fExamGuide}
                        onChange={(e) => setFExamGuide(e.target.value)}
                        placeholder="Final assessment rubric, pass threshold (70%), and grading weights..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-3 space-y-2">
                    <label className="block text-xs font-medium">
                      Attach Private Course Files (PDF, DOCX, PPTX, ZIP, MP3, MP4 — encrypted until Pi payment / enrolment)
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,.zip,.docx,.xlsx,.pptx,.mp3,.mp4,.txt,.md,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadCourseFile(file);
                        }}
                        className="text-xs"
                      />
                      {uploadingCourseFile && <span className="text-xs text-slate-500">Scanning file...</span>}
                    </div>
                    {fCourseFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {fCourseFiles.map((cf, idx) => (
                          <span key={cf.storageKey} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
                            {cf.originalName} ({cf.fileFormat})
                            <button
                              type="button"
                              onClick={() => setFCourseFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-rose-500 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Copyright / Distribution Permission</label>
                      <input
                        type="text"
                        value={fCopyright}
                        onChange={(e) => setFCopyright(e.target.value)}
                        placeholder="Original Author License for IFIOK SCHOOL"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Completion & Certificate Criteria</label>
                      <input
                        type="text"
                        value={fCertCriteria}
                        onChange={(e) => setFCertCriteria(e.target.value)}
                        placeholder="100% syllabus completion + >=70% exam score"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] px-3 py-1.5 text-xs"
                      />
                    </div>
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
                          placeholder="Download link, license instructions, or protected course materials..."
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                {activeTab === 'market' && subMode === 'primary' && (
                  <button
                    type="submit"
                    onClick={() => setFSubmitLifecycle('draft')}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Save as Draft
                  </button>
                )}
                <button
                  type="submit"
                  onClick={() => setFSubmitLifecycle('submitted')}
                  className="px-5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  {activeTab === 'market' && subMode === 'primary' ? 'Submit for Verification' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARKET PRODUCT DETAIL & PROVENANCE MODAL */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {MARKET_SUITES.find((ms) => ms.id === detailProduct.market_suite)?.label || detailProduct.product_type} ·{' '}
                  {detailProduct.category}
                </div>
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white mt-0.5">
                  {detailProduct.title}
                </h3>
              </div>
              <button type="button" onClick={() => setDetailProduct(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{detailProduct.description}</p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4 space-y-2 text-xs">
              <div>
                <span className="text-slate-500">Verified Seller:</span>{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {detailProduct.store_name} ({detailProduct.seller_country})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Source Origin:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">{detailProduct.source_origin || 'Seller Submission'}</span>
                {detailProduct.source_url && (
                  <>
                    {' · '}
                    <a
                      href={detailProduct.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-700 dark:text-amber-400 hover:underline"
                    >
                      Source Reference
                    </a>
                  </>
                )}
              </div>
              <div>
                <span className="text-slate-500">Ownership / Distribution Permission:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">
                  {detailProduct.distribution_permission || 'Verified seller distribution rights'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Delivery Method:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">
                  {DELIVERY_METHODS.find((dm) => dm.id === detailProduct.delivery_method)?.label ||
                    detailProduct.delivery_method ||
                    'Verified fulfillment'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Availability & Stock:</span>{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {detailProduct.availability_status || 'available'} ({detailProduct.stock_qty} units)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Refund &amp; Support Terms:</span>{' '}
                <span className="text-slate-800 dark:text-slate-200">
                  {detailProduct.support_info || detailProduct.refund_support_terms || 'Covered by IFIOK-EN Pi Dispute Policy'}
                </span>
              </div>
              {detailProduct.product_type !== 'physical' && (
                <div>
                  <span className="text-slate-500">Digital Package:</span>{' '}
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    v{detailProduct.version || '1.0.0'}
                    {detailProduct.file_format ? ` · ${detailProduct.file_format}` : ''}
                    {detailProduct.file_size_bytes ? ` (${(detailProduct.file_size_bytes / 1024).toFixed(1)} KB)` : ''}
                    {detailProduct.malware_scan_status ? ` · Scan: ${detailProduct.malware_scan_status}` : ''}
                    {detailProduct.lifecycle_status ? ` · Lifecycle: ${detailProduct.lifecycle_status}` : ''}
                  </span>
                </div>
              )}
              {detailProduct.last_verified_at && (
                <div>
                  <span className="text-slate-500">Last Verified:</span>{' '}
                  <span className="font-mono text-slate-800 dark:text-slate-200">{detailProduct.last_verified_at}</span>
                </div>
              )}
              {(() => {
                try {
                  const highlights = JSON.parse(detailProduct.preview_images_json || '[]') as unknown;
                  if (Array.isArray(highlights) && highlights.length > 0 && typeof highlights[0] === 'string') {
                    return (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 mb-1">Included Package Contents & Highlights:</div>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-800 dark:text-slate-200">
                          {(highlights as string[]).map((h, idx) => (
                            <li key={`hl-${idx}`}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                } catch {
                  // ignore non-JSON
                }
                return null;
              })()}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-mono text-lg font-bold text-slate-950 dark:text-amber-400">
                  {formatPiPrice(detailProduct.price_pi, currency, usdRate).primary}
                </div>
                {formatPiPrice(detailProduct.price_pi, currency, usdRate).reference && (
                  <div className="text-[11px] font-mono text-slate-500">
                    {formatPiPrice(detailProduct.price_pi, currency, usdRate).reference}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!user) return onRequireAuth();
                    setIpReportProduct(detailProduct);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report IP</span>
                </button>
                {detailProduct.product_type !== 'physical' && (
                  <button
                    type="button"
                    onClick={() => handleAccessUnlocked('product', detailProduct.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Access Content</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={detailProduct.stock_qty < 1 || detailProduct.availability_status === 'out_of_stock'}
                  onClick={() => {
                    addToCart(detailProduct);
                    setDetailProduct(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  {detailProduct.stock_qty < 1 || detailProduct.availability_status === 'out_of_stock'
                    ? 'Out of Stock'
                    : 'Add to Pi Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COPYRIGHT / IP REPORT MODAL */}
      {ipReportProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">Report Copyright / IP Issue</h3>
              <button type="button" onClick={() => setIpReportProduct(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Target: <strong className="text-slate-900 dark:text-white">{ipReportProduct.title}</strong>
            </p>
            <form onSubmit={handleSubmitProductIpReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Claim Type / Reason</label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={ipReason}
                  onChange={(e) => setIpReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Details & Ownership Basis</label>
                <textarea
                  rows={3}
                  required
                  minLength={15}
                  value={ipDetails}
                  onChange={(e) => setIpDetails(e.target.value)}
                  placeholder="Describe the infringed copyrighted material or trademark claim..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Evidence URL (Optional)</label>
                <input
                  type="url"
                  value={ipEvidenceUrl}
                  onChange={(e) => setIpEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submittingIp}
                className="w-full py-2.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submittingIp ? 'Submitting Notice...' : 'Submit Takedown Notice'}
              </button>
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
            <div className="rounded-lg bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {unlockedPreview.content}
            </div>
            {unlockedPreview.itemType === 'product' && unlockedPreview.hasFile && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {unlockedPreview.fileOriginalName || 'Digital Product Package'}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    v{unlockedPreview.version || '1.0.0'}
                    {unlockedPreview.fileFormat ? ` · ${unlockedPreview.fileFormat}` : ''}
                    {unlockedPreview.fileSizeBytes ? ` (${(unlockedPreview.fileSizeBytes / 1024).toFixed(1)} KB)` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingAsset}
                  onClick={() => handleDownloadEntitlementFile('product', unlockedPreview.itemId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingAsset ? 'Preparing Token...' : 'Download Verified File'}</span>
                </button>
              </div>
            )}
            {unlockedPreview.itemType === 'course' && unlockedPreview.courseFiles && unlockedPreview.courseFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Unlocked Course Vault Materials
                </div>
                {unlockedPreview.courseFiles.map((cf) => (
                  <div
                    key={cf.storageKey}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-mono truncate">
                      {cf.originalName} {cf.fileFormat ? `(${cf.fileFormat})` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={downloadingAsset}
                      onClick={() => handleDownloadEntitlementFile('course', unlockedPreview.itemId, cf.storageKey)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
