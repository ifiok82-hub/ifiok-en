import { Router } from 'express';
import { db } from '../db.ts';
import { recordAudit, recordSecurityEvent, requireAuth } from '../middleware/auth.ts';

const router = Router();

router.get('/overview', requireAuth, (req, res) => {
  const uid = req.authUser!.id;

  const enrolments = db.prepare(`
    SELECT e.*, c.title as course_title, c.category, c.level, c.duration_hours, c.syllabus_json,
           u.full_name as instructor_name
    FROM enrolments e
    JOIN courses c ON c.id = e.course_id
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    WHERE e.user_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(uid);

  const instructorProfile = db.prepare(`SELECT * FROM instructors WHERE user_id = ?`).get(uid);
  const myCourses = instructorProfile
    ? db.prepare(`
        SELECT id, instructor_id, title, slug, category, subject, language_code, level, duration_hours, price_pi,
               approval_status, moderation_action, review_notes, completeness_score,
               source_origin, availability_status, last_verified_at, created_at
        FROM courses WHERE instructor_id = ? ORDER BY created_at DESC
      `).all((instructorProfile as { id: number }).id)
    : [];

  const businesses = db.prepare(`
    SELECT id, owner_user_id, business_name, registration_number, sector, hub_category, country, website,
           summary, services_offered, verification_status, moderation_action, review_notes,
           source_origin, availability_status, last_verified_at, created_at
    FROM business_profiles WHERE owner_user_id = ? ORDER BY created_at DESC
  `).all(uid);
  const myServices = db.prepare(`SELECT * FROM freelance_services WHERE freelancer_user_id = ? ORDER BY created_at DESC`).all(uid);

  const projects = db.prepare(`
    SELECT p.*, cu.full_name as client_name, fu.full_name as freelancer_name
    FROM projects p
    JOIN users cu ON cu.id = p.client_user_id
    JOIN users fu ON fu.id = p.freelancer_user_id
    WHERE p.client_user_id = ? OR p.freelancer_user_id = ?
    ORDER BY p.updated_at DESC
  `).all(uid, uid);

  const sellerProfile = db.prepare(`SELECT * FROM sellers WHERE user_id = ?`).get(uid);
  const myProducts = sellerProfile
    ? db.prepare(`
        SELECT id, seller_id, title, category, market_suite, product_type, description, price_pi, stock_qty,
               image_url, approval_status, lifecycle_status, file_original_name, file_format, file_size_bytes,
               malware_scan_status, version, support_info, creator_ownership_attested, download_count,
               moderation_action, review_notes, delivery_method,
               distribution_permission, refund_support_terms,
               source_origin, availability_status, last_verified_at, created_at,
               (CASE WHEN length(COALESCE(file_storage_key, '')) > 0 THEN 1 ELSE 0 END) as has_file
        FROM products WHERE seller_id = ? ORDER BY created_at DESC
      `).all((sellerProfile as { id: number }).id)
    : [];

  const applications = db.prepare(`
    SELECT a.*, o.title as opportunity_title, o.opportunity_type, o.organization_name, o.deadline
    FROM applications a
    JOIN opportunities o ON o.id = a.opportunity_id
    WHERE a.applicant_user_id = ?
    ORDER BY a.created_at DESC
  `).all(uid);

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(uid);

  const messages = db.prepare(`
    SELECT m.*, su.full_name as sender_name, ru.full_name as recipient_name
    FROM messages m
    JOIN users su ON su.id = m.sender_user_id
    JOIN users ru ON ru.id = m.recipient_user_id
    WHERE m.sender_user_id = ? OR m.recipient_user_id = ?
    ORDER BY m.created_at DESC LIMIT 40
  `).all(uid, uid);

  const subscriptions = db.prepare(`SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC`).all(uid);

  const disputes = db.prepare(`SELECT * FROM disputes WHERE opened_by_user_id = ? ORDER BY created_at DESC`).all(uid);

  const orders = db.prepare(`
    SELECT o.*, p.pi_payment_id, p.txid, p.environment, p.status as payment_status
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.buyer_user_id = ?
    ORDER BY o.created_at DESC
  `).all(uid);

  const entitlements = db.prepare(`
    SELECT e.id, e.order_id, e.item_type, e.item_id, e.is_unlocked, e.unlocked_at, e.revoked_at,
           o.status as order_status, o.item_title,
           (CASE
             WHEN e.item_type = 'product' AND length(COALESCE(pr.file_storage_key, '')) > 0 THEN 1
             WHEN e.item_type = 'course' AND length(COALESCE(c.course_files_json, '[]')) > 4 THEN 1
             ELSE 0
           END) as item_has_file,
           pr.file_original_name, pr.file_format, pr.file_size_bytes, pr.version as product_version
    FROM entitlements e
    JOIN orders o ON o.id = e.order_id
    LEFT JOIN products pr ON e.item_type = 'product' AND pr.id = e.item_id
    LEFT JOIN courses c ON e.item_type = 'course' AND c.id = e.item_id
    WHERE e.user_id = ?
    ORDER BY e.id DESC
  `).all(uid);

  const sellerOrders = sellerProfile
    ? db.prepare(`
        SELECT o.id, o.order_type, o.reference_id, o.item_title, o.total_pi, o.status, o.fulfillment_status, o.created_at,
               u.full_name as buyer_name, pr.product_type
        FROM orders o
        JOIN products pr ON pr.id = o.reference_id
        JOIN users u ON u.id = o.buyer_user_id
        WHERE o.order_type = 'product' AND pr.seller_id = ?
        ORDER BY o.created_at DESC
      `).all((sellerProfile as { id: number }).id)
    : [];

  const schoolMemberships = db.prepare(`
    SELECT sm.id, sm.school_id, sm.member_role, sm.class_id, sm.guardian_of_student_user_id, sm.status,
           s.name as school_name, s.school_type, s.country, s.verification_status,
           c.name as class_name, c.subject as class_subject
    FROM school_memberships sm
    JOIN schools s ON s.id = sm.school_id
    LEFT JOIN school_classes c ON c.id = sm.class_id
    WHERE sm.user_id = ? AND sm.status = 'active'
    ORDER BY sm.created_at DESC
  `).all(uid);

  const schoolSubmissions = db.prepare(`
    SELECT sub.id, sub.assignment_id, sub.school_id, sub.score, sub.feedback, sub.status, sub.submitted_at, sub.graded_at,
           a.title as assignment_title, a.subject, a.max_score, a.is_exam, s.name as school_name
    FROM assignment_submissions sub
    JOIN school_assignments a ON a.id = sub.assignment_id
    JOIN schools s ON s.id = sub.school_id
    WHERE sub.student_user_id = ?
    ORDER BY sub.submitted_at DESC
  `).all(uid);

  const guardianWards = db.prepare(`
    SELECT sm.school_id, s.name as school_name, u.id as student_user_id, u.full_name as student_name,
           (SELECT COUNT(*) FROM school_attendance att WHERE att.school_id = sm.school_id AND att.student_user_id = u.id AND att.status = 'present') as present_count,
           (SELECT COUNT(*) FROM school_attendance att WHERE att.school_id = sm.school_id AND att.student_user_id = u.id) as attendance_total,
           (SELECT ROUND(AVG(sub.score), 1) FROM assignment_submissions sub WHERE sub.school_id = sm.school_id AND sub.student_user_id = u.id AND sub.status = 'graded') as avg_score
    FROM school_memberships sm
    JOIN schools s ON s.id = sm.school_id
    JOIN users u ON u.id = sm.guardian_of_student_user_id
    WHERE sm.user_id = ? AND sm.member_role = 'guardian' AND sm.status = 'active'
  `).all(uid);

  res.json({
    enrolments,
    instructorProfile,
    myCourses,
    businesses,
    myServices,
    projects,
    sellerProfile,
    myProducts,
    applications,
    notifications,
    messages,
    subscriptions,
    disputes,
    orders,
    entitlements,
    sellerOrders,
    schoolMemberships,
    schoolSubmissions,
    guardianWards,
  });
});

router.post('/notifications/mark-read', requireAuth, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.authUser!.id);
  res.json({ ok: true });
});

router.post('/support/disputes', requireAuth, (req, res) => {
  const targetType = ['order', 'project', 'fraud', 'support'].includes(req.body?.targetType) ? req.body.targetType : 'support';
  const targetId = Number(req.body?.targetId) || 0;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';

  if (reason.length < 4 || details.length < 15) {
    return res.status(400).json({ error: 'Please provide a concise subject and detailed explanation.' });
  }

  const ins = db.prepare(`
    INSERT INTO disputes (opened_by_user_id, target_type, target_id, reason, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.authUser!.id, targetType, targetId, reason, details);

  if (targetType === 'fraud') {
    recordSecurityEvent('fraud_report_submitted', 'warning', req.authUser!.id, req.ip || '', `${reason}: ${details.slice(0, 140)}`);
  }
  recordAudit(req.authUser!.id, 'support_ticket_opened', 'dispute', Number(ins.lastInsertRowid), req.ip || '', { targetType });

  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

export default router;
