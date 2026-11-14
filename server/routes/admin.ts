import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { BACKUPS_DIR, db, getSettingsMap } from '../db.ts';
import {
  assignRole,
  createNotification,
  recordAudit,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth, requireRole('super_admin', 'moderator', 'finance_admin'));

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
  const courses = db.prepare(`
    SELECT c.*, u.full_name as instructor_name
    FROM courses c JOIN instructors i ON i.id = c.instructor_id JOIN users u ON u.id = i.user_id
    ORDER BY c.created_at DESC
  `).all();
  const sellers = db.prepare(`
    SELECT s.*, u.full_name, u.email FROM sellers s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC
  `).all();
  const products = db.prepare(`
    SELECT p.*, s.store_name FROM products p JOIN sellers s ON s.id = p.seller_id ORDER BY p.created_at DESC
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
    communityPosts,
    transactions,
    subscriptions,
    disputes,
    auditLogs,
    securityEvents,
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

// Listing & Account Verifications
router.patch('/businesses/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.verificationStatus;
  const isFeatured = req.body?.isFeatured ? 1 : 0;
  if (!['pending', 'verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const row = db.prepare(`SELECT owner_user_id, business_name FROM business_profiles WHERE id = ?`).get(id) as
    | { owner_user_id: number; business_name: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Business not found.' });
  db.prepare(`UPDATE business_profiles SET verification_status = ?, is_featured = ? WHERE id = ?`).run(status, isFeatured, id);
  createNotification(row.owner_user_id, 'business', 'Business Verification Updated', `"${row.business_name}" status is now ${status}.`, 'business');
  recordAudit(req.authUser!.id, 'business_moderation', 'business_profile', id, req.ip || '', { status, isFeatured });
  res.json({ ok: true });
});

router.patch('/instructors/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.approvalStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE instructors SET approval_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'instructor_moderation', 'instructor', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/courses/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.approvalStatus;
  const isFeatured = req.body?.isFeatured ? 1 : 0;
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE courses SET approval_status = ?, is_featured = ? WHERE id = ?`).run(status, isFeatured, id);
  recordAudit(req.authUser!.id, 'course_moderation', 'course', id, req.ip || '', { status, isFeatured });
  res.json({ ok: true });
});

router.patch('/sellers/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.verificationStatus;
  if (!['pending', 'verified', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE sellers SET verification_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'seller_moderation', 'seller', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/products/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.approvalStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE products SET approval_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'product_moderation', 'product', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/opportunities/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.approvalStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE opportunities SET approval_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'opportunity_moderation', 'opportunity', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/services/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.approvalStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE freelance_services SET approval_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'service_moderation', 'freelance_service', id, req.ip || '', { status });
  res.json({ ok: true });
});

router.patch('/community-posts/:id', requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.moderationStatus;
  if (!['active', 'flagged', 'removed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE community_posts SET moderation_status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'community_post_moderation', 'community_post', id, req.ip || '', { status });
  res.json({ ok: true });
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
      db.prepare(`UPDATE orders SET status = 'refunded' WHERE id = ?`).run(dispute.target_id);
      db.prepare(`UPDATE payments SET status = 'refunded', updated_at = datetime('now') WHERE order_id = ?`).run(dispute.target_id);
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

export default router;
