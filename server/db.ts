import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
const backupsDir = path.join(dataDir, 'backups');
const uploadsDir = path.join(dataDir, 'uploads');
const privateAssetsDir = path.join(dataDir, 'private_assets');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(privateAssetsDir)) fs.mkdirSync(privateAssetsDir, { recursive: true, mode: 0o700 });

export const DB_PATH = path.join(dataDir, 'ifiok_en.db');
export const BACKUPS_DIR = backupsDir;
export const UPLOADS_DIR = uploadsDir;
export const PRIVATE_ASSETS_DIR = privateAssetsDir;

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      pi_uid TEXT UNIQUE,
      pi_username TEXT,
      full_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      phone_country_code TEXT DEFAULT '+1',
      phone_number TEXT DEFAULT '',
      country TEXT DEFAULT 'Global',
      timezone TEXT DEFAULT 'UTC',
      preferred_currency TEXT DEFAULT 'PI',
      preferred_language TEXT DEFAULT 'en',
      account_type TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      permissions_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      assigned_by INTEGER,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS business_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      business_name TEXT NOT NULL,
      registration_number TEXT DEFAULT '',
      sector TEXT NOT NULL,
      country TEXT NOT NULL,
      website TEXT DEFAULT '',
      summary TEXT NOT NULL,
      services_offered TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      headline TEXT NOT NULL,
      bio TEXT NOT NULL,
      expertise TEXT NOT NULL,
      credentials TEXT DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instructor_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'Beginner',
      duration_hours INTEGER NOT NULL DEFAULT 4,
      price_pi REAL NOT NULL DEFAULT 0,
      syllabus_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrolments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      completed_lessons_json TEXT NOT NULL DEFAULT '[]',
      certificate_code TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_payment', 'active', 'completed')),
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      UNIQUE (user_id, course_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS freelance_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      freelancer_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      delivery_days INTEGER NOT NULL DEFAULT 7,
      price_pi REAL NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (freelancer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      client_user_id INTEGER NOT NULL,
      freelancer_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      brief TEXT NOT NULL,
      budget_pi REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'in_progress', 'delivered', 'completed', 'disputed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (service_id) REFERENCES freelance_services(id) ON DELETE CASCADE,
      FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (freelancer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      store_name TEXT NOT NULL,
      description TEXT NOT NULL,
      country TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      product_type TEXT NOT NULL CHECK (product_type IN ('physical', 'digital', 'service', 'web3', 'pi_app', 'gaming_asset')),
      description TEXT NOT NULL,
      price_pi REAL NOT NULL,
      stock_qty INTEGER NOT NULL DEFAULT 1,
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_user_id INTEGER NOT NULL,
      order_type TEXT NOT NULL CHECK (order_type IN ('product', 'course', 'service', 'subscription', 'business_service')),
      reference_id INTEGER NOT NULL,
      item_title TEXT NOT NULL,
      subtotal_pi REAL NOT NULL,
      platform_fee_pi REAL NOT NULL DEFAULT 0,
      total_pi REAL NOT NULL,
      shipping_info_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'paid', 'fulfilled', 'refunded', 'disputed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      pi_payment_id TEXT UNIQUE,
      txid TEXT,
      environment TEXT NOT NULL DEFAULT 'testnet' CHECK (environment IN ('testnet', 'mainnet')),
      amount_pi REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'failed', 'refunded')),
      verification_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poster_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('job', 'internship', 'scholarship', 'grant', 'partnership')),
      organization_name TEXT NOT NULL,
      location TEXT NOT NULL,
      is_remote INTEGER NOT NULL DEFAULT 0,
      compensation_or_award TEXT NOT NULL,
      deadline TEXT NOT NULL,
      description TEXT NOT NULL,
      requirements TEXT NOT NULL,
      external_url TEXT DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (poster_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER NOT NULL,
      applicant_user_id INTEGER NOT NULL,
      cover_note TEXT NOT NULL,
      portfolio_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'shortlisted', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (opportunity_id, applicant_user_id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
      FOREIGN KEY (applicant_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      post_type TEXT NOT NULL DEFAULT 'discussion' CHECK (post_type IN ('discussion', 'announcement', 'collaboration')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      moderation_status TEXT NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('active', 'flagged', 'removed')),
      reports_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_user_id INTEGER NOT NULL,
      recipient_user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_reported INTEGER NOT NULL DEFAULT 0,
      report_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      link_tab TEXT DEFAULT 'overview',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_slug TEXT NOT NULL CHECK (plan_slug IN ('starter', 'pro_creator', 'verified_business', 'enterprise')),
      price_pi REAL NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'cancelled', 'expired')),
      starts_at TEXT,
      ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('course', 'product', 'service', 'business')),
      target_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'removed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_by_user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('order', 'project', 'message', 'post', 'fraud', 'support')),
      target_id INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'refunded', 'dismissed')),
      resolution_notes TEXT DEFAULT '',
      resolved_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (opened_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      ip_address TEXT DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      user_id INTEGER,
      ip_address TEXT DEFAULT '',
      details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('product', 'course')),
      item_id INTEGER NOT NULL,
      is_unlocked INTEGER NOT NULL DEFAULT 0,
      unlocked_at TEXT,
      revoked_at TEXT,
      UNIQUE (user_id, item_type, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
      user_id INTEGER,
      ip_address TEXT DEFAULT '',
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Global Schools & Institutional Management (Strictly Isolated Per School)
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      school_type TEXT NOT NULL DEFAULT 'Training Institute',
      country TEXT NOT NULL,
      city TEXT DEFAULT '',
      website TEXT DEFAULT '',
      summary TEXT NOT NULL,
      verification_doc_url TEXT DEFAULT '',
      child_safety_officer_email TEXT DEFAULT '',
      accreditation_note TEXT DEFAULT 'Independent institution on IFIOK SCHOOL (no unverified external accreditation claimed).',
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      head_teacher_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      department_id INTEGER,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade_level TEXT NOT NULL DEFAULT 'General',
      teacher_user_id INTEGER,
      schedule_summary TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES school_departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS school_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      member_role TEXT NOT NULL CHECK (member_role IN ('school_admin', 'teacher', 'student', 'guardian')),
      department_id INTEGER,
      class_id INTEGER,
      guardian_of_student_user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (school_id, user_id, member_role),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      teacher_user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      material_url TEXT DEFAULT '',
      scheduled_at TEXT DEFAULT '',
      language_code TEXT NOT NULL DEFAULT 'en',
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      teacher_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      instructions TEXT NOT NULL,
      due_date TEXT NOT NULL,
      max_score INTEGER NOT NULL DEFAULT 100,
      is_exam INTEGER NOT NULL DEFAULT 0,
      time_limit_minutes INTEGER NOT NULL DEFAULT 0,
      questions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      student_user_id INTEGER NOT NULL,
      submission_text TEXT DEFAULT '',
      answers_json TEXT NOT NULL DEFAULT '[]',
      score REAL,
      feedback TEXT DEFAULT '',
      graded_by_user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      graded_at TEXT,
      UNIQUE (assignment_id, student_user_id),
      FOREIGN KEY (assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      student_user_id INTEGER NOT NULL,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
      recorded_by_user_id INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      UNIQUE (class_id, student_user_id, attendance_date),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      sender_user_id INTEGER NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'teachers', 'students', 'guardians')),
      class_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_safety_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER NOT NULL,
      school_id INTEGER,
      context_type TEXT NOT NULL CHECK (context_type IN ('ai_professor', 'classroom', 'lesson', 'peer')),
      reference_id INTEGER DEFAULT 0,
      reason TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      school_id INTEGER,
      course_id INTEGER,
      subject TEXT NOT NULL DEFAULT 'General Studies',
      language_code TEXT NOT NULL DEFAULT 'en',
      mode TEXT NOT NULL DEFAULT 'tutor',
      title TEXT NOT NULL,
      age_restricted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_tutor_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tokens_estimated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES ai_tutor_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      school_id INTEGER,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      feature TEXT NOT NULL,
      language_code TEXT NOT NULL DEFAULT 'en',
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'blocked_safety', 'rate_limited', 'provider_error')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // Safe non-destructive migrations for existing records
  ensureColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'mfa_secret_enc', "TEXT DEFAULT ''");
  ensureColumn('users', 'phone_number_enc', "TEXT DEFAULT ''");
  ensureColumn('users', 'education_level', "TEXT NOT NULL DEFAULT 'undergraduate'");
  ensureColumn('users', 'age_group', "TEXT NOT NULL DEFAULT 'adult'");
  ensureColumn('users', 'guardian_name', "TEXT DEFAULT ''");
  ensureColumn('users', 'guardian_email', "TEXT DEFAULT ''");
  ensureColumn('users', 'guardian_consent_verified', 'INTEGER NOT NULL DEFAULT 0');

  ensureColumn('products', 'image_url', "TEXT DEFAULT ''");
  ensureColumn('products', 'source_origin', "TEXT NOT NULL DEFAULT 'Seller Submission'");
  ensureColumn('products', 'source_url', "TEXT DEFAULT ''");
  ensureColumn('products', 'availability_status', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('products', 'last_verified_at', 'TEXT');
  ensureColumn('products', 'locked_content_enc', "TEXT DEFAULT ''");
  ensureColumn('products', 'market_suite', "TEXT NOT NULL DEFAULT 'software_productivity'");
  ensureColumn('products', 'distribution_permission', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('products', 'delivery_method', "TEXT NOT NULL DEFAULT 'instant_digital_download'");
  ensureColumn('products', 'refund_support_terms', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('products', 'supplier_id', 'INTEGER');
  ensureColumn('products', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('products', 'review_notes', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('products', 'lifecycle_status', "TEXT NOT NULL DEFAULT 'submitted'");
  ensureColumn('products', 'file_storage_key', "TEXT DEFAULT ''");
  ensureColumn('products', 'file_original_name', "TEXT DEFAULT ''");
  ensureColumn('products', 'file_format', "TEXT DEFAULT ''");
  ensureColumn('products', 'file_size_bytes', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('products', 'file_sha256', "TEXT DEFAULT ''");
  ensureColumn('products', 'malware_scan_status', "TEXT NOT NULL DEFAULT 'not_uploaded'");
  ensureColumn('products', 'version', "TEXT NOT NULL DEFAULT '1.0.0'");
  ensureColumn('products', 'preview_images_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('products', 'support_info', "TEXT DEFAULT ''");
  ensureColumn('products', 'creator_ownership_attested', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('products', 'license_verified_at', 'TEXT');
  ensureColumn('products', 'file_verified_at', 'TEXT');
  ensureColumn('products', 'download_count', 'INTEGER NOT NULL DEFAULT 0');

  ensureColumn('courses', 'image_url', "TEXT DEFAULT ''");
  ensureColumn('courses', 'source_origin', "TEXT NOT NULL DEFAULT 'Authorized Educational Material'");
  ensureColumn('courses', 'source_url', "TEXT DEFAULT ''");
  ensureColumn('courses', 'availability_status', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('courses', 'last_verified_at', 'TEXT');
  ensureColumn('courses', 'locked_materials_enc', "TEXT DEFAULT ''");
  ensureColumn('courses', 'subject', "TEXT DEFAULT ''");
  ensureColumn('courses', 'language_code', "TEXT NOT NULL DEFAULT 'en'");
  ensureColumn('courses', 'school_id', 'INTEGER');
  ensureColumn('courses', 'issuing_organization', "TEXT NOT NULL DEFAULT 'IFIOK SCHOOL'");
  ensureColumn('courses', 'learning_objectives_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'modules_notes_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'media_lesson_url', "TEXT DEFAULT ''");
  ensureColumn('courses', 'slides_resources_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'assignments_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'quizzes_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'exam_marking_guide', "TEXT DEFAULT ''");
  ensureColumn('courses', 'instructor_qualifications_snapshot', "TEXT DEFAULT ''");
  ensureColumn('courses', 'prerequisites', "TEXT DEFAULT ''");
  ensureColumn('courses', 'copyright_permission', "TEXT DEFAULT ''");
  ensureColumn('courses', 'certificate_criteria', "TEXT DEFAULT ''");
  ensureColumn('courses', 'completeness_score', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('courses', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('courses', 'review_notes', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('courses', 'workbooks_exercises_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'exam_questions_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('courses', 'answer_keys_text', "TEXT DEFAULT ''");
  ensureColumn('courses', 'target_audience', "TEXT DEFAULT ''");
  ensureColumn('courses', 'course_files_json', "TEXT NOT NULL DEFAULT '[]'");

  ensureColumn('business_profiles', 'source_origin', "TEXT NOT NULL DEFAULT 'Verified Business Submission'");
  ensureColumn('business_profiles', 'source_url', "TEXT DEFAULT ''");
  ensureColumn('business_profiles', 'availability_status', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('business_profiles', 'last_verified_at', 'TEXT');
  ensureColumn('business_profiles', 'registration_number_enc', "TEXT DEFAULT ''");
  ensureColumn('business_profiles', 'hub_category', "TEXT NOT NULL DEFAULT 'Verified SMEs'");
  ensureColumn('business_profiles', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('business_profiles', 'review_notes', "TEXT NOT NULL DEFAULT ''");

  ensureColumn('freelance_services', 'source_origin', "TEXT NOT NULL DEFAULT 'Verified Freelancer Listing'");
  ensureColumn('freelance_services', 'availability_status', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('freelance_services', 'last_verified_at', 'TEXT');
  ensureColumn('freelance_services', 'deliverables', "TEXT DEFAULT ''");
  ensureColumn('freelance_services', 'credentials_summary', "TEXT DEFAULT ''");
  ensureColumn('freelance_services', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('freelance_services', 'review_notes', "TEXT NOT NULL DEFAULT ''");

  ensureColumn('opportunities', 'source_origin', "TEXT NOT NULL DEFAULT 'Issuing Organization Confirmed'");
  ensureColumn('opportunities', 'source_url', "TEXT DEFAULT ''");
  ensureColumn('opportunities', 'availability_status', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('opportunities', 'last_verified_at', 'TEXT');
  ensureColumn('opportunities', 'eligibility', "TEXT DEFAULT ''");
  ensureColumn('opportunities', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('opportunities', 'review_notes', "TEXT NOT NULL DEFAULT ''");

  ensureColumn('community_posts', 'event_date', "TEXT DEFAULT ''");
  ensureColumn('community_posts', 'event_location', "TEXT DEFAULT ''");
  ensureColumn('community_posts', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('community_posts', 'review_notes', "TEXT NOT NULL DEFAULT ''");

  ensureColumn('instructors', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('instructors', 'review_notes', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('sellers', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('sellers', 'review_notes', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('schools', 'moderation_action', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('schools', 'review_notes', "TEXT NOT NULL DEFAULT ''");

  ensureColumn('orders', 'fulfillment_status', "TEXT NOT NULL DEFAULT 'locked_awaiting_payment'");
  ensureColumn('orders', 'idempotency_key', 'TEXT');

  // Safely widen opportunities.opportunity_type CHECK to include 'fellowship' and 'competition'
  const oppTableSql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'opportunities'`)
    .get() as { sql: string } | undefined;
  if (oppTableSql && !oppTableSql.sql.includes("'competition'")) {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE opportunities_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poster_user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('job', 'internship', 'scholarship', 'grant', 'fellowship', 'competition', 'partnership')),
            organization_name TEXT NOT NULL,
            location TEXT NOT NULL,
            is_remote INTEGER NOT NULL DEFAULT 0,
            compensation_or_award TEXT NOT NULL,
            deadline TEXT NOT NULL,
            description TEXT NOT NULL,
            requirements TEXT NOT NULL,
            external_url TEXT DEFAULT '',
            approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            source_origin TEXT NOT NULL DEFAULT 'Issuing Organization Confirmed',
            source_url TEXT DEFAULT '',
            availability_status TEXT NOT NULL DEFAULT 'available',
            last_verified_at TEXT,
            eligibility TEXT DEFAULT '',
            moderation_action TEXT NOT NULL DEFAULT '',
            review_notes TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (poster_user_id) REFERENCES users(id) ON DELETE CASCADE
          );
          INSERT INTO opportunities_new (
            id, poster_user_id, title, opportunity_type, organization_name, location, is_remote,
            compensation_or_award, deadline, description, requirements, external_url, approval_status,
            created_at, source_origin, source_url, availability_status, last_verified_at,
            eligibility, moderation_action, review_notes
          )
          SELECT
            id, poster_user_id, title, opportunity_type, organization_name, location, is_remote,
            compensation_or_award, deadline, description, requirements, external_url, approval_status,
            created_at, source_origin, source_url, availability_status, last_verified_at,
            eligibility, moderation_action, review_notes
          FROM opportunities;
          DROP TABLE opportunities;
          ALTER TABLE opportunities_new RENAME TO opportunities;
        `);
      })();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      category_suite TEXT NOT NULL DEFAULT 'software_productivity',
      feed_url TEXT DEFAULT '',
      integration_type TEXT NOT NULL DEFAULT 'json_feed' CHECK (integration_type IN ('authorized_api', 'json_feed', 'partner_portal')),
      distribution_license TEXT NOT NULL DEFAULT '',
      auth_header_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('active', 'paused', 'pending_verification')),
      last_sync_at TEXT,
      last_sync_status TEXT DEFAULT 'not_synced',
      items_imported_count INTEGER NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pi_testnet_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT UNIQUE NOT NULL,
      txid TEXT,
      username TEXT DEFAULT '',
      pi_uid TEXT DEFAULT '',
      user_id INTEGER,
      amount_pi REAL NOT NULL DEFAULT 0.01,
      memo TEXT DEFAULT 'IFIOK-EN Testnet Test',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      environment TEXT NOT NULL DEFAULT 'testnet',
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'failed')),
      verification_payload_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS product_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      order_id INTEGER,
      ip_address TEXT DEFAULT '',
      downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS course_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      file_key TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      term_label TEXT DEFAULT 'Term 1',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_txid_unique ON payments(txid) WHERE txid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pi_testnet_payments_status ON pi_testnet_payments(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_product_downloads_prod ON product_downloads(product_id, downloaded_at);
    CREATE INDEX IF NOT EXISTS idx_school_sessions_school ON school_sessions(school_id, is_active);
  `);

  const seedRoles = [
    { slug: 'super_admin', name: 'Global Super Administrator', description: 'Full platform governance, security, backups, and role control', permissions: ['*'] },
    { slug: 'moderator', name: 'Trust & Safety Moderator', description: 'Content moderation, listing review, and dispute triage', permissions: ['moderate', 'approve_listings', 'handle_disputes'] },
    { slug: 'finance_admin', name: 'Pi Settlement & Finance Admin', description: 'Transaction audit, refund authorization, and commission settings', permissions: ['view_transactions', 'refunds', 'commissions'] },
    { slug: 'member', name: 'Member', description: 'Standard verified community and learner access', permissions: ['read', 'apply', 'community', 'buy'] },
    { slug: 'student', name: 'Student', description: 'IFIOK SCHOOL enrolment, IFIOK Professor tutoring, exams, and verifiable certificates', permissions: ['read', 'enrol', 'certificates', 'ai_tutor'] },
    { slug: 'instructor', name: 'Instructor', description: 'Course creation and curriculum management', permissions: ['create_courses', 'manage_own_courses'] },
    { slug: 'teacher', name: 'School Teacher', description: 'Institutional lesson creation, quizzes, homework, grading, and attendance', permissions: ['teach_school_classes', 'grade_students', 'ai_teacher_prep'] },
    { slug: 'school_admin', name: 'School Administrator', description: 'Isolated institutional school management, departments, classes, and reports', permissions: ['manage_school', 'enrol_school_students', 'view_school_reports'] },
    { slug: 'guardian', name: 'Parent / Guardian', description: 'Linked minor learner monitoring and consent oversight', permissions: ['view_ward_progress', 'guardian_oversight'] },
    { slug: 'freelancer', name: 'Freelancer', description: 'Professional service listings and project delivery', permissions: ['create_services', 'deliver_projects'] },
    { slug: 'seller', name: 'Marketplace Seller', description: 'Storefront management and physical/digital product fulfilment', permissions: ['create_products', 'fulfil_orders'] },
    { slug: 'organisation', name: 'Business & Organisation', description: 'Verified SME hub profiles, consulting requests, and opportunity publishing', permissions: ['create_business', 'post_opportunities'] }
  ];

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (slug, name, description, permissions_json)
    VALUES (?, ?, ?, ?)
  `);
  for (const r of seedRoles) {
    insertRole.run(r.slug, r.name, r.description, JSON.stringify(r.permissions));
  }

  // Non-destructive branding & lifecycle migration for existing rows
  db.exec(`
    UPDATE courses SET issuing_organization = 'IFIOK SCHOOL' WHERE issuing_organization = 'IFIOK Academy';
    UPDATE schools SET accreditation_note = replace(accreditation_note, 'IFIOK Academy', 'IFIOK SCHOOL') WHERE accreditation_note LIKE '%IFIOK Academy%';
    UPDATE roles SET description = 'IFIOK SCHOOL enrolment, IFIOK Professor tutoring, exams, and verifiable certificates' WHERE slug = 'student';
    UPDATE products SET lifecycle_status = 'published' WHERE approval_status = 'approved' AND lifecycle_status = 'submitted';
    UPDATE products SET lifecycle_status = 'suspended' WHERE approval_status = 'rejected' AND moderation_action = 'suspended' AND lifecycle_status = 'submitted';
  `);

  const defaultSettings: Array<[string, string]> = [
    ['pi_environment', process.env.PI_ENVIRONMENT === 'mainnet' ? 'testnet' : 'testnet'],
    ['mainnet_enabled', 'false'],
    ['freelance_commission_pct', '8'],
    ['marketplace_commission_pct', '5'],
    ['subscription_pro_pi', '12'],
    ['subscription_business_pi', '35'],
    ['subscription_enterprise_pi', '90'],
    ['announcement_banner', ''],
    ['support_email', 'support@ifiok-en.org'],
    ['informational_usd_per_pi', '1.00'],
    ['hero_headline', 'Your World. Your Opportunities. Your Digital Future.'],
    ['hero_subheadline', 'A unified global digital empowerment ecosystem connecting education, verified SME services, freelance work, real opportunities, and Pi-settled commerce.'],
    ['ai_provider', 'gemini'],
    ['ai_model', 'gemini-4-hydrogen'],
    ['ai_daily_user_limit', '40'],
    ['ai_monthly_cost_cap_usd', '50'],
    ['ai_child_safety_mode', 'strict'],
    ['ai_last_verified_status', 'untested'],
    ['ai_last_verified_at', '']
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)
  `);
  for (const [k, v] of defaultSettings) {
    insertSetting.run(k, v);
  }

  // Optional environment-driven initial admin seed (never hardcoded in frontend)
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envAdminPass = process.env.ADMIN_INITIAL_PASSWORD;
  if (envAdminEmail && envAdminPass && envAdminPass.length >= 10) {
    const existingAdmins = db.prepare(`
      SELECT COUNT(*) as cnt FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'super_admin'
    `).get() as { cnt: number };

    if (existingAdmins.cnt === 0) {
      const hash = bcrypt.hashSync(envAdminPass, 12);
      const res = db.prepare(`
        INSERT OR IGNORE INTO users (email, password_hash, full_name, country, timezone, account_type, email_verified)
        VALUES (?, ?, 'IFIOK-EN Global Administrator', 'Global', 'UTC', 'organisation', 1)
      `).run(envAdminEmail, hash);
      if (res.lastInsertRowid) {
        const role = db.prepare(`SELECT id FROM roles WHERE slug = 'super_admin'`).get() as { id: number };
        db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(res.lastInsertRowid, role.id);
      }
    }
  }
}

export function getSettingsMap(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM platform_settings`).all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}
