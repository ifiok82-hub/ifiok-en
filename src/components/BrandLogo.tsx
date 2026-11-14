interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export function BrandLogo({ size = 'md', showWordmark = true }: BrandLogoProps) {
  const dim = size === 'lg' ? 52 : size === 'sm' ? 28 : 34;

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="ifiokHex" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0E1A36" />
            <stop offset="55%" stopColor="#4C1D95" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="ifiokGold" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <path
          d="M32 4L56 18V46L32 60L8 46V18L32 4Z"
          fill="url(#ifiokHex)"
          stroke="url(#ifiokGold)"
          strokeWidth="2.5"
        />
        <circle cx="32" cy="32" r="14" stroke="#E2E8F0" strokeOpacity="0.35" strokeWidth="1.5" />
        <ellipse cx="32" cy="32" rx="7" ry="14" stroke="#E2E8F0" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M18 32H46" stroke="#E2E8F0" strokeOpacity="0.4" strokeWidth="1.5" />
        <path
          d="M25 26H39M28.5 26V40M35.5 26V36.5C35.5 38.5 37 39.5 39 39.5"
          stroke="url(#ifiokGold)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${
            size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg'
          }`}
        >
          IFIOK-EN
        </span>
      )}
    </span>
  );
}
