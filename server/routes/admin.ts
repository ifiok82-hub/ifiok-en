import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { BACKUPS_DIR, db, getSettingsMap } from '../db.ts';
import {
  evaluateCourseCompleteness,
  MARKET_SUITE_IDS,
  validateSupplierFeedUrl,
} from '../lib/courseCompleteness.ts';
import { encryptSensitive, sanitizeHttpUrl } from '../lib/crypto.ts';
import {
  assignRole,
  createNotification,
  recordAudit,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth, requireRole('super_admin', 'moderator', 'finance_admin'));

function mapApprovalAction(
  requested: unknown,
  kind: 'approval' | 'verification' | 'seller'
): { dbStatus: string; moderationAction: string; label: string } | null {
  const val = typeof requested === 'string' ? requested.trim() : '';
  if (val === 'approve' || val === 'approved' || val === 'verified') {
    return {
      dbStatus: kind === 'approval' ? 'approved' : 'verified',
      moderationAction: 'approved',
      label: kind === 'approval' ? 'approved' : 'verified',
    };
  }
  if (val === 'reject' || val === 'rejected') {
    return {
      dbStatus: kind === 'seller' ? 'suspended' : 'rejected',
      moderationAction: 'rejected',
      label: 'rejected',
    };
  }
  if (val === 'suspend' || val === 'suspended') {
    return {
      dbStatus: kind === 'seller' ? 'suspended' : 'rejected',
      moderationAction: 'suspended',
      label: 'suspended',
    };
  }
  if (val === 'request_correction' || val === 'correction_requested' || val === 'pending') {
    return {
      dbStatus: 'pending',
      moderationAction: val === 'pending' ? '' : 'correction_requested',
      label: val === 'pending' ? 'pending' : 'correction_requested',
    };
  }
  return null;
}

router.get('/overview', (_req, res) => {
  const analytics = {
    totalUsers: (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c,
    activeUsers: (db.prepare(`SELECT COUNT(*) as c FROM users WHERE status = 'active'`).get() as { c: number }).c,
    suspendedUsers: (db.prepare(`SELECT COUNT(*) as c FROM users WHERE status = 'suspended'`).get() as { c: number }).c,
    pendingBusinesses: (db.prepare(`SELECT COUNT(*) as c FROM business_profiles WHERE verification_status = 'pending'`).get() as { c: number }).c,
    pendingCourses: (db.prepare(`SELECT COUNT(*) as c FROM courses WHERE approval_status = 'pending'`).get() as { c: number }).c,
    pendingProducts: (db.prepare(`SELECT COUNT(*) as c FROM products WHERE approval_status = 'pending'`).get() as { c: number }).c,
    pendingOpportunities: (db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE approval_status = 'pending'`).get() as { c: number }).c,
    pendingServices: (db.prepare(`SELECT COUNT(*) as c FROM freelance_services WHERE approval_status = 'pending'`).get() as { c: number }).c,
    pendingSchools: (db.prepare(`SELECT COUNT(*) as c FROM schools WHERE verification_status = 'pending'`).get() as { c: number }).c,
    openSafetyReports: (db.prepare(`SELECT COUNT(*) as c FROM student_safety_reports WHERE status = 'open'`).get() as { c: number }).c,
    openDisputes: (db.prepare(`SELECT COUNT(*) as c FROM disputes WHERE status IN ('open', 'under_review')`).get() as { c: number }).c,
    completedPaymentsCount: (db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status = 'completed'`).get() as { c: number }).c,
    completedVolumePi: (db.prepare(`SELECT COALESCE(SUM(amount_pi), 0) as s FROM payments WHERE status = 'completed'`).get() as { s: number }).s,
    totalCommissionPi: (db.prepare(`SELECT COALESCE(SUM(platform_fee_pi), 0) as s FROM orders WHERE status IN ('paid', 'fulfilled')`).get() as { s: number }).s,
  };

  const users = db.prepare(`
    SELECT u.id, u.email, u.pi_username, u.full_name, u.country, u.account_type, u.status, u.created_at,
      GROUP_CONCAT(r.slug) as roles_csv
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 100
  `).all();

  const roles = db.prepare(`SELECT * FROM roles`).all();
  const businesses = db.prepare(`
    SELECT b.*, u.full_name as owner_name, u.email as owner_email
    FROM business_profiles b JOIN users u ON u.id = b.owner_user_id
    ORDER BY b.created_at DESC
  `).all();
  const instructors = db.prepare(`
    SELECT i.*, u.full_name, u.email FROM instructors i JOIN users u ON u.id = i.user_id ORDER BY i.created_at DESC
  `).all();
  const coursesRaw = db.prepare(`
    SELECT c.*, u.full_name as instructor_name, i.credentials as instructor_credentials
    FROM courses c JOIN instructors i ON i.id = c.instructor_id JOIN users u ON u.id = i.user_id
    ORDER BY c.created_at DESC
  `).all() as Array<Record<string, unknown>>;
  const courses = coursesRaw.map((c) => {
    const completeness = evaluateCourseCompleteness(c, { credentials: c.instructor_credentials });
    const { locked_materials_enc: _omit, ...safeCourse } = c;
    return {
      ...safeCourse,
      completeness_score: completeness.score,
      completeness_total: completeness.total,
      completeness_complete: completeness.complete,
      completeness_missing: completeness.missing,
      completeness_checklist: completeness.checklist,
    };
  });
  const sellers = db.prepare(`
    SELECT s.*, u.full_name, u.email FROM sellers s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC
  `).all();
  const products = db.prepare(`
    SELECT p.id, p.seller_id, p.title, p.category, p.market_suite, p.product_type, p.description, p.price_pi,
           p.stock_qty, p.image_url, p.approval_status, p.source_origin, p.source_url, p.distribution_permission,
           p.delivery_method, p.refund_support_terms, p.availability_status, p.last_verified_at,
           p.moderation_action, p.review_notes, p.created_at, s.store_name
    FROM products p JOIN sellers s ON s.id = p.seller_id ORDER BY p.created_at DESC
  `).all();
  const opportunities = db.prepare(`
    SELECT o.*, u.full_name as poster_name FROM opportunities o JOIN users u ON u.id = o.poster_user_id ORDER BY o.created_at DESC
  `).all();
  const services = db.prepare(`
    SELECT fs.*, u.full_name as freelancer_name FROM freelance_services fs JOIN users u ON u.id = fs.freelancer_user_id ORDER BY fs.created_at DESC
  `).all();
  const communityPosts = db.prepare(`
    SELECT cp.*, u.full_name as author_name FROM community_posts cp JOIN users u ON u.id = cp.author_user_id ORDER BY cp.reports_count DESC, cp.created_at DESC
  `).all();
  const transactions = db.prepare(`
    SELECT o.*, p.pi_payment_id, p.txid, p.environment, p.status as payment_status, u.full_name as buyer_name
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    JOIN users u ON u.id = o.buyer_user_id
    ORDER BY o.created_at DESC LIMIT 100
  `).all();
  const piTestnetPayments = db.prepare(`
    SELECT * FROM pi_testnet_payments ORDER BY created_at DESC LIMIT 80
  `).all();
  const entitlements = db.prepare(`
    SELECT e.id, e.user_id, e.order_id, e.item_type, e.item_id, e.is_unlocked, e.unlocked_at, e.revoked_at,
           o.item_title, o.status as order_status, o.total_pi, u.full_name as user_name, u.email as user_email
    FROM entitlements e
    JOIN orders o ON o.id = e.order_id
    JOIN users u ON u.id = e.user_id
    ORDER BY e.id DESC LIMIT 100
  `).all();
  const supplierIntegrations = db.prepare(`
    SELECT * FROM supplier_integrations ORDER BY created_at DESC
  `).all();
  const subscriptions = db.prepare(`
    SELECT s.*, u.full_name, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC
  `).all();
  const disputes = db.prepare(`
    SELECT d.*, u.full_name as reporter_name FROM disputes d JOIN users u ON u.id = d.opened_by_user_id ORDER BY d.created_at DESC
  `).all();
  const auditLogs = db.prepare(`
    SELECT a.*, u.full_name as actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 120
  `).all();
  const securityEvents = db.prepare(`
    SELECT se.*, u.email as user_email FROM security_events se LEFT JOIN users u ON u.id = se.user_id ORDER BY se.created_at DESC LIMIT 80
  `).all();
  const securityAlerts = db.prepare(`
    SELECT sa.*, u.email as user_email FROM security_alerts sa LEFT JOIN users u ON u.id = sa.user_id ORDER BY sa.created_at DESC LIMIT 80
  `).all();
  const schools = db.prepare(`
    SELECT sc.*, u.full_name as owner_name, u.email as owner_email
    FROM schools sc JOIN users u ON u.id = sc.owner_user_id
    ORDER BY sc.created_at DESC
  `).all();

  let backupFiles: string[] = [];
  if (fs.existsSync(BACKUPS_DIR)) {
    backupFiles = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.db') || f.endsWith('.json')).sort().reverse();
  }

  res.json({
    analytics,
    settings: getSettingsMap(),
    roles,
    users,
    businesses,
    instructors,
    courses,
    sellers,
    products,
    opportunities,
    services,
    schools,
    communityPosts,
    transactions,
    piTestnetPayments,
    entitlements,
    supplierIntegrations,
    subscriptions,
    disputes,
    auditLogs,
    securityEvents,
    securityAlerts,
    backupFiles,
  });
});

// Member status management (suspend / reactivate)
router.patch('/users/:id/status', requireRole('super_admin', 'moderator'), (req, res) => {
  const targetId = Number(req.params.id);
  const status = req.body?.status;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (targetId === req.authUser!.id && status === 'suspended') {
    return res.status(400).json({ error: 'Administrators cannot suspend their own active session.' });
  }
  db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, targetId);
  recordAudit(req.authUser!.id, `user_${status}`, 'user', targetId, req.ip || '', {});
  return res.json({ ok: true });
});

// Admin role assignment (super_admin only)
router.post('/users/:id/roles', requireRole('super_admin'), (req, res) => {
  const targetId = Number(req.params.id);
  const roleSlug = typeof req.body?.roleSlug === 'string' ? req.body.roleSlug.trim() : '';
  const action = req.body?.action === 'revoke' ? 'revoke' : 'grant';

  const role = db.prepare(`SELECT id FROM roles WHERE slug = ?`).get(roleSlug) as { id: number } | undefined;
  if (!role) return res.status(404).json({ error: 'Role slug not found.' });

  if (action === 'revoke') {
    if (targetId === req.authUser!.id && roleSlug === 'super_admin') {
      return res.status(400).json({ error: 'Cannot revoke your own super_admin role.' });
    }
    db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`).run(targetId, role.id);
  } else {
    assignRole(targetId, roleSlug, req.authUser!.id);
  }

  recordAudit(req.authUser!.id, `role_${action}`, 'user', targetId, req.ip || '', { roleSlug });
  return res.json({ ok: true });
});

// Listing & Account Verifications (Approve, Reject, Suspend, Request Corrections)
router.patch('/businesses/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.verificationStatus, 'verification');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  const isFeatured = req.body?.isFeatured ? 1 : 0;
  if (!mapped) return res.status(400).json({ error: 'Invalid verification action.' });

  const row = db.prepare(`SELECT owner_user_id, business_name FROM business_profiles WHERE id = ?`).get(id) as
    | { owner_user_id: number; business_name: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Business not found.' });

  db.prepare(`
    UPDATE business_profiles
    SET verification_status = ?, moderation_action = ?, review_notes = ?, is_featured = ?,
        last_verified_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE last_verified_at END
    WHERE id = ?
  `).run(mapped.dbStatus, mapped.moderationAction, reviewNotes, isFeatured, mapped.dbStatus, id);

  createNotification(
    row.owner_user_id,
    'business',
    'Business Verification Updated',
    `"${row.business_name}" status is now ${mapped.label}.${reviewNotes ? ` Review notes: ${reviewNotes}` : ''}`,
    'business'
  );
  recordAudit(req.authUser!.id, 'business_moderation', 'business_profile', id, req.ip || '', { status: mapped.label, reviewNotes, isFeatured });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/instructors/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.approvalStatus, 'approval');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid approval action.' });

  const row = db.prepare(`SELECT user_id, headline FROM instructors WHERE id = ?`).get(id) as
    | { user_id: number; headline: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Instructor profile not found.' });

  db.prepare(`UPDATE instructors SET approval_status = ?, moderation_action = ?, review_notes = ? WHERE id = ?`).run(
    mapped.dbStatus,
    mapped.moderationAction,
    reviewNotes,
    id
  );
  createNotification(
    row.user_id,
    'academy',
    'Instructor Status Updated',
    `Your instructor profile ("${row.headline}") is now ${mapped.label}.${reviewNotes ? ` Notes: ${reviewNotes}` : ''}`,
    'academy'
  );
  recordAudit(req.authUser!.id, 'instructor_moderation', 'instructor', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/courses/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.approvalStatus, 'approval');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  const isFeatured = req.body?.isFeatured ? 1 : 0;
  if (!mapped) return res.status(400).json({ error: 'Invalid course moderation action.' });

  const course = db.prepare(`
    SELECT c.*, i.user_id as instructor_user_id, i.credentials as instructor_credentials
    FROM courses c JOIN instructors i ON i.id = c.instructor_id WHERE c.id = ?
  `).get(id) as Record<string, unknown> | undefined;
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const completeness = evaluateCourseCompleteness(course, { credentials: course.instructor_credentials });

  // Mandatory 15-point curriculum gate for any paid course before live approval
  if (mapped.dbStatus === 'approved' && Number(course.price_pi) > 0 && !completeness.complete) {
    return res.status(400).json({
      error: `Paid IFIOK SCHOOL courses require all 15 curriculum components before approval (${completeness.score}/15 complete). Missing: ${completeness.missing.slice(0, 4).join('; ')}${completeness.missing.length > 4 ? ` (+${completeness.missing.length - 4} more)` : ''}.`,
      completeness,
    });
  }

  db.prepare(`
    UPDATE courses
    SET approval_status = ?, moderation_action = ?, review_notes = ?, is_featured = ?, completeness_score = ?,
        last_verified_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE last_verified_at END
    WHERE id = ?
  `).run(mapped.dbStatus, mapped.moderationAction, reviewNotes, isFeatured, completeness.score, mapped.dbStatus, id);

  createNotification(
    Number(course.instructor_user_id),
    'academy',
    'Course Moderation Update',
    `"${String(course.title)}" is now ${mapped.label}.${reviewNotes ? ` Reviewer feedback: ${reviewNotes}` : ''}`,
    'academy'
  );
  recordAudit(req.authUser!.id, 'course_moderation', 'course', id, req.ip || '', {
    status: mapped.label,
    reviewNotes,
    isFeatured,
    completenessScore: completeness.score,
  });
  res.json({ ok: true, status: mapped.label, completeness });
});

router.patch('/sellers/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.verificationStatus, 'seller');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid seller verification action.' });

  const row = db.prepare(`SELECT user_id, store_name FROM sellers WHERE id = ?`).get(id) as
    | { user_id: number; store_name: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Seller storefront not found.' });

  db.prepare(`UPDATE sellers SET verification_status = ?, moderation_action = ?, review_notes = ? WHERE id = ?`).run(
    mapped.dbStatus,
    mapped.moderationAction,
    reviewNotes,
    id
  );
  createNotification(
    row.user_id,
    'market',
    'Seller Storefront Status Updated',
    `Storefront "${row.store_name}" status is now ${mapped.label}.${reviewNotes ? ` Notes: ${reviewNotes}` : ''}`,
    'market'
  );
  recordAudit(req.authUser!.id, 'seller_moderation', 'seller', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/products/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.approvalStatus, 'approval');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid product moderation action.' });

  const row = db.prepare(`
    SELECT p.title, s.user_id as seller_user_id FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?
  `).get(id) as { title: string; seller_user_id: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Product not found.' });

  db.prepare(`
    UPDATE products
    SET approval_status = ?, moderation_action = ?, review_notes = ?,
        last_verified_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE last_verified_at END
    WHERE id = ?
  `).run(mapped.dbStatus, mapped.moderationAction, reviewNotes, mapped.dbStatus, id);

  createNotification(
    row.seller_user_id,
    'market',
    'Marketplace Listing Updated',
    `Product "${row.title}" status is now ${mapped.label}.${reviewNotes ? ` Review notes: ${reviewNotes}` : ''}`,
    'market'
  );
  recordAudit(req.authUser!.id, 'product_moderation', 'product', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/products/:id/availability', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const availability = req.body?.availabilityStatus;
  if (!['available', 'limited', 'out_of_stock'].includes(availability)) {
    return res.status(400).json({ error: 'Invalid availability status.' });
  }
  const hasStockQty = req.body?.stockQty !== undefined && Number.isFinite(Number(req.body.stockQty));
  const stockQty = hasStockQty ? Math.max(0, Math.round(Number(req.body.stockQty))) : null;

  if (stockQty !== null) {
    db.prepare(`UPDATE products SET availability_status = ?, stock_qty = ? WHERE id = ?`).run(availability, stockQty, id);
  } else {
    db.prepare(`UPDATE products SET availability_status = ? WHERE id = ?`).run(availability, id);
  }
  recordAudit(req.authUser!.id, 'product_inventory_updated', 'product', id, req.ip || '', { availability, stockQty });
  return res.json({ ok: true });
});

router.patch('/opportunities/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.approvalStatus, 'approval');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid opportunity moderation action.' });

  const row = db.prepare(`SELECT poster_user_id, title FROM opportunities WHERE id = ?`).get(id) as
    | { poster_user_id: number; title: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Opportunity not found.' });

  db.prepare(`
    UPDATE opportunities
    SET approval_status = ?, moderation_action = ?, review_notes = ?,
        last_verified_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE last_verified_at END
    WHERE id = ?
  `).run(mapped.dbStatus, mapped.moderationAction, reviewNotes, mapped.dbStatus, id);

  createNotification(
    row.poster_user_id,
    'opportunities',
    'Opportunity Moderation Update',
    `"${row.title}" status is now ${mapped.label}.${reviewNotes ? ` Review notes: ${reviewNotes}` : ''}`,
    'opportunities'
  );
  recordAudit(req.authUser!.id, 'opportunity_moderation', 'opportunity', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/services/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.approvalStatus, 'approval');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid service moderation action.' });

  const row = db.prepare(`SELECT freelancer_user_id, title FROM freelance_services WHERE id = ?`).get(id) as
    | { freelancer_user_id: number; title: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Service not found.' });

  db.prepare(`
    UPDATE freelance_services
    SET approval_status = ?, moderation_action = ?, review_notes = ?,
        last_verified_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE last_verified_at END
    WHERE id = ?
  `).run(mapped.dbStatus, mapped.moderationAction, reviewNotes, mapped.dbStatus, id);

  createNotification(
    row.freelancer_user_id,
    'freelance',
    'Freelance Service Moderation Update',
    `"${row.title}" status is now ${mapped.label}.${reviewNotes ? ` Review notes: ${reviewNotes}` : ''}`,
    'freelance'
  );
  recordAudit(req.authUser!.id, 'service_moderation', 'freelance_service', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

router.patch('/community-posts/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.moderationStatus;
  if (!['active', 'flagged', 'removed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE community_posts SET moderation_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'community_post_moderation', 'community_post', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/schools/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const mapped = mapApprovalAction(req.body?.moderationAction || req.body?.verificationStatus, 'verification');
  const reviewNotes = typeof req.body?.reviewNotes === 'string' ? req.body.reviewNotes.trim().slice(0, 500) : '';
  if (!mapped) return res.status(400).json({ error: 'Invalid school verification status' });
  const row = db.prepare(`SELECT owner_user_id, name FROM schools WHERE id = ?`).get(id) as
    | { owner_user_id: number; name: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Institution not found.' });
  db.prepare(`UPDATE schools SET verification_status = ?, moderation_action = ?, review_notes = ? WHERE id = ?`).run(
    mapped.dbStatus,
    mapped.moderationAction,
    reviewNotes,
    id
  );
  createNotification(
    row.owner_user_id,
    'academy',
    'School Verification Updated',
    `Institution "${row.name}" verification status updated to "${mapped.label}".${reviewNotes ? ` Notes: ${reviewNotes}` : ''}`,
    'academy'
  );
  recordAudit(req.authUser!.id, 'school_moderation', 'school', id, req.ip || '', { status: mapped.label, reviewNotes });
  res.json({ ok: true, status: mapped.label });
});

// Entitlement Lock / Revoke / Unlock Control (enforces paid order before unlocking)
router.patch('/entitlements/:id', requireRole('super_admin', 'finance_admin'), (req, res) => {
  const id = Number(req.params.id);
  const unlock = Boolean(req.body?.isUnlocked);

  const row = db.prepare(`
    SELECT e.id, e.user_id, e.item_type, e.item_id, o.status as order_status, o.item_title
    FROM entitlements e JOIN orders o ON o.id = e.order_id WHERE e.id = ?
  `).get(id) as { id: number; user_id: number; item_type: string; item_id: number; order_status: string; item_title: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Entitlement record not found.' });

  if (unlock && !['paid', 'fulfilled'].includes(row.order_status)) {
    return res.status(400).json({ error: 'Cannot unlock entitlement because its Pi Network order is not verified/paid.' });
  }

  db.prepare(`
    UPDATE entitlements
    SET is_unlocked = ?,
        unlocked_at = CASE WHEN ? = 1 THEN COALESCE(unlocked_at, datetime('now')) ELSE unlocked_at END,
        revoked_at = CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(unlock ? 1 : 0, unlock ? 1 : 0, unlock ? 1 : 0, id);

  recordAudit(req.authUser!.id, unlock ? 'entitlement_unlocked' : 'entitlement_revoked', 'entitlement', id, req.ip || '', {
    itemType: row.item_type,
    itemId: row.item_id,
  });
  res.json({ ok: true, isUnlocked: unlock });
});

// Disputes, complaints, and refund authorization
router.patch('/disputes/:id', requireRole('super_admin', 'moderator', 'finance_admin'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  const resolutionNotes = typeof req.body?.resolutionNotes === 'string' ? req.body.resolutionNotes.trim() : '';

  if (!['open', 'under_review', 'resolved', 'refunded', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid dispute status.' });
  }

  const dispute = db.prepare(`SELECT * FROM disputes WHERE id = ?`).get(id) as
    | { id: number; opened_by_user_id: number; target_type: string; target_id: number }
    | undefined;
  if (!dispute) return res.status(404).json({ error: 'Dispute not found.' });

  db.transaction(() => {
    db.prepare(`
      UPDATE disputes
      SET status = ?, resolution_notes = ?, resolved_by_user_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, resolutionNotes, req.authUser!.id, id);

    if (status === 'refunded' && dispute.target_type === 'order' && dispute.target_id > 0) {
      db.prepare(`UPDATE orders SET status = 'refunded', fulfillment_status = 'revoked_refunded' WHERE id = ?`).run(dispute.target_id);
      db.prepare(`UPDATE payments SET status = 'refunded', updated_at = datetime('now') WHERE order_id = ?`).run(dispute.target_id);
      db.prepare(`UPDATE entitlements SET is_unlocked = 0, revoked_at = datetime('now') WHERE order_id = ?`).run(dispute.target_id);
    }

    createNotification(
      dispute.opened_by_user_id,
      'support',
      'Dispute / Support Case Updated',
      `Case #${id} status updated to "${status}". ${resolutionNotes}`,
      'support'
    );
    recordAudit(req.authUser!.id, 'dispute_updated', 'dispute', id, req.ip || '', { status });
  })();

  res.json({ ok: true });
});

// Platform Settings, Commissions, Announcements, Website Content
router.patch('/settings', requireRole('super_admin', 'finance_admin'), (req, res) => {
  const allowedKeys = [
    'freelance_commission_pct',
    'marketplace_commission_pct',
    'subscription_pro_pi',
    'subscription_business_pi',
    'subscription_enterprise_pi',
    'announcement_banner',
    'support_email',
    'informational_usd_per_pi',
    'hero_headline',
    'hero_subheadline',
  ];

  const updates = req.body?.settings;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object required.' });
  }

  const upsert = db.prepare(`
    INSERT INTO platform_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `);

  db.transaction(() => {
    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        upsert.run(key, String(updates[key]).slice(0, 500), req.authUser!.id);
      }
    }
    recordAudit(req.authUser!.id, 'platform_settings_updated', 'platform_settings', 'global', req.ip || '', updates);
  })();

  res.json({ settings: getSettingsMap() });
});

// Real SQLite Snapshot Backup & Download
router.post('/backups/snapshot', requireRole('super_admin'), async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `ifiok_en_backup_${timestamp}.db`;
  const destPath = path.join(BACKUPS_DIR, fileName);
  try {
    await db.backup(destPath);
    recordAudit(req.authUser!.id, 'database_backup_created', 'backup', fileName, req.ip || '', {});
    return res.status(201).json({ fileName });
  } catch (err) {
    return res.status(500).json({ error: `Backup failed: ${String(err)}` });
  }
});

router.get('/backups/download/:fileName', requireRole('super_admin'), (req, res) => {
  const safeName = path.basename(String(req.params.fileName || ''));
  const target = path.join(BACKUPS_DIR, safeName);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Backup file not found.' });
  recordAudit(req.authUser!.id, 'database_backup_downloaded', 'backup', safeName, req.ip || '', {});
  return res.download(target, safeName);
});

// Acknowledge or resolve security alerts
router.patch('/security-alerts/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!['open', 'acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid security alert status.' });
  }
  db.prepare(`UPDATE security_alerts SET status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'security_alert_updated', 'security_alert', id, req.ip || '', { status });
  return res.json({ ok: true });
});

// Authorized Supplier API & Structured JSON Feed Integrations (Strict Provenance + SSRF Guard)
router.get('/supplier-integrations', requireRole('super_admin', 'moderator'), (_req, res) => {
  const rows = db.prepare(`SELECT * FROM supplier_integrations ORDER BY created_at DESC`).all();
  res.json({ supplierIntegrations: rows });
});

router.post('/supplier-integrations', requireRole('super_admin'), (req, res) => {
  const supplierName = typeof req.body?.supplierName === 'string' ? req.body.supplierName.trim().slice(0, 120) : '';
  const categorySuite = (MARKET_SUITE_IDS as readonly string[]).includes(req.body?.categorySuite)
    ? req.body.categorySuite
    : 'software_productivity';
  const integrationType = ['authorized_api', 'json_feed', 'partner_portal'].includes(req.body?.integrationType)
    ? req.body.integrationType
    : 'json_feed';
  const distributionLicense = typeof req.body?.distributionLicense === 'string' ? req.body.distributionLicense.trim().slice(0, 240) : '';
  const authHeaderName = typeof req.body?.authHeaderName === 'string' ? req.body.authHeaderName.trim().slice(0, 80) : '';
  const rawFeedUrl = typeof req.body?.feedUrl === 'string' ? req.body.feedUrl.trim() : '';

  if (supplierName.length < 3 || distributionLicense.length < 5) {
    return res.status(400).json({ error: 'Supplier name and verified distribution/resale license attestation are required.' });
  }

  let safeUrl = '';
  if (rawFeedUrl) {
    const check = validateSupplierFeedUrl(rawFeedUrl);
    if (!check.ok) return res.status(400).json({ error: check.error });
    safeUrl = check.url;
  }

  const ins = db.prepare(`
    INSERT INTO supplier_integrations (
      supplier_name, category_suite, feed_url, integration_type, distribution_license, auth_header_name, status, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(supplierName, categorySuite, safeUrl, integrationType, distributionLicense, authHeaderName, req.authUser!.id);

  recordAudit(req.authUser!.id, 'supplier_integration_added', 'supplier_integration', Number(ins.lastInsertRowid), req.ip || '', {
    supplierName,
    categorySuite,
    integrationType,
  });
  return res.status(201).json({ id: Number(ins.lastInsertRowid), status: 'active' });
});

router.patch('/supplier-integrations/:id', requireRole('super_admin'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!['active', 'paused', 'pending_verification'].includes(status)) {
    return res.status(400).json({ error: 'Invalid supplier integration status.' });
  }
  db.prepare(`UPDATE supplier_integrations SET status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'supplier_integration_status', 'supplier_integration', id, req.ip || '', { status });
  return res.json({ ok: true });
});

router.post('/supplier-integrations/:id/sync', requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const supplier = db.prepare(`SELECT * FROM supplier_integrations WHERE id = ?`).get(id) as
    | {
        id: number;
        supplier_name: string;
        category_suite: string;
        feed_url: string;
        distribution_license: string;
        status: string;
      }
    | undefined;

  if (!supplier) return res.status(404).json({ error: 'Supplier integration not found.' });
  if (supplier.status !== 'active') {
    return res.status(400).json({ error: 'Supplier integration must be active before syncing.' });
  }
  const urlCheck = validateSupplierFeedUrl(supplier.feed_url);
  if (!urlCheck.ok) {
    return res.status(400).json({ error: urlCheck.error });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const feedRes = await fetch(urlCheck.url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!feedRes.ok) {
      db.prepare(`UPDATE supplier_integrations SET last_sync_at = datetime('now'), last_sync_status = ? WHERE id = ?`).run(
        `http_error_${feedRes.status}`,
        id
      );
      return res.status(502).json({ error: `Supplier feed returned HTTP ${feedRes.status}. No items imported.` });
    }

    const payload = (await feedRes.json()) as unknown;
    const rawItems = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

    if (rawItems.length === 0) {
      db.prepare(`UPDATE supplier_integrations SET last_sync_at = datetime('now'), last_sync_status = 'empty_feed' WHERE id = ?`).run(id);
      return res.status(200).json({ imported: 0, message: 'Authorized feed responded with 0 catalog items.' });
    }

    let seller = db.prepare(`SELECT id FROM sellers WHERE user_id = ?`).get(req.authUser!.id) as { id: number } | undefined;
    if (!seller) {
      const sRes = db.prepare(`
        INSERT INTO sellers (user_id, store_name, description, country, verification_status)
        VALUES (?, 'IFIOK-EN Verified Inventory', 'Official platform-verified inventory and authorized supplier catalog.', 'Global', 'verified')
      `).run(req.authUser!.id);
      seller = { id: Number(sRes.lastInsertRowid) };
    }

    const nowIso = new Date().toISOString();
    let imported = 0;

    db.transaction(() => {
      for (const entry of rawItems.slice(0, 50)) {
        if (!entry || typeof entry !== 'object') continue;
        const item = entry as Record<string, unknown>;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        const description = typeof item.description === 'string' ? item.description.trim() : '';
        const pricePi = Number(item.pricePi);
        if (title.length < 3 || description.length < 15 || !Number.isFinite(pricePi) || pricePi <= 0) continue;

        const category = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Software & Licenses';
        const productType = ['physical', 'digital', 'service', 'web3', 'pi_app', 'gaming_asset'].includes(String(item.productType))
          ? String(item.productType)
          : 'digital';
        const stockQty = Math.max(0, Number(item.stockQty) || 10);
        const itemSourceUrl = sanitizeHttpUrl(item.sourceUrl) || urlCheck.url;
        const distPermission = typeof item.distributionPermission === 'string' && item.distributionPermission.trim()
          ? item.distributionPermission.trim().slice(0, 240)
          : supplier.distribution_license;
        const deliveryMethod = typeof item.deliveryMethod === 'string' && item.deliveryMethod.trim()
          ? item.deliveryMethod.trim().slice(0, 80)
          : productType === 'physical'
            ? 'physical_shipping'
            : 'instant_digital_download';
        const refundTerms = typeof item.refundSupportTerms === 'string' && item.refundSupportTerms.trim()
          ? item.refundSupportTerms.trim().slice(0, 300)
          : 'Verified supplier digital fulfillment and IFIOK-EN Pi dispute protection.';
        const lockedContent = typeof item.lockedContent === 'string' ? item.lockedContent.trim() : '';

        db.prepare(`
          INSERT INTO products (
            seller_id, title, category, market_suite, product_type, description, price_pi, stock_qty,
            image_url, approval_status, source_origin, source_url, distribution_permission,
            delivery_method, refund_support_terms, supplier_id, availability_status, last_verified_at, locked_content_enc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          seller!.id,
          title,
          category,
          supplier.category_suite,
          productType,
          description,
          pricePi,
          stockQty,
          sanitizeHttpUrl(item.imageUrl),
          supplier.supplier_name,
          itemSourceUrl,
          distPermission,
          deliveryMethod,
          refundTerms,
          supplier.id,
          stockQty > 0 ? 'available' : 'out_of_stock',
          nowIso,
          encryptSensitive(lockedContent)
        );
        imported += 1;
      }

      db.prepare(`
        UPDATE supplier_integrations
        SET last_sync_at = datetime('now'), last_sync_status = ?, items_imported_count = items_imported_count + ?
        WHERE id = ?
      `).run(`synced_${imported}_items`, imported, id);
    })();

    recordAudit(req.authUser!.id, 'supplier_feed_synced', 'supplier_integration', id, req.ip || '', { imported });
    return res.json({ imported, lastSyncAt: nowIso });
  } catch (err) {
    db.prepare(`UPDATE supplier_integrations SET last_sync_at = datetime('now'), last_sync_status = 'connection_failed' WHERE id = ?`).run(id);
    return res.status(502).json({ error: `Failed to fetch supplier JSON feed: ${String(err)}` });
  }
});

// Super Admin Authorized Supplier Feed / Verified Inventory Publisher (Strict Provenance Required)
router.post('/import-verified', requireRole('super_admin'), (req, res) => {
  const entityType = req.body?.entityType;
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' ? req.body.sourceOrigin.trim().slice(0, 120) : '';
  const sourceUrl = sanitizeHttpUrl(req.body?.sourceUrl);
  const availabilityStatus = ['available', 'limited', 'out_of_stock'].includes(req.body?.availabilityStatus)
    ? req.body.availabilityStatus
    : 'available';

  if (!['product', 'course', 'business', 'opportunity'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be product, course, business, or opportunity.' });
  }
  if (sourceOrigin.length < 3) {
    return res.status(400).json({ error: 'Explicit sourceOrigin provenance is required for verified imports.' });
  }

  const nowIso = new Date().toISOString();

  if (entityType === 'product') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Software & Licenses';
    const marketSuite = (MARKET_SUITE_IDS as readonly string[]).includes(req.body?.marketSuite)
      ? req.body.marketSuite
      : req.body?.productType === 'physical'
        ? 'physical_commerce'
        : 'software_productivity';
    const productType = ['physical', 'digital', 'service', 'web3', 'pi_app', 'gaming_asset'].includes(req.body?.productType)
      ? req.body.productType
      : 'digital';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const pricePi = Number(req.body?.pricePi);
    const stockQty = Math.max(0, Number(req.body?.stockQty) || 1);
    const distributionPermission = typeof req.body?.distributionPermission === 'string' ? req.body.distributionPermission.trim().slice(0, 240) : '';
    const deliveryMethod = typeof req.body?.deliveryMethod === 'string' && req.body.deliveryMethod.trim()
      ? req.body.deliveryMethod.trim().slice(0, 80)
      : productType === 'physical'
        ? 'physical_shipping'
        : 'instant_digital_download';
    const refundSupportTerms = typeof req.body?.refundSupportTerms === 'string' ? req.body.refundSupportTerms.trim().slice(0, 300) : '';
    const imageUrl =
      sanitizeHttpUrl(req.body?.imageUrl) ||
      (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.startsWith('/api/uploads/') ? req.body.imageUrl : '');
    const lockedContent = typeof req.body?.lockedContent === 'string' ? req.body.lockedContent.trim() : '';

    if (title.length < 3 || description.length < 15 || !Number.isFinite(pricePi) || pricePi <= 0) {
      return res.status(400).json({ error: 'Valid product title, description, and pricePi (> 0) are required.' });
    }
    if (distributionPermission.length < 5 || refundSupportTerms.length < 8) {
      return res.status(400).json({ error: 'Distribution permission and refund/support terms are required for verified product imports.' });
    }

    let seller = db.prepare(`SELECT id FROM sellers WHERE user_id = ?`).get(req.authUser!.id) as { id: number } | undefined;
    if (!seller) {
      const sRes = db.prepare(`
        INSERT INTO sellers (user_id, store_name, description, country, verification_status)
        VALUES (?, 'IFIOK-EN Verified Inventory', 'Official platform-verified inventory and authorized supplier catalog.', 'Global', 'verified')
      `).run(req.authUser!.id);
      seller = { id: Number(sRes.lastInsertRowid) };
    }

    const ins = db.prepare(`
      INSERT INTO products (
        seller_id, title, category, market_suite, product_type, description, price_pi, stock_qty,
        image_url, approval_status, source_origin, source_url, distribution_permission,
        delivery_method, refund_support_terms, availability_status, last_verified_at, locked_content_enc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      seller.id,
      title,
      category,
      marketSuite,
      productType,
      description,
      pricePi,
      stockQty,
      imageUrl,
      sourceOrigin,
      sourceUrl,
      distributionPermission,
      deliveryMethod,
      refundSupportTerms,
      stockQty > 0 ? availabilityStatus : 'out_of_stock',
      nowIso,
      encryptSensitive(lockedContent)
    );
    recordAudit(req.authUser!.id, 'verified_product_imported', 'product', Number(ins.lastInsertRowid), req.ip || '', { sourceOrigin, marketSuite });
    return res.status(201).json({ id: Number(ins.lastInsertRowid), entityType, lastVerifiedAt: nowIso });
  }

  if (entityType === 'course') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Web3 & Blockchain';
    const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim().slice(0, 80) : category;
    const languageCode = typeof req.body?.languageCode === 'string' && req.body.languageCode.trim() ? req.body.languageCode.trim().slice(0, 10) : 'en';
    const level = typeof req.body?.level === 'string' ? req.body.level.trim() : 'Beginner';
    const durationHours = Math.max(1, Math.min(200, Number(req.body?.durationHours) || 6));
    const pricePi = Math.max(0, Number(req.body?.pricePi) || 0);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const syllabus = Array.isArray(req.body?.syllabus)
      ? req.body.syllabus.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    const learningObjectives = Array.isArray(req.body?.learningObjectives)
      ? req.body.learningObjectives.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    const modulesNotes = Array.isArray(req.body?.modulesNotes) ? req.body.modulesNotes.slice(0, 30) : [];
    const slidesResources = Array.isArray(req.body?.slidesResources)
      ? req.body.slidesResources.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
      : [];
    const assignments = Array.isArray(req.body?.assignments)
      ? req.body.assignments.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    const quizzes = Array.isArray(req.body?.quizzes)
      ? req.body.quizzes.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    const examMarkingGuide = typeof req.body?.examMarkingGuide === 'string' ? req.body.examMarkingGuide.trim() : '';
    const mediaLessonUrl = sanitizeHttpUrl(req.body?.mediaLessonUrl);
    const instructorQual = typeof req.body?.instructorQualifications === 'string' ? req.body.instructorQualifications.trim() : '';
    const prerequisites = typeof req.body?.prerequisites === 'string' ? req.body.prerequisites.trim() : '';
    const copyrightPermission = typeof req.body?.copyrightPermission === 'string' ? req.body.copyrightPermission.trim() : '';
    const certificateCriteria = typeof req.body?.certificateCriteria === 'string' ? req.body.certificateCriteria.trim() : '';
    const imageUrl =
      sanitizeHttpUrl(req.body?.imageUrl) ||
      (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.startsWith('/api/uploads/') ? req.body.imageUrl : '');
    const lockedMaterials = typeof req.body?.lockedMaterials === 'string' ? req.body.lockedMaterials.trim() : '';

    if (title.length < 5 || description.length < 20) {
      return res.status(400).json({ error: 'Course title and detailed description are required.' });
    }

    let instructor = db.prepare(`SELECT id, credentials FROM instructors WHERE user_id = ?`).get(req.authUser!.id) as
      | { id: number; credentials: string }
      | undefined;
    if (!instructor) {
      const iRes = db.prepare(`
        INSERT INTO instructors (user_id, headline, bio, expertise, credentials, approval_status)
        VALUES (?, 'IFIOK-EN Curriculum Lead', 'Official platform educational curriculum authority.', ?, 'Verified Platform Curriculum Authority', 'approved')
      `).run(req.authUser!.id, category);
      instructor = { id: Number(iRes.lastInsertRowid), credentials: 'Verified Platform Curriculum Authority' };
    }

    const encryptedMaterials = encryptSensitive(lockedMaterials);
    const completeness = evaluateCourseCompleteness(
      {
        title,
        description,
        syllabus_json: syllabus,
        learning_objectives_json: learningObjectives,
        modules_notes_json: modulesNotes,
        media_lesson_url: mediaLessonUrl,
        locked_materials_enc: encryptedMaterials,
        slides_resources_json: slidesResources,
        assignments_json: assignments,
        quizzes_json: quizzes,
        exam_marking_guide: examMarkingGuide,
        instructor_qualifications_snapshot: instructorQual || instructor.credentials,
        duration_hours: durationHours,
        level,
        language_code: languageCode,
        prerequisites,
        copyright_permission: copyrightPermission,
        certificate_criteria: certificateCriteria,
      },
      instructor
    );

    if (pricePi > 0 && !completeness.complete) {
      return res.status(400).json({
        error: `Paid course import blocked: all 15 curriculum requirements must be populated (${completeness.score}/15).`,
        completeness,
      });
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`;
    const ins = db.prepare(`
      INSERT INTO courses (
        instructor_id, title, slug, category, subject, language_code, level, duration_hours, price_pi,
        syllabus_json, description, learning_objectives_json, modules_notes_json, media_lesson_url,
        slides_resources_json, assignments_json, quizzes_json, exam_marking_guide,
        instructor_qualifications_snapshot, prerequisites, copyright_permission, certificate_criteria, completeness_score,
        image_url, approval_status, is_featured, source_origin, source_url, availability_status, last_verified_at, locked_materials_enc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, ?, ?, ?, ?)
    `).run(
      instructor.id,
      title,
      slug,
      category,
      subject,
      languageCode,
      level,
      durationHours,
      pricePi,
      JSON.stringify(syllabus),
      description,
      JSON.stringify(learningObjectives),
      JSON.stringify(modulesNotes),
      mediaLessonUrl,
      JSON.stringify(slidesResources),
      JSON.stringify(assignments),
      JSON.stringify(quizzes),
      examMarkingGuide,
      instructorQual || instructor.credentials,
      prerequisites,
      copyrightPermission,
      certificateCriteria,
      completeness.score,
      imageUrl,
      sourceOrigin,
      sourceUrl,
      availabilityStatus,
      nowIso,
      encryptedMaterials
    );
    recordAudit(req.authUser!.id, 'verified_course_imported', 'course', Number(ins.lastInsertRowid), req.ip || '', {
      sourceOrigin,
      completenessScore: completeness.score,
    });
    return res.status(201).json({ id: Number(ins.lastInsertRowid), entityType, lastVerifiedAt: nowIso, completeness });
  }

  if (entityType === 'business') {
    const businessName = typeof req.body?.businessName === 'string' ? req.body.businessName.trim() : '';
    const sector = typeof req.body?.sector === 'string' ? req.body.sector.trim() : '';
    const hubCategory = typeof req.body?.hubCategory === 'string' && req.body.hubCategory.trim() ? req.body.hubCategory.trim() : 'Verified SMEs';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : 'Global';
    const website = sanitizeHttpUrl(req.body?.website);
    const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
    const servicesOffered = typeof req.body?.servicesOffered === 'string' ? req.body.servicesOffered.trim() : sector;
    const regNo = typeof req.body?.registrationNumber === 'string' ? req.body.registrationNumber.trim() : '';
    const maskedReg = regNo.length > 4 ? `***${regNo.slice(-4)}` : regNo;

    if (businessName.length < 2 || sector.length < 2 || summary.length < 15) {
      return res.status(400).json({ error: 'Business name, sector, and descriptive summary are required.' });
    }

    const ins = db.prepare(`
      INSERT INTO business_profiles (
        owner_user_id, business_name, registration_number, registration_number_enc, sector, hub_category, country, website,
        summary, services_offered, verification_status, is_featured, source_origin, source_url, availability_status, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 1, ?, ?, ?, ?)
    `).run(
      req.authUser!.id,
      businessName,
      maskedReg,
      encryptSensitive(regNo),
      sector,
      hubCategory,
      country,
      website,
      summary,
      servicesOffered,
      sourceOrigin,
      sourceUrl || website,
      availabilityStatus,
      nowIso
    );
    recordAudit(req.authUser!.id, 'verified_business_imported', 'business_profile', Number(ins.lastInsertRowid), req.ip || '', { sourceOrigin });
    return res.status(201).json({ id: Number(ins.lastInsertRowid), entityType, lastVerifiedAt: nowIso });
  }

  // opportunity
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const opportunityType = ['job', 'internship', 'scholarship', 'grant', 'fellowship', 'competition', 'partnership'].includes(req.body?.opportunityType)
    ? req.body.opportunityType
    : 'job';
  const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';
  const location = typeof req.body?.location === 'string' ? req.body.location.trim() : 'Global';
  const compensationOrAward = typeof req.body?.compensationOrAward === 'string' ? req.body.compensationOrAward.trim() : '';
  const deadline = typeof req.body?.deadline === 'string' ? req.body.deadline.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const eligibility = typeof req.body?.eligibility === 'string' ? req.body.eligibility.trim() : '';

  if (title.length < 5 || organizationName.length < 2 || description.length < 20 || !deadline) {
    return res.status(400).json({ error: 'Title, issuing organization, deadline, and full description are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO opportunities (
      poster_user_id, title, opportunity_type, organization_name, location, is_remote,
      compensation_or_award, deadline, description, requirements, eligibility, external_url, approval_status,
      source_origin, source_url, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
  `).run(
    req.authUser!.id,
    title,
    opportunityType,
    organizationName,
    location,
    req.body?.isRemote ? 1 : 0,
    compensationOrAward || 'Disclosed by issuing organization',
    deadline,
    description,
    typeof req.body?.requirements === 'string' && req.body.requirements.trim() ? req.body.requirements.trim() : description,
    eligibility,
    sourceUrl,
    sourceOrigin,
    sourceUrl,
    availabilityStatus,
    nowIso
  );
  recordAudit(req.authUser!.id, 'verified_opportunity_imported', 'opportunity', Number(ins.lastInsertRowid), req.ip || '', { sourceOrigin });
  return res.status(201).json({ id: Number(ins.lastInsertRowid), entityType, lastVerifiedAt: nowIso });
});

export default router;
