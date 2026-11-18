import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  Globe,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Users,
} from 'lucide-react';
import { useRef, useState } from 'react';
import academyImg from '../assets/images/academy_blockchain_course_1794641802089.jpg';
import businessImg from '../assets/images/business_hub_advisory_1794641802926.jpg';
import communityImg from '../assets/images/community_summit_collab_1794641802970.jpg';
import heroImg from '../assets/images/hero_global_network_1794641803186.jpg';
import marketImg from '../assets/images/market_digital_commerce_1794641803851.jpg';
import { apiRequest } from '../lib/api.ts';
import { formatPiPrice, getLanguageAvailabilitySummary, LANGUAGE_OPTIONS, TRANSLATIONS } from '../lib/i18n.ts';
import type { PiAuthSession } from '../lib/pi.ts';
import type {
  AcademySubView,
  AppView,
  CurrencyCode,
  DivisionTab,
  LanguageCode,
  PublicSummary,
  UserProfile,
} from '../types/platform.ts';
import { BrandLogo } from './BrandLogo.tsx';
import type { PolicyKey } from './LegalModal.tsx';

interface HomePageProps {
  summary: PublicSummary | null;
  loading: boolean;
  user: UserProfile | null;
  piAuth: PiAuthSession | null;
  theme: 'light' | 'dark';
  language: LanguageCode;
  currency: CurrencyCode;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: LanguageCode) => void;
  onChangeCurrency: (curr: CurrencyCode) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenDivision: (tab: DivisionTab, academySubView?: AcademySubView) => void;
  onNavigateView: (view: AppView) => void;
  onOpenPolicy: (policy: PolicyKey) => void;
  onUnlockAdmin: () => void;
  onConnectPi: () => Promise<void>;
  onLogoutPi: () => Promise<void>;
}

const FAQS = [
  {
    q: 'How does Pi Network integration work on IFIOK-EN?',
    a: 'IFIOK-EN integrates the Official Pi SDK in Testnet mode for authentication and eligible transactions. Every payment is initiated via Pi Browser, approved on our server, and verified against Pi Platform APIs before orders or enrolments are fulfilled. Mainnet stays disabled until official approvals and credentials are active.',
  },
  {
    q: 'Are jobs, grants, courses, and marketplace products vetted?',
    a: 'Yes. IFIOK-EN enforces strict server-side moderation and verification queues. We never publish fabricated listings, fake sellers, or simulated reviews. Only verified organisations, instructors, freelancers, and sellers appear publicly.',
  },
  {
    q: 'Can I browse IFIOK-EN outside Pi Browser?',
    a: 'Yes. Visitors worldwide can browse public courses, verified business profiles, opportunities, and marketplace catalogs from any desktop or mobile browser. Account sign-in and all platform transactions execute exclusively via Official Pi SDK inside Pi Browser.',
  },
  {
    q: 'What is the platform revenue model?',
    a: 'IFIOK-EN sustains operations transparently through optional creator and business subscriptions, verified course enrolments, and disclosed commissions on completed freelance and marketplace transactions. We never promise guaranteed earnings or investment returns.',
  },
];

export function HomePage({
  summary,
  loading,
  user,
  piAuth,
  theme,
  language,
  currency,
  onToggleTheme,
  onChangeLanguage,
  onChangeCurrency,
  onOpenAuth,
  onOpenDivision,
  onNavigateView,
  onOpenPolicy,
  onUnlockAdmin,
  onConnectPi,
  onLogoutPi,
}: HomePageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; title: string; subtitle: string; pricePi: number | null; source_origin?: string; division: DivisionTab }>
  >([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [tapToast, setTapToast] = useState(false);
  const [piLoading, setPiLoading] = useState(false);
  const [piHeroError, setPiHeroError] = useState<string | null>(null);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);
  const t = TRANSLATIONS[language];
  const usdRate = summary?.settings.informationalUsdPerPi ?? 1.0;

  const handleHeroPiConnect = async () => {
    setPiHeroError(null);
    setPiLoading(true);
    try {
      await onConnectPi();
    } catch (err) {
      setPiHeroError(err instanceof Error ? err.message : 'Unable to sign in with Pi.');
    } finally {
      setPiLoading(false);
    }
  };

  const handleFooterLogoTap = () => {
    const now = Date.now();
    if (lastTapRef.current > 0 && now - lastTapRef.current > 5000) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;

    if (tapTimerRef.current !== null) {
      window.clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current === 3) {
      setTapToast(true);
    }

    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      lastTapRef.current = 0;
      tapTimerRef.current = null;
      setTapToast(false);
      onUnlockAdmin();
      return;
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      lastTapRef.current = 0;
      tapTimerRef.current = null;
      setTapToast(false);
    }, 5000);
  };

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await apiRequest<{
        results: Array<{
          id: number;
          title: string;
          subtitle: string;
          pricePi: number | null;
          source_origin?: string;
          division: DivisionTab;
        }>;
      }>(`/api/divisions/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.results);
      setHasSearched(true);
    } catch {
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 dark:bg-[#070C1B] text-slate-900 dark:text-slate-100">
      {/* Optional admin announcement strip */}
      {summary?.settings.announcementBanner && (
        <div className="bg-[#0E1A36] dark:bg-purple-950/80 text-amber-300 text-xs font-medium py-2 px-4 text-center border-b border-amber-500/20">
          {summary.settings.announcementBanner}
        </div>
      )}

      {/* HERO SECTION */}
      <section className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081024]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left focal narrative */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <BrandLogo size="lg" />
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{t.slogan}</span>
                  <span aria-hidden="true">·</span>
                  <span>Pi Network Exclusive (Testnet)</span>
                </div>
              </div>

              <h1
                className="font-display font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
              >
                {summary?.settings.heroHeadline || 'Your World. Your Opportunities. Your Digital Future.'}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                {summary?.settings.heroSubheadline ||
                  'IFIOK-EN connects global learners, verified SMEs, independent talent, and Pi-settled digital commerce inside one audited, role-governed platform.'}
              </p>

              {/* Global Cross-Division Search Bar */}
              <div className="space-y-2 max-w-xl">
                <form onSubmit={handleGlobalSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={globalQuery}
                      onChange={(e) => {
                        setGlobalQuery(e.target.value);
                        if (!e.target.value.trim()) setHasSearched(false);
                      }}
                      placeholder="Search verified courses, products, SMEs, freelance, grants..."
                      aria-label="Search across all IFIOK-EN divisions"
                      className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1530] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-5 py-3 rounded-lg text-sm font-semibold bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {hasSearched && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D152B] shadow-lg divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
                        No verified listings match "{globalQuery}". Only vetted, genuine catalog items are indexed.
                      </div>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={`${item.division}-${item.id}`}
                          type="button"
                          onClick={() => onOpenDivision(item.division)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                              {item.division === 'academy' ? 'IFIOK SCHOOL' : item.division} · {item.subtitle}
                              {item.source_origin ? ` · ${item.source_origin}` : ''}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                            {item.pricePi !== null ? `${item.pricePi} π` : 'Open'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Primary + Secondary CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {piAuth ? (
                  <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Welcome @{piAuth.username}</span>
                    <button
                      type="button"
                      onClick={() => void onLogoutPi()}
                      className="inline-flex items-center gap-1 ml-1 px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleHeroPiConnect}
                    disabled={piLoading}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-bold bg-gradient-to-r from-[#4C1D95] to-[#0E1A36] hover:from-[#5B21B6] hover:to-[#172952] dark:from-amber-500 dark:to-amber-400 text-white dark:text-slate-950 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>{piLoading ? 'Signing in...' : 'Sign in with Pi'}</span>
                  </button>
                )}

                {user && (
                  <button
                    type="button"
                    onClick={() => onNavigateView('dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-[#0E1A36] text-white hover:bg-[#192C58] dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    Open Member Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('divisions-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    else onOpenDivision('academy');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.exploreBtn}
                </button>
              </div>

              {piHeroError && (
                <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs text-rose-800 dark:text-rose-200">
                  {piHeroError}
                </div>
              )}

              {/* Compact utility controls (Theme + Language + Reference Currency) */}
              <div className="pt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="inline-flex items-center gap-1.5 font-medium hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                </button>
                <span aria-hidden="true">·</span>
                <label className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <select
                    aria-label="Select Language"
                    value={language}
                    onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
                    className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code} className="dark:bg-[#0D152B]">
                        {l.nativeLabel} ({l.label})
                      </option>
                    ))}
                  </select>
                </label>
                <span aria-hidden="true">·</span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Ref Display:</span>
                  <select
                    aria-label="Select Informational Reference Currency"
                    value={currency}
                    onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
                    className="bg-transparent font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="PI" className="dark:bg-[#0D152B]">Pi (π) Native</option>
                    <option value="USD" className="dark:bg-[#0D152B]">Pi + USD info</option>
                    <option value="EUR" className="dark:bg-[#0D152B]">Pi + EUR info</option>
                    <option value="GBP" className="dark:bg-[#0D152B]">Pi + GBP info</option>
                    <option value="NGN" className="dark:bg-[#0D152B]">Pi + NGN info</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Right 16:9 / full-height hero media carrier */}
            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] lg:min-h-[430px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-[#0E1A36] via-[#2B1B54] to-[#081024]">
                <img
                  src={heroImg}
                  alt="International entrepreneurs and engineers collaborating inside the IFIOK-EN innovation pavilion"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4 text-white">
                  <div>
                    <p className="text-xs font-medium text-amber-300">Pi Network Exclusive Settlement</p>
                    <p className="text-sm sm:text-base font-display font-semibold mt-0.5">
                      Six integrated divisions settled exclusively in Pi (Testnet Active)
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-200 tabular-nums">
                    <div>Payment Method: Pi Network Only</div>
                    <div>Paid Access: Auto-Locked Until Verified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width database-backed telemetry strip below hero split */}
          <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { label: 'Active Members', value: summary?.stats.members ?? 0 },
              { label: 'Verified Businesses', value: summary?.stats.verifiedBusinesses ?? 0 },
              { label: 'IFIOK SCHOOL Courses', value: summary?.stats.approvedCourses ?? 0 },
              { label: 'Freelance Services', value: summary?.stats.approvedServices ?? 0 },
              { label: 'Open Opportunities', value: summary?.stats.approvedOpportunities ?? 0 },
              { label: 'Market Listings', value: summary?.stats.approvedProducts ?? 0 },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-950 dark:text-white">
                  {loading ? '—' : stat.value}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIX BUSINESS DIVISIONS (Asymmetric Bento Grid) */}
      <section id="divisions-section" className="py-16 lg:py-24 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold text-purple-700 dark:text-amber-400 mb-2">Integrated Ecosystem Architecture</p>
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-950 dark:text-white">
            Six specialized divisions built for real participation
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">
            Every division connects to one unified account, role-based dashboard, and server-verified Pi settlement ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 01. IFIOK SCHOOL (Span 2 on lg for visual hierarchy) */}
          <article className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 sm:grid-cols-2">
            <div className="h-56 sm:h-auto bg-slate-900">
              <img
                src={academyImg}
                alt="IFIOK SCHOOL — Global Digital Learning instruction session"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <BookOpen className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                  <span>01. IFIOK SCHOOL — Global Digital Learning</span>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-950 dark:text-white">
                  Learn Without Borders. Grow Without Limits.
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Serving individual students worldwide, primary & secondary schools, colleges, training institutions, independent educators, and adult lifelong learners across 20 subjects and {getLanguageAvailabilitySummary().fullUiLanguagesCount} verified languages with 22-point curricula and IFIOK Professor AI.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => onOpenDivision('academy', 'courses')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Explore IFIOK SCHOOL <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy', 'student_portal')}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                  >
                    IFIOK Student Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy', 'teacher_portal')}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                  >
                    IFIOK Teacher Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy', 'schools')}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                  >
                    {t.schoolPortalTitle}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy', 'guardian_portal')}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                  >
                    IFIOK Parent/Guardian Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy', 'professor')}
                    className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    IFIOK Professor AI Learning Portal
                  </button>
                </div>
              </div>
            </div>
          </article>

          {/* 02. IFIOK BUSINESS HUB */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden flex flex-col">
            <div className="h-44 bg-slate-900">
              <img
                src={businessImg}
                alt="IFIOK Business Hub executive advisory consultation"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Building2 className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                  <span>02. IFIOK Business Hub</span>
                </div>
                <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                  Verified SME directory & corporate consulting
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Business registration assistance, verified SME profiles, promotion, and cross-border partnership matching.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDivision('business')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Open Business Hub <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          {/* 03. IFIOK FREELANCE */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Briefcase className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                <span>03. IFIOK Freelance</span>
              </div>
              <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                Commissioned digital services & tracked delivery
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Software development, design, writing, translation, and consulting with structured project milestones and dispute governance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenDivision('freelance')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Browse Services <ArrowRight className="w-4 h-4" />
            </button>
          </article>

          {/* 04. IFIOK OPPORTUNITIES */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                <span>04. IFIOK Opportunities</span>
              </div>
              <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                Vetted jobs, scholarships, grants, fellowships & competitions
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Every listing undergoes administrator verification before publication, with clear eligibility and direct application tracking in your dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenDivision('opportunities')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              View Opportunities <ArrowRight className="w-4 h-4" />
            </button>
          </article>

          {/* 05. IFIOK MARKET */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden flex flex-col">
            <div className="h-44 bg-slate-900">
              <img
                src={marketImg}
                alt="IFIOK Market creator hardware and digital commerce"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShoppingBag className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                  <span>05. IFIOK Market · IFIOK DIGITAL</span>
                </div>
                <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
                  IFIOK DIGITAL: Software, digital publishing, design, Web3 & Pi commerce
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Digital Suites A–F prioritized inside IFIOK DIGITAL with encrypted digital vaults, malware scanning, license attribution, refund terms, and Pi-locked fulfillment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDivision('market')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Open IFIOK DIGITAL & Market <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          {/* 06. IFIOK COMMUNITY (Full-width feature banner below) */}
          <article className="md:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 h-56 lg:h-auto bg-slate-900">
              <img
                src={communityImg}
                alt="IFIOK Community global summit collaboration"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Users className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                <span>06. IFIOK Community</span>
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-950 dark:text-white">
                Global professional networking & moderated collaboration groups
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Connect with founders, instructors, and technical peers across time zones. Direct messaging includes built-in rate controls and instant abuse reporting.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => onOpenDivision('community')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white dark:bg-slate-800 dark:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Enter Community Hub <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* LIVE DATABASE SHOWCASE: VERIFIED BUSINESSES, COURSES, OPPORTUNITIES, MARKETPLACE, COMMUNITY */}
      <section className="py-16 border-y border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081024]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-16">
          {/* Featured Verified Businesses & Featured Courses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">Featured Verified Businesses</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Administrator-verified SMEs and corporate partners</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDivision('business')}
                  className="text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  View Directory
                </button>
              </div>
              {summary && summary.businesses.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {summary.businesses.slice(0, 4).map((b) => (
                    <div key={b.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{b.business_name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {b.sector} · {b.country} · {b.source_origin || 'Verified SME'}
                          {b.last_verified_at ? ` · Verified ${b.last_verified_at.slice(0, 10)}` : ''}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{b.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDivision('business')}
                        className="text-xs font-semibold text-slate-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    No verified businesses published yet.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    IFIOK-EN only displays genuine organisations vetted by platform administrators. Register your SME profile to apply for verification.
                  </p>
                  <button
                    type="button"
                    onClick={() => (user ? onOpenDivision('business') : onOpenAuth('register'))}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                  >
                    Submit Business Profile
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">Featured IFIOK SCHOOL Courses</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Approved courses with verifiable completion certificates</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDivision('academy')}
                  className="text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  All Courses
                </button>
              </div>
              {summary && summary.courses.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {summary.courses.slice(0, 4).map((c) => {
                    const price = formatPiPrice(c.price_pi, currency, usdRate);
                    return (
                      <div key={c.id} className="p-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {c.category} · {c.level} · {c.duration_hours} hrs · {c.instructor_name} ·{' '}
                            {c.source_origin || 'Authorized Material'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-semibold text-slate-900 dark:text-amber-400">
                            {c.price_pi === 0 ? 'Free' : price.primary}
                          </div>
                          {price.reference && c.price_pi > 0 && (
                            <div className="text-[11px] font-mono text-slate-500">{price.reference}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    No approved courses published yet.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Educators and institutions can submit accredited curricula from IFIOK SCHOOL for administrator approval.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('academy')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                  >
                    Open IFIOK SCHOOL
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Latest Verified Opportunities & Marketplace Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">Latest Verified Opportunities</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real jobs, internships, scholarships, and grants</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDivision('opportunities')}
                  className="text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Explore All
                </button>
              </div>
              {summary && summary.opportunities.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {summary.opportunities.slice(0, 4).map((o) => (
                    <div key={o.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{o.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                          {o.opportunity_type} · {o.organization_name} · {o.location} · Deadline {o.deadline}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDivision('opportunities')}
                        className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    No verified opportunities active right now.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    We strictly prohibit fabricated job offers or fake grants. Verified employers and partner organisations can submit listings for review.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('opportunities')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                  >
                    Post an Opportunity
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">IFIOK Market Showcase</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Genuine listings from verified Pi commerce sellers</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDivision('market')}
                  className="text-sm font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Open Market
                </button>
              </div>
              {summary && summary.products.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {summary.products.slice(0, 4).map((p) => {
                    const price = formatPiPrice(p.price_pi, currency, usdRate);
                    return (
                      <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{p.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.category} · {p.store_name} ({p.seller_country}) · {p.source_origin || 'Verified Seller'} ·{' '}
                            {p.availability_status || 'available'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-semibold text-slate-900 dark:text-amber-400">
                            {price.primary}
                          </div>
                          {price.reference && <div className="text-[11px] font-mono text-slate-500">{price.reference}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Marketplace awaiting verified seller listings.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    IFIOK-EN never displays synthetic products, fake prices, or placeholder reviews. Verified sellers can list real goods and Web3 services.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenDivision('market')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                  >
                    Become a Verified Seller
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS & WHY CHOOSE IFIOK-EN */}
      <section className="py-16 lg:py-24 mx-auto max-w-[1280px] px-4 sm:px-6 space-y-20">
        <div>
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold text-purple-700 dark:text-amber-400 mb-2">How It Works</p>
            <h2 className="text-3xl font-display font-bold text-slate-950 dark:text-white">
              From onboarding to verified digital participation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Sign in with Pi & Verify Role',
                desc: 'Tap Sign in with Pi using Official Pi SDK authentication inside Pi Browser to activate your global IFIOK-EN profile and role.',
              },
              {
                step: '02. Build Capabilities',
                desc: 'Enrol in vetted IFIOK SCHOOL courses, earn verifiable completion certificates, or register your SME business profile.',
              },
              {
                step: '03. Deliver & Trade',
                desc: 'Offer freelance services, apply to approved opportunities, or publish genuine products in IFIOK Market.',
              },
              {
                step: '04. Server-Verified Pi Settlement',
                desc: 'All eligible payments execute via Official Pi SDK Testnet with strict server approval, blockchain verification, and audit logging.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-2.5"
              >
                <h3 className="font-display font-bold text-slate-950 dark:text-white">{item.step}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0E1A36] text-white p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Lock className="w-4 h-4" />
              <span>Pi-Exclusive & Defense-in-Depth Trust</span>
            </div>
            <h2 className="text-3xl font-display font-bold leading-tight">
              Server-enforced payment locking, encryption & active fraud monitoring
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every listing provenance, paid entitlement, role permission, and Pi Testnet completion is verified on our server before unlocking digital access or physical fulfillment.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: 'Pi Network Exclusive Payments',
                body: 'No bank cards, PayPal, Stripe, or outside crypto. Paid products & courses remain locked until api.minepi.com confirms settlement.',
              },
              {
                title: 'Account & MFA Protection',
                body: 'TOTP multi-factor authentication, AES-256-GCM encrypted sensitive fields, CSRF origin protection, and RBAC permission boundaries.',
              },
              {
                title: 'Scanned Uploads & Velocity Alerts',
                body: 'Magic-byte + script-signature file checks alongside automated fraud/velocity alerting, dispute mediation, and full audit trails.',
              },
              {
                title: 'Zero Fabricated Listings',
                body: `Recorded source origins & verification dates on listings. Transparent ${summary?.settings.freelanceCommissionPct ?? 8}% freelance and ${summary?.settings.marketplaceCommissionPct ?? 5}% market fees.`,
              },
            ].map((point) => (
              <div key={point.title} className="space-y-1.5 border-t border-white/15 pt-4">
                <h3 className="font-display font-semibold text-amber-300 text-sm">{point.title}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{point.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-950 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0D152B]">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROFESSIONAL FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] py-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4 space-y-3">
            <div
              onClick={handleFooterLogoTap}
              className="inline-block select-none touch-manipulation"
            >
              <BrandLogo size="md" />
            </div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{t.slogan}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
              Global Digital Empowerment Network uniting education, entrepreneurship, freelance collaboration, verified opportunities, and Pi-powered commerce.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Support: {summary?.settings.supportEmail || 'support@ifiok-en.org'}
            </p>
          </div>

          <div className="md:col-span-3 space-y-2 text-xs">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">Business Divisions</h3>
            {(
              [
                ['academy', 'IFIOK SCHOOL'],
                ['business', 'IFIOK Business Hub'],
                ['freelance', 'IFIOK Freelance'],
                ['opportunities', 'IFIOK Opportunities'],
                ['market', 'IFIOK Market'],
                ['community', 'IFIOK Community'],
              ] as Array<[DivisionTab, string]>
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => onOpenDivision(tab)}
                className="block text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3 space-y-1.5 text-xs">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">Trust & Governance Policies</h3>
            {(
              [
                ['terms', 'Terms of Service'],
                ['privacy', 'Privacy Policy'],
                ['refund', 'Refund & Dispute Policy'],
                ['seller', 'Seller & Creator Policy'],
                ['community', 'Community Guidelines'],
                ['child_safety', 'Child Safety Policy'],
                ['teacher_content', 'Teacher Content Policy'],
                ['ip_policy', 'IP & Takedown Policy'],
                ['digital_licence', 'Digital Product Licence'],
                ['acceptable_use', 'Acceptable Use Policy'],
              ] as Array<[PolicyKey, string]>
            ).map(([key, label]) =>
              key === 'privacy' || key === 'terms' ? (
                <a
                  key={key}
                  href={`/${key}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateView(key);
                  }}
                  className="block text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  {label}
                </a>
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() => onOpenPolicy(key)}
                  className="block text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className="md:col-span-2 space-y-2 text-xs">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">Account Access</h3>
            {piAuth ? (
              <button
                type="button"
                onClick={() => (user ? onNavigateView('dashboard') : void handleHeroPiConnect())}
                className="block text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Welcome @{piAuth.username}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleHeroPiConnect()}
                disabled={piLoading}
                className="block text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-60"
              >
                {piLoading ? 'Signing in...' : 'Sign in with Pi'}
              </button>
            )}
            {piHeroError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-snug">
                {piHeroError}
              </p>
            )}
            {user && (
              <button
                type="button"
                onClick={() => onNavigateView('dashboard')}
                className="block text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              >
                Member Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>© {new Date().getFullYear()} IFIOK-EN Global Digital Empowerment Network.</span>
          <span>Pi Network is the exclusive platform payment method (Testnet Active). Reference rates are informational only.</span>
        </div>
      </footer>

      {tapToast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-medium shadow-lg pointer-events-none"
        >
          Keep tapping...
        </div>
      )}
    </div>
  );
}
