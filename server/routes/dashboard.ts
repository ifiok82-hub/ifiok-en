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
    ? db.prepare(`SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC`).all((instructorProfile as { id: number }).id)
    : [];

  const businesses = db.prepare(`SELECT * FROM business_profiles WHERE owner_user_id = ? ORDER BY created_at DESC`).all(uid);
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
    ? db.prepare(`SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC`).all((sellerProfile as { id: number }).id)
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
