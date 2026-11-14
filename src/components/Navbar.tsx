import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { TRANSLATIONS } from '../lib/i18n.ts';
import type { AppView, DivisionTab, LanguageCode, UserProfile } from '../types/platform.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface NavbarProps {
  user: UserProfile | null;
  language: LanguageCode;
  onNavigateHome: () => void;
  onOpenDivision: (tab: DivisionTab) => void;
  onOpenAuth: () => void;
  onNavigateView: (view: AppView) => void;
}

export function Navbar({
  user,
  language,
  onNavigateHome,
  onOpenDivision,
  onOpenAuth,
  onNavigateView,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = TRANSLATIONS[language];

  const handlePrimaryClick = () => {
    if (user) {
      onNavigateView('dashboard');
    } else {
      onOpenAuth();
    }
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/90 bg-white/95 dark:bg-[#070C1B]/95 backdrop-blur-md">
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
