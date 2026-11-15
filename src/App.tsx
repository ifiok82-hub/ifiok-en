import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { DivisionsView } from './components/DivisionsView.tsx';
import { HiddenAdminPortal } from './components/HiddenAdminPortal.tsx';
import { HomePage } from './components/HomePage.tsx';
import { LegalModal, LegalPage, type PolicyKey } from './components/LegalModal.tsx';
import { MemberDashboard } from './components/MemberDashboard.tsx';
import { Navbar } from './components/Navbar.tsx';
import { apiRequest } from './lib/api.ts';
import { detectInitialLanguage, isRtlLanguage, LANGUAGE_OPTIONS } from './lib/i18n.ts';
import { initAppStudioBridge } from './lib/appStudio.ts';
import {
  connectWithPi,
  getStoredPiAuth,
  logoutPi,
  PI_AUTH_EVENT,
  waitForPiSdk,
  type PiAuthSession,
} from './lib/pi.ts';
import type {
  AcademySubView,
  AppView,
  CurrencyCode,
  DivisionTab,
  LanguageCode,
  PublicSummary,
  UserProfile,
} from './types/platform.ts';

const DIVISION_PATHS: Record<DivisionTab, string> = {
  academy: '/ifiok-school',
  business: '/business-hub',
  freelance: '/freelance',
  opportunities: '/opportunities',
  market: '/market',
  community: '/community',
};

const SEO_COPY: Record<string, { title: string; description: string }> = {
  home: {
    title: 'IFIOK-EN — Global Digital Empowerment Network | Empower. Connect. Earn. Grow.',
    description:
      'IFIOK-EN unites IFIOK SCHOOL — Global Digital Learning, verified SME business services, freelance collaboration, vetted opportunities, and Pi Network-settled digital commerce.',
  },
  academy: {
    title: 'IFIOK SCHOOL — Global Digital Learning | Learn Without Borders. Grow Without Limits.',
    description:
      'IFIOK SCHOOL serves global students, primary & secondary schools, colleges, training institutions, teachers, and adult learners with IFIOK Professor AI and verifiable certificates.',
  },
  business: {
    title: 'IFIOK Business Hub — Verified SME Directory & Corporate Consulting | IFIOK-EN',
    description:
      'Discover verified SMEs, business registration assistance, corporate services, and B2B partnership profiles on IFIOK-EN.',
  },
  freelance: {
    title: 'IFIOK Freelance — Commissioned Software, Design & Consulting Services | IFIOK-EN',
    description:
      'Hire vetted developers, designers, writers, marketers, and consultants with Pi Network Testnet settlement and tracked project governance.',
  },
  opportunities: {
    title: 'IFIOK Opportunities — Verified Jobs, Grants, Scholarships & Internships | IFIOK-EN',
    description:
      'Browse real, issuing-organization-confirmed jobs, internships, scholarships, grants, and partnership opportunities.',
  },
  market: {
    title: 'IFIOK Market — Verified Physical, Digital, Web3 & Pi Commerce | IFIOK-EN',
    description:
      'Shop verified physical goods, digital downloads, gaming assets, and Web3 products settled exclusively with Pi Network.',
  },
  community: {
    title: 'IFIOK Community — Global Builders & Moderated Business Groups | IFIOK-EN',
    description:
      'Connect with founders, instructors, and professionals across moderated discussion groups with abuse reporting.',
  },
  dashboard: {
    title: 'Member Workspace — IFIOK-EN Global Digital Empowerment Network',
    description: 'Manage your IFIOK-EN profile, MFA security, courses, orders, and Pi transactions.',
  },
  admin: {
    title: 'Governance Console — IFIOK-EN Global Digital Empowerment Network',
    description: 'Administrator governance, verification queues, security alerts, and database backups.',
  },
  privacy: {
    title: 'Privacy Policy — IFIOK-EN Global Digital Empowerment Network',
    description: 'IFIOK-EN data minimization, Pi Network authentication privacy, and HTTP-only security controls.',
  },
  terms: {
    title: 'Terms of Service — IFIOK-EN Global Digital Empowerment Network',
    description: 'Terms governing IFIOK-EN divisions, Pi Network Testnet settlement, and honest earnings standards.',
  },
};

function parseRouteFromLocation(): { view: AppView; division: DivisionTab; academySubView: AcademySubView } {
  if (typeof window === 'undefined') return { view: 'home', division: 'academy', academySubView: 'courses' };
  const p = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/ifiok-professor') return { view: 'divisions', division: 'academy', academySubView: 'professor' };
  if (p === '/school/student-portal') return { view: 'divisions', division: 'academy', academySubView: 'student_portal' };
  if (p === '/school/teacher-portal') return { view: 'divisions', division: 'academy', academySubView: 'teacher_portal' };
  if (p === '/school/admin-portal' || p === '/academy/school-portal') return { view: 'divisions', division: 'academy', academySubView: 'schools' };
  if (p === '/school/guardian-portal') return { view: 'divisions', division: 'academy', academySubView: 'guardian_portal' };
  if (p === '/school/verify-certificate' || p === '/academy/verify-certificate') return { view: 'divisions', division: 'academy', academySubView: 'certificates' };
  if (p === '/ifiok-school' || p === '/academy') return { view: 'divisions', division: 'academy', academySubView: 'courses' };
  if (p === '/business-hub') return { view: 'divisions', division: 'business', academySubView: 'courses' };
  if (p === '/freelance') return { view: 'divisions', division: 'freelance', academySubView: 'courses' };
  if (p === '/opportunities') return { view: 'divisions', division: 'opportunities', academySubView: 'courses' };
  if (p === '/market') return { view: 'divisions', division: 'market', academySubView: 'courses' };
  if (p === '/community') return { view: 'divisions', division: 'community', academySubView: 'courses' };
  if (p === '/dashboard') return { view: 'dashboard', division: 'academy', academySubView: 'courses' };
  if (p === '/admin') return { view: 'admin', division: 'academy', academySubView: 'courses' };
  if (p === '/privacy') return { view: 'privacy', division: 'academy', academySubView: 'courses' };
  if (p === '/terms') return { view: 'terms', division: 'academy', academySubView: 'courses' };
  return { view: 'home', division: 'academy', academySubView: 'courses' };
}

export default function App() {
  const initialRoute = parseRouteFromLocation();
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('ifiok_admin_unlocked') === '1';
  });
  const [view, setView] = useState<AppView>(
    initialRoute.view === 'dashboard'
      ? 'home'
      : initialRoute.view === 'admin' && (typeof window === 'undefined' || window.sessionStorage.getItem('ifiok_admin_unlocked') !== '1')
      ? 'home'
      : initialRoute.view
  );
  const [divisionTab, setDivisionTab] = useState<DivisionTab>(initialRoute.division);
  const [academySubView, setAcademySubView] = useState<AcademySubView>(initialRoute.academySubView);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [piAuth, setPiAuth] = useState<PiAuthSession | null>(() => getStoredPiAuth());
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ifiok_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [language, setLanguage] = useState<LanguageCode>(() => detectInitialLanguage());
  const [currency, setCurrency] = useState<CurrencyCode>('PI');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ifiok_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('ifiok_lang', language);
  }, [language]);

  const handleLanguageChange = useCallback(
    (next: LanguageCode) => {
      setLanguage(next);
      if (user) {
        apiRequest<{ user: UserProfile }>('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({ preferredLanguage: next }),
        })
          .then((res) => setUser(res.user))
          .catch(() => undefined);
      }
    },
    [user]
  );

  useEffect(() => {
    const cleanupBridge = initAppStudioBridge();
    void waitForPiSdk(6000);
    const syncPi = () => setPiAuth(getStoredPiAuth());
    window.addEventListener(PI_AUTH_EVENT, syncPi);
    window.addEventListener('storage', syncPi);
    return () => {
      cleanupBridge();
      window.removeEventListener(PI_AUTH_EVENT, syncPi);
      window.removeEventListener('storage', syncPi);
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseRouteFromLocation();
      if (parsed.view === 'dashboard' && !user) {
        setView('home');
      } else if (parsed.view === 'admin' && !adminUnlocked) {
        setView('home');
      } else {
        setView(parsed.view);
      }
      setDivisionTab(parsed.division);
      setAcademySubView(parsed.academySubView);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user, adminUnlocked]);

  const syncUrl = useCallback((nextView: AppView, nextDiv: DivisionTab, nextAcademySub: AcademySubView = 'courses') => {
    if (typeof window === 'undefined') return;
    let targetPath = '/';
    if (nextView === 'divisions') {
      if (nextDiv === 'academy' && nextAcademySub === 'professor') targetPath = '/ifiok-professor';
      else if (nextDiv === 'academy' && nextAcademySub === 'student_portal') targetPath = '/school/student-portal';
      else if (nextDiv === 'academy' && nextAcademySub === 'teacher_portal') targetPath = '/school/teacher-portal';
      else if (nextDiv === 'academy' && nextAcademySub === 'schools') targetPath = '/school/admin-portal';
      else if (nextDiv === 'academy' && nextAcademySub === 'guardian_portal') targetPath = '/school/guardian-portal';
      else if (nextDiv === 'academy' && nextAcademySub === 'certificates') targetPath = '/school/verify-certificate';
      else targetPath = DIVISION_PATHS[nextDiv];
    } else if (nextView === 'dashboard') targetPath = '/dashboard';
    else if (nextView === 'admin') targetPath = '/admin';
    else if (nextView === 'privacy') targetPath = '/privacy';
    else if (nextView === 'terms') targetPath = '/terms';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  // Dynamic SEO metadata, canonical link, and Schema.org JSON-LD from verified database listings
  useEffect(() => {
    const seoKey = view === 'divisions' ? divisionTab : view;
    const seo = SEO_COPY[seoKey] || SEO_COPY.home;
    document.title = seo.title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const origin = 'https://ifiok-en.vercel.app';
    const cleanPath = window.location.pathname === '/' ? '' : window.location.pathname.replace(/\/+$/, '');
    const canonicalUrl = `${origin}${cleanPath}`;
    setMeta('meta[name="description"]', 'name', 'description', seo.description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    const graph: Array<Record<string, unknown>> = [
      {
        '@type': 'Organization',
        name: 'IFIOK-EN — Global Digital Empowerment Network',
        url: origin,
        slogan: 'Empower. Connect. Earn. Grow.',
        email: 'ifiok82@gmail.com',
      },
      {
        '@type': 'WebSite',
        name: 'IFIOK-EN',
        url: origin,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/market?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ];

    if (summary) {
      for (const p of summary.products.slice(0, 6)) {
        graph.push({
          '@type': 'Product',
          name: p.title,
          description: p.description,
          category: p.category,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'PI',
            price: p.price_pi,
            availability: p.stock_qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: p.store_name },
          },
        });
      }
      for (const c of summary.courses.slice(0, 6)) {
        graph.push({
          '@type': 'Course',
          name: c.title,
          description: c.description,
          provider: { '@type': 'Organization', name: 'IFIOK SCHOOL' },
        });
      }
      for (const b of summary.businesses.slice(0, 6)) {
        graph.push({
          '@type': 'LocalBusiness',
          name: b.business_name,
          description: b.summary,
          address: { '@type': 'PostalAddress', addressCountry: b.country },
          url: b.website || `${origin}/business-hub`,
        });
      }
    }

    let ldEl = document.getElementById('ifiok-seo-jsonld') as HTMLScriptElement | null;
    if (!ldEl) {
      ldEl = document.createElement('script');
      ldEl.id = 'ifiok-seo-jsonld';
      ldEl.type = 'application/ld+json';
      document.head.appendChild(ldEl);
    }
    ldEl.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  }, [view, divisionTab, summary]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await apiRequest<PublicSummary>('/api/divisions/public-summary');
      setSummary(res);
    } catch {
      // Keep graceful null fallback
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
      if (
        res.user.preferred_language &&
        LANGUAGE_OPTIONS.some((l) => l.code === res.user.preferred_language)
      ) {
        setLanguage(res.user.preferred_language as LanguageCode);
      }
      const parsed = parseRouteFromLocation();
      if (parsed.view === 'dashboard') {
        setView('dashboard');
      } else if (parsed.view === 'admin' && adminUnlocked) {
        setView('admin');
      }
    } catch {
      setUser(null);
    }
  }, [adminUnlocked]);

  useEffect(() => {
    loadSummary();
    loadSession();
  }, [loadSummary, loadSession]);

  const handleOpenDivision = (tab: DivisionTab, sub: AcademySubView = 'courses') => {
    setDivisionTab(tab);
    setAcademySubView(sub);
    setView('divisions');
    syncUrl('divisions', tab, sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setView('home');
    syncUrl('home', divisionTab);
  };

  const handleUnlockAdmin = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('ifiok_admin_unlocked', '1');
    }
    setAdminUnlocked(true);
    setView('admin');
    syncUrl('admin', divisionTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateView = (next: AppView) => {
    if (next === 'dashboard' && !user) {
      handleOpenAuth('login');
      return;
    }
    if (next === 'admin' && !adminUnlocked) {
      setView('home');
      syncUrl('home', divisionTab);
      return;
    }
    setView(next);
    syncUrl(next, divisionTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] text-slate-900 dark:text-slate-100">
      {(view === 'home' || view === 'divisions' || view === 'privacy' || view === 'terms') && (
        <Navbar
          user={user}
          piAuth={piAuth}
          language={language}
          onNavigateHome={() => handleNavigateView('home')}
          onOpenDivision={handleOpenDivision}
          onOpenAuth={() => handleOpenAuth('register')}
          onNavigateView={handleNavigateView}
          onConnectPi={async () => {
            const session = await connectWithPi();
            setPiAuth(session);
            void loadSession();
          }}
          onLogoutPi={async () => {
            await logoutPi();
            setPiAuth(null);
            setUser(null);
          }}
        />
      )}

      {view === 'home' && (
        <HomePage
          summary={summary}
          loading={loadingSummary}
          user={user}
          piAuth={piAuth}
          theme={theme}
          language={language}
          currency={currency}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          onChangeLanguage={handleLanguageChange}
          onChangeCurrency={setCurrency}
          onOpenAuth={handleOpenAuth}
          onOpenDivision={handleOpenDivision}
          onNavigateView={handleNavigateView}
          onOpenPolicy={setActivePolicy}
          onUnlockAdmin={handleUnlockAdmin}
          onConnectPi={async () => {
            const session = await connectWithPi();
            setPiAuth(session);
            void loadSession();
          }}
          onLogoutPi={async () => {
            await logoutPi();
            setPiAuth(null);
            setUser(null);
          }}
        />
      )}

      {view === 'divisions' && (
        <DivisionsView
          activeTab={divisionTab}
          onChangeTab={(tab) => {
            setDivisionTab(tab);
            setAcademySubView('courses');
            syncUrl('divisions', tab, 'courses');
          }}
          onBackHome={() => handleNavigateView('home')}
          user={user}
          language={language}
          onChangeLanguage={handleLanguageChange}
          initialAcademySubView={academySubView}
          currency={currency}
          usdRate={summary?.settings.informationalUsdPerPi ?? 1.0}
          onRequireAuth={() => handleOpenAuth('login')}
          onRefreshSummary={loadSummary}
          onNavigateView={(next) => handleNavigateView(next)}
        />
      )}

      {view === 'dashboard' && user && (
        <MemberDashboard
          user={user}
          settings={summary?.settings ?? null}
          language={language}
          onChangeLanguage={handleLanguageChange}
          onUserUpdated={setUser}
          onLogout={handleLogout}
          onBackHome={() => handleNavigateView('home')}
          onOpenDivision={handleOpenDivision}
          onNavigateView={handleNavigateView}
        />
      )}

      {view === 'admin' && (
        <HiddenAdminPortal
          adminUnlocked={adminUnlocked}
          piAuth={piAuth}
          user={user}
          onConnectPi={async () => {
            const session = await connectWithPi();
            setPiAuth(session);
            void loadSession();
          }}
          onLogoutAdmin={async () => {
            await logoutPi();
            setPiAuth(null);
            setUser(null);
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('ifiok_admin_unlocked');
            }
            setAdminUnlocked(false);
            setView('home');
            syncUrl('home', divisionTab);
          }}
          onBackHome={() => handleNavigateView('home')}
          onNavigateView={handleNavigateView}
          onRefreshSummary={loadSummary}
        />
      )}

      {(view === 'privacy' || view === 'terms') && (
        <LegalPage
          policy={view}
          onBackHome={() => handleNavigateView('home')}
          onSwitchPolicy={(next) => handleNavigateView(next)}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(u) => {
          setUser(u);
          if (u.preferred_language && LANGUAGE_OPTIONS.some((l) => l.code === u.preferred_language)) {
            setLanguage(u.preferred_language as LanguageCode);
          }
          loadSummary();
          setView('dashboard');
          syncUrl('dashboard', divisionTab);
        }}
      />

      <LegalModal policy={activePolicy} onClose={() => setActivePolicy(null)} />
    </div>
  );
}
