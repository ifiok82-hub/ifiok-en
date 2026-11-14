export type AppView = 'home' | 'divisions' | 'dashboard' | 'admin';
export type DivisionTab = 'academy' | 'business' | 'freelance' | 'opportunities' | 'market' | 'community';
export type LanguageCode = 'en' | 'fr' | 'es' | 'pt';
export type CurrencyCode = 'PI' | 'USD' | 'EUR' | 'GBP' | 'NGN';

export interface UserProfile {
  id: number;
  email: string | null;
  pi_uid: string | null;
  pi_username: string | null;
  full_name: string;
  bio?: string;
  phone_country_code?: string;
  phone_number?: string;
  country: string;
  timezone: string;
  preferred_currency: string;
  preferred_language: string;
  account_type: string;
  status: string;
  roles: string[];
  created_at?: string;
}

export interface PlatformSettingsPublic {
  heroHeadline: string;
  heroSubheadline: string;
  announcementBanner: string;
  supportEmail: string;
  freelanceCommissionPct: number;
  marketplaceCommissionPct: number;
  subscriptionProPi: number;
  subscriptionBusinessPi: number;
  subscriptionEnterprisePi: number;
  informationalUsdPerPi: number;
  piEnvironment: 'testnet';
  mainnetEnabled: false;
}

export interface Course {
  id: number;
  instructor_id: number;
  instructor_user_id?: number;
  instructor_name: string;
  instructor_headline?: string;
  title: string;
  slug: string;
  category: string;
  level: string;
  duration_hours: number;
  price_pi: number;
  syllabus_json: string;
  description: string;
  approval_status: string;
  is_featured: number;
  avg_rating?: number | null;
  review_count?: number;
  created_at: string;
}

export interface BusinessProfile {
  id: number;
  owner_user_id: number;
  owner_name: string;
  business_name: string;
  registration_number: string;
  sector: string;
  country: string;
  website: string;
  summary: string;
  services_offered: string;
  verification_status: string;
  is_featured: number;
  created_at: string;
}

export interface FreelanceService {
  id: number;
  freelancer_user_id: number;
  freelancer_name: string;
  freelancer_country: string;
  title: string;
  category: string;
  description: string;
  delivery_days: number;
  price_pi: number;
  approval_status: string;
  created_at: string;
}

export interface Opportunity {
  id: number;
  poster_user_id: number;
  poster_name: string;
  title: string;
  opportunity_type: 'job' | 'internship' | 'scholarship' | 'grant' | 'partnership';
  organization_name: string;
  location: string;
  is_remote: number;
  compensation_or_award: string;
  deadline: string;
  description: string;
  requirements: string;
  external_url: string;
  approval_status: string;
  created_at: string;
}

export interface Product {
  id: number;
  seller_id: number;
  seller_user_id?: number;
  store_name: string;
  seller_country: string;
  title: string;
  category: string;
  product_type: 'physical' | 'digital' | 'service' | 'web3' | 'pi_app' | 'gaming_asset';
  description: string;
  price_pi: number;
  stock_qty: number;
  approval_status: string;
  avg_rating?: number | null;
  review_count?: number;
  created_at: string;
}

export interface CommunityPost {
  id: number;
  author_user_id: number;
  author_name: string;
  author_country: string;
  author_type?: string;
  group_name: string;
  post_type: 'discussion' | 'announcement' | 'collaboration';
  title: string;
  body: string;
  moderation_status: string;
  reports_count: number;
  created_at: string;
}

export interface PublicSummary {
  settings: PlatformSettingsPublic;
  stats: {
    members: number;
    verifiedBusinesses: number;
    approvedCourses: number;
    approvedOpportunities: number;
    approvedProducts: number;
    approvedServices: number;
  };
  courses: Course[];
  businesses: BusinessProfile[];
  opportunities: Opportunity[];
  products: Product[];
  services: FreelanceService[];
  communityPosts: CommunityPost[];
}
