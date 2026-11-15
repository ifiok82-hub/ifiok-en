export const IFIOK_LOGO_PATH = '/assets/aistudio/IFIOK-EN-Logo-1024x1024_f53d04a7.jpg';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-lg',
  lg: 'w-14 h-14 rounded-xl',
  xl: 'w-20 h-20 rounded-2xl',
};

export function BrandLogo({ size = 'md', showWordmark = true }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <img
        src={IFIOK_LOGO_PATH}
        alt="IFIOK-EN Official Logo"
        className={`${SIZE_CLASSES[size]} object-cover shrink-0 ring-1 ring-amber-400/50 shadow-sm bg-[#240752]`}
      />
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${
            size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg'
          }`}
        >
          IFIOK-EN
        </span>
      )}
    </span>
  );
}
