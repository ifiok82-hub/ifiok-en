import type { CurrencyCode, LanguageCode } from '../types/platform.ts';

export const COUNTRIES = [
  'Global',
  'Nigeria',
  'United Kingdom',
  'United States',
  'Canada',
  'Germany',
  'France',
  'Singapore',
  'India',
  'Kenya',
  'South Africa',
  'Ghana',
  'Brazil',
  'United Arab Emirates',
  'Japan',
  'Australia',
  'Philippines',
  'Indonesia',
];

export const PHONE_CODES = [
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+234', label: 'NG (+234)' },
  { code: '+254', label: 'KE (+254)' },
  { code: '+233', label: 'GH (+233)' },
  { code: '+27', label: 'ZA (+27)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+91', label: 'IN (+91)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+55', label: 'BR (+55)' },
  { code: '+63', label: 'PH (+63)' },
  { code: '+62', label: 'ID (+62)' },
  { code: '+61', label: 'AU (+61)' },
];

export const TIMEZONES = [
  'UTC',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Manila',
  'Australia/Sydney',
];

const REFERENCE_FX_PER_USD: Record<CurrencyCode, { symbol: string; mult: number }> = {
  PI: { symbol: 'π', mult: 1 },
  USD: { symbol: '$', mult: 1 },
  EUR: { symbol: '€', mult: 0.92 },
  GBP: { symbol: '£', mult: 0.79 },
  NGN: { symbol: '₦', mult: 1580 },
};

export function formatPiPrice(
  amountPi: number,
  displayCurrency: CurrencyCode,
  informationalUsdPerPi = 1.0
): { primary: string; reference: string | null } {
  const formattedPi = `${Number(amountPi).toLocaleString(undefined, {
    minimumFractionDigits: amountPi % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} π`;

  if (displayCurrency === 'PI') {
    return { primary: formattedPi, reference: null };
  }
  const fx = REFERENCE_FX_PER_USD[displayCurrency];
  const refAmount = amountPi * informationalUsdPerPi * fx.mult;
  return {
    primary: formattedPi,
    reference: `≈ ${fx.symbol}${refAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${displayCurrency} (info)`,
  };
}

export const TRANSLATIONS: Record<
  LanguageCode,
  {
    slogan: string;
    joinBtn: string;
    exploreBtn: string;
    navDivisions: string;
    navAcademy: string;
    navBusiness: string;
    navMarket: string;
    navOpportunities: string;
  }
> = {
  en: {
    slogan: 'Empower. Connect. Earn. Grow.',
    joinBtn: 'Join IFIOK-EN',
    exploreBtn: 'Explore Our Services',
    navDivisions: 'Divisions',
    navAcademy: 'Academy',
    navBusiness: 'Business Hub',
    navMarket: 'Market',
    navOpportunities: 'Opportunities',
  },
  fr: {
    slogan: 'Autonomiser. Connecter. Gagner. Grandir.',
    joinBtn: 'Rejoindre IFIOK-EN',
    exploreBtn: 'Explorer nos services',
    navDivisions: 'Divisions',
    navAcademy: 'Académie',
    navBusiness: 'Pôle Entreprises',
    navMarket: 'Marché',
    navOpportunities: 'Opportunités',
  },
  es: {
    slogan: 'Empoderar. Conectar. Ganar. Crecer.',
    joinBtn: 'Únete a IFIOK-EN',
    exploreBtn: 'Explorar servicios',
    navDivisions: 'Divisiones',
    navAcademy: 'Academia',
    navBusiness: 'Centro Empresarial',
    navMarket: 'Mercado',
    navOpportunities: 'Oportunidades',
  },
  pt: {
    slogan: 'Capacitar. Conectar. Ganhar. Crescer.',
    joinBtn: 'Junte-se ao IFIOK-EN',
    exploreBtn: 'Explorar serviços',
    navDivisions: 'Divisões',
    navAcademy: 'Academia',
    navBusiness: 'Centro Empresarial',
    navMarket: 'Mercado',
    navOpportunities: 'Oportunidades',
  },
};
