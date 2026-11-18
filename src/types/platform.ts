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
  workbooks_exercises_json?: string;
  exam_questions_json?: string;
  answer_keys_text?: string;
  target_audience?: string;
  course_files_json?: string;
  course_files_count?: number;
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
  author_name?: string;
  publication_date?: string;
  version?: string;
  review_status?: string;
  rights_info?: string;
  curriculum_mapping?: string;
  avg_rating?: number | null;
  review_count?: number;
  created_at: string;
}

export interface AiCitation {
  sourceType: 'course' | 'teacher_submission' | 'school_lesson';
  id: number;
  title: string;
  section: string;
  author: string;
  version: string;
  subject: string;
}

export type TeacherSubmissionStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Revision Required'
  | 'Approved'
  | 'Published'
  | 'Rejected'
  | 'Suspended'
  | 'Archived';

export interface TeacherSubmission {
  id: number;
  author_user_id: number;
  author_name?: string;
  author_email?: string;
  school_id?: number | null;
  school_name?: string | null;
  title: string;
  description: string;
  subject: string;
  level: string;
  country: string;
  language_code: string;
  category: string;
  accessibility_notes: string;
  copyright_declared: number;
  license_terms: string;
  current_version: string;
  file_original_name: string;
  file_format: string;
  file_size_bytes: number;
  file_sha256: string;
  status: TeacherSubmissionStatus;
  review_notes: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherSubmissionVersion {
  id: number;
  submission_id: number;
  version: string;
  file_original_name: string;
  file_format: string;
  file_size_bytes: number;
  file_sha256: string;
  change_notes: string;
  actor_name?: string;
  created_at: string;
}

export interface CopyrightReport {
  id: number;
  reporter_user_id: number | null;
  reporter_name?: string;
  target_type: 'course' | 'teacher_submission' | 'product';
  target_id: number;
  claimant_name: string;
  claimant_email: string;
  reason: string;
  details: string;
  evidence_url: string;
  status: 'open' | 'under_review' | 'takedown_executed' | 'rejected';
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export type PolicyKey =
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'seller'
  | 'community'
  | 'child_safety'
  | 'teacher_content'
  | 'ip_policy'
  | 'digital_licence'
  | 'acceptable_use';

export interface CourseCompletenessResult {
  score: number;
  total: number;
  complete: boolean;
  missing: string[];
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
  lifecycle_status?:
    | 'draft'
    | 'submitted'
    | 'awaiting_license_verification'
    | 'awaiting_file_verification'
    | 'approved'
    | 'published'
    | 'suspended'
    | 'out_of_stock'
    | 'archived'
    | string;
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
  file_original_name?: string | null;
  file_format?: string | null;
  file_size_bytes?: number;
  malware_scan_status?: string | null;
  version?: string;
  preview_images_json?: string;
  support_info?: string;
  creator_ownership_attested?: number;
  download_count?: number;
  has_file?: boolean;
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
