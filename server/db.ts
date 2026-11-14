import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

export const DB_PATH = path.join(dataDir, 'ifiok_en.db');
export const BACKUPS_DIR = backupsDir;

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
  `);

  const seedRoles = [
    { slug: 'super_admin', name: 'Global Super Administrator', description: 'Full platform governance, security, backups, and role control', permissions: ['*'] },
    { slug: 'moderator', name: 'Trust & Safety Moderator', description: 'Content moderation, listing review, and dispute triage', permissions: ['moderate', 'approve_listings', 'handle_disputes'] },
    { slug: 'finance_admin', name: 'Pi Settlement & Finance Admin', description: 'Transaction audit, refund authorization, and commission settings', permissions: ['view_transactions', 'refunds', 'commissions'] },
    { slug: 'member', name: 'Member', description: 'Standard verified community and learner access', permissions: ['read', 'apply', 'community', 'buy'] },
    { slug: 'student', name: 'Student', description: 'Academy enrolment and verifiable certificates', permissions: ['read', 'enrol', 'certificates'] },
    { slug: 'instructor', name: 'Instructor', description: 'Course creation and curriculum management', permissions: ['create_courses', 'manage_own_courses'] },
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
    ['hero_subheadline', 'A unified global digital empowerment ecosystem connecting education, verified SME services, freelance work, real opportunities, and Pi-settled commerce.']
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
