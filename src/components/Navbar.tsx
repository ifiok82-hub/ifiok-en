import { LogIn, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { TRANSLATIONS } from '../lib/i18n.ts';
import type { PiAuthSession } from '../lib/pi.ts';
import type { AppView, DivisionTab, LanguageCode, UserProfile } from '../types/platform.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface NavbarProps {
  user: UserProfile | null;
  piAuth: PiAuthSession | null;
  language: LanguageCode;
  onNavigateHome: () => void;
  onOpenDivision: (tab: DivisionTab) => void;
  onOpenAuth: () => void;
  onNavigateView: (view: AppView) => void;
  onConnectPi: () => Promise<void>;
  onLogoutPi: () => Promise<void>;
}

export function Navbar({
  user,
  piAuth,
  language,
  onNavigateHome,
  onOpenDivision,
  onOpenAuth,
  onNavigateView,
  onConnectPi,
  onLogoutPi,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [piConnecting, setPiConnecting] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  const handlePrimaryClick = () => {
    if (user) {
      onNavigateView('dashboard');
    } else {
      onOpenAuth();
    }
    setMobileOpen(false);
  };

  const handleConnectPiClick = async () => {
    setPiError(null);
    setPiConnecting(true);
    try {
      await onConnectPi();
    } catch (err) {
      setPiError(err instanceof Error ? err.message : 'Unable to connect with Pi.');
    } finally {
      setPiConnecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/90 bg-white/95 dark:bg-[#070C1B]/95 backdrop-blur-md">
      {/* Top Pi Network Authentication Status Bar (Visible on Mobile + Desktop) */}
      <div className="bg-[#0E1A36] dark:bg-[#040814] text-white border-b border-purple-500/30">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            {piAuth ? (
              <span className="font-semibold text-emerald-300 truncate">
                Welcome @{piAuth.username}
              </span>
            ) : (
              <span className="font-medium text-amber-200 truncate">
                Not Connected - Tap Connect with Pi
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {piAuth ? (
              <button
                type="button"
                onClick={onLogoutPi}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectPiClick}
                disabled={piConnecting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{piConnecting ? 'Connecting Pi...' : 'Connect with Pi'}</span>
              </button>
            )}
          </div>
        </div>

        {piError && (
          <div className="bg-rose-950/90 text-rose-100 border-t border-rose-500/40 px-4 sm:px-6 py-1.5 text-xs flex items-center justify-between gap-3">
            <span>{piError}</span>
            <button
              type="button"
              onClick={() => setPiError(null)}
              aria-label="Dismiss Pi error"
              className="text-rose-200 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand mark (single-line, no descriptors) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome();
            setMobileOpen(false);
          }}
          className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md"
        >
          <BrandLogo size="md" />
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => onOpenDivision('academy')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navAcademy}
          </button>
          <button
            type="button"
            onClick={() => onOpenDivision('business')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navBusiness}
          </button>
          <button
            type="button"
            onClick={() => onOpenDivision('freelance')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Freelance
          </button>
          <button
            type="button"
            onClick={() => onOpenDivision('opportunities')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navOpportunities}
          </button>
          <button
            type="button"
            onClick={() => onOpenDivision('market')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navMarket}
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA button (+ mobile menu trigger on small screens) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#0E1A36] text-white hover:bg-[#192A54] dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {user ? 'Dashboard' : t.joinBtn}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1328] px-4 py-4 space-y-2">
          {(
            [
              ['academy', t.navAcademy],
              ['business', t.navBusiness],
              ['freelance', 'Freelance'],
              ['opportunities', t.navOpportunities],
              ['market', t.navMarket],
              ['community', 'Community'],
            ] as Array<[DivisionTab, string]>
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                onOpenDivision(tab);
                setMobileOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="w-full mt-2 px-4 py-3 rounded-lg text-sm font-semibold bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950"
          >
            {user ? 'Open Member Dashboard' : t.joinBtn}
          </button>
        </div>
      )}
    </header>
  );
}
