export type AppView = 'home' | 'divisions' | 'dashboard' | 'admin' | 'privacy' | 'terms';
export type DivisionTab = 'academy' | 'business' | 'freelance' | 'opportunities' | 'market' | 'community';
export type AcademySubView =
  | 'courses'
  | 'professor'
  | 'classroom'
  | 'schools'
  | 'student_portal'
  | 'teacher_portal'
  | 'guardian_portal'
  | 'certificates';
export type LanguageCode =
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'ar'
  | 'zh'
  | 'yo'
  | 'ha'
  | 'ig'
  | 'sw'
  | 'de'
  | 'hi'
  | 'ja'
  | 'ko'
  | 'ru';
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
  education_level?: string;
  age_group?: 'under_13' | 'teen_13_17' | 'adult' | string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_consent_verified?: number;
  status: string;
  mfa_enabled?: number;
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

export interface AiProviderStatus {
  provider: 'gemini' | 'openai_compatible';
  model: string;
  configured: boolean;
  operational: boolean;
  lastTestedStatus: 'untested' | 'operational' | 'error' | string;
  lastTestedAt: string | null;
  dailyUserLimit: number;
  monthlyCostCapUsd: number;
  monthlyEstimatedCostUsd: number;
  monthlyCallsCount: number;
  childSafetyMode: string;
  availableProviders: Array<{ id: string; label: string; configured: boolean; defaultModel: string }>;
  supportedLanguages: Array<{
    code: LanguageCode;
    name: string;
    nativeName: string;
    rtl: boolean;
    tier: 'initial' | 'expandable';
  }>;
  subjects?: string[];
  assistantIdentity?: string;
  tagline?: string;
}

export interface SchoolSummary {
  id: number;
  name: string;
  school_type: string;
  country: string;
  city: string;
  website: string;
  summary: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  accreditation_note: string;
  child_safety_officer_email: string;
  my_roles: string;
  created_at: string;
}

export interface Course {
  id: number;
  instructor_id: number;
  instructor_user_id?: number;
  instructor_name: string;
  instructor_headline?: string;
  instructor_credentials?: string;
  title: string;
  slug: string;
  category: string;
  subject?: string;
  language_code?: string;
  issuing_organization?: string;
  school_id?: number | null;
  level: string;
  duration_hours: number;
  price_pi: number;
  syllabus_json: string;
  learning_objectives_json?: string;
  modules_notes_json?: string;
  media_lesson_url?: string;
  slides_resources_json?: string;
  assignments_json?: string;
  quizzes_json?: string;
  exam_marking_guide?: string;
  instructor_qualifications_snapshot?: string;
  prerequisites?: string;
  copyright_permission?: string;
  certificate_criteria?: string;
  completeness_score?: number;
  completeness_total?: number;
  completeness_complete?: boolean;
  completeness_missing?: string[];
  module_topics_count?: number;
  assignments_count?: number;
  quizzes_count?: number;
  description: string;
  image_url?: string;
  approval_status: string;
  moderation_action?: string;
  review_notes?: string;
  is_featured: number;
  source_origin?: string;
  source_url?: string;
  availability_status?: string;
  last_verified_at?: string | null;
  has_locked_content?: number;
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
  hub_category?: string;
  country: string;
  website: string;
  summary: string;
  services_offered: string;
  verification_status: string;
  moderation_action?: string;
  review_notes?: string;
  is_featured: number;
  source_origin?: string;
  source_url?: string;
  availability_status?: string;
  last_verified_at?: string | null;
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
  deliverables?: string;
  credentials_summary?: string;
  delivery_days: number;
  price_pi: number;
  approval_status: string;
  moderation_action?: string;
  review_notes?: string;
  source_origin?: string;
  availability_status?: string;
  last_verified_at?: string | null;
  created_at: string;
}

export interface Opportunity {
  id: number;
  poster_user_id: number;
  poster_name: string;
  title: string;
  opportunity_type: 'job' | 'internship' | 'scholarship' | 'grant' | 'fellowship' | 'competition' | 'partnership';
  organization_name: string;
  location: string;
  is_remote: number;
  compensation_or_award: string;
  deadline: string;
  description: string;
  requirements: string;
  eligibility?: string;
  external_url: string;
  approval_status: string;
  moderation_action?: string;
  review_notes?: string;
  source_origin?: string;
  source_url?: string;
  availability_status?: string;
  last_verified_at?: string | null;
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
  market_suite?: string;
  product_type: 'physical' | 'digital' | 'service' | 'web3' | 'pi_app' | 'gaming_asset';
  description: string;
  price_pi: number;
  stock_qty: number;
  image_url?: string;
  approval_status: string;
  moderation_action?: string;
  review_notes?: string;
  source_origin?: string;
  source_url?: string;
  distribution_permission?: string;
  delivery_method?: string;
  refund_support_terms?: string;
  availability_status?: string;
  last_verified_at?: string | null;
  has_locked_content?: number;
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
  event_date?: string;
  event_location?: string;
  moderation_status: string;
  moderation_action?: string;
  review_notes?: string;
  reports_count: number;
  created_at: string;
}

export interface SupplierIntegration {
  id: number;
  supplier_name: string;
  category_suite: string;
  feed_url: string;
  integration_type: 'authorized_api' | 'json_feed' | 'partner_portal';
  distribution_license: string;
  auth_header_name?: string;
  status: 'active' | 'paused' | 'pending_verification';
  last_sync_at?: string | null;
  last_sync_status?: string;
  items_imported_count: number;
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
