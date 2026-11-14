import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { DivisionsView } from './components/DivisionsView.tsx';
import { HomePage } from './components/HomePage.tsx';
import { LegalModal, type PolicyKey } from './components/LegalModal.tsx';
import { MemberDashboard } from './components/MemberDashboard.tsx';
import { Navbar } from './components/Navbar.tsx';
import { apiRequest } from './lib/api.ts';
import { initPiTestnet } from './lib/pi.ts';
import type {
  AppView,
  CurrencyCode,
  DivisionTab,
  LanguageCode,
  PublicSummary,
  UserProfile,
} from './types/platform.ts';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [divisionTab, setDivisionTab] = useState<DivisionTab>('academy');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<PublicSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ifiok_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [currency, setCurrency] = useState<CurrencyCode>('PI');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ifiok_theme', theme);
  }, [theme]);

  useEffect(() => {
    initPiTestnet();
  }, []);

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
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadSession();
  }, [loadSummary, loadSession]);

  const handleOpenDivision = (tab: DivisionTab) => {
    setDivisionTab(tab);
    setView('divisions');
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
  };

  const handleNavigateView = (next: AppView) => {
    if (next === 'dashboard' && !user) {
      handleOpenAuth('login');
      return;
    }
    if (next === 'admin') {
      const allowed = user?.roles.some((r) => ['super_admin', 'moderator', 'finance_admin'].includes(r));
      if (!allowed) {
        setView(user ? 'dashboard' : 'home');
        return;
      }
    }
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C1B] text-slate-900 dark:text-slate-100">
      {(view === 'home' || view === 'divisions') && (
        <Navbar
          user={user}
          language={language}
          onNavigateHome={() => handleNavigateView('home')}
          onOpenDivision={handleOpenDivision}
          onOpenAuth={() => handleOpenAuth('register')}
          onNavigateView={handleNavigateView}
        />
      )}

      {view === 'home' && (
        <HomePage
          summary={summary}
          loading={loadingSummary}
          user={user}
          theme={theme}
          language={language}
          currency={currency}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          onChangeLanguage={setLanguage}
          onChangeCurrency={setCurrency}
          onOpenAuth={handleOpenAuth}
          onOpenDivision={handleOpenDivision}
          onNavigateView={handleNavigateView}
          onOpenPolicy={setActivePolicy}
        />
      )}

      {view === 'divisions' && (
        <DivisionsView
          activeTab={divisionTab}
          onChangeTab={setDivisionTab}
          onBackHome={() => handleNavigateView('home')}
          user={user}
          currency={currency}
          usdRate={summary?.settings.informationalUsdPerPi ?? 1.0}
          onRequireAuth={() => handleOpenAuth('login')}
          onRefreshSummary={loadSummary}
        />
      )}

      {view === 'dashboard' && user && (
        <MemberDashboard
          user={user}
          settings={summary?.settings ?? null}
          onUserUpdated={setUser}
          onLogout={handleLogout}
          onBackHome={() => handleNavigateView('home')}
          onOpenDivision={handleOpenDivision}
          onNavigateView={handleNavigateView}
        />
      )}

      {view === 'admin' && user && (
        <AdminDashboard
          user={user}
          onNavigateView={handleNavigateView}
          onRefreshSummary={loadSummary}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(u) => {
          setUser(u);
          loadSummary();
          setView('dashboard');
        }}
      />

      <LegalModal policy={activePolicy} onClose={() => setActivePolicy(null)} />
    </div>
  );
}
