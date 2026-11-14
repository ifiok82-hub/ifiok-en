import crypto from 'node:crypto';
import { Router } from 'express';
import { db, getSettingsMap } from '../db.ts';
import { createNotification, recordAudit, recordSecurityEvent, requireAuth } from '../middleware/auth.ts';

const router = Router();

function getPiApiKey(): string | null {
  const key = process.env.PI_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

router.get('/config', (_req, res) => {
  const settings = getSettingsMap();
  res.json({
    environment: 'testnet',
    mainnetEnabled: settings.mainnet_enabled === 'true' && Boolean(process.env.PI_MAINNET_APPROVED === 'true'),
    piServerKeyConfigured: Boolean(getPiApiKey()),
    currency: 'PI',
    freelanceCommissionPct: Number(settings.freelance_commission_pct || 8),
    marketplaceCommissionPct: Number(settings.marketplace_commission_pct || 5),
    informationalUsdPerPi: Number(settings.informational_usd_per_pi || 1.0),
  });
});

router.post('/create-intent', requireAuth, (req, res) => {
  const orderType = req.body?.orderType;
  const referenceId = Number(req.body?.referenceId);
  const shippingInfo = typeof req.body?.shippingInfo === 'object' && req.body.shippingInfo ? req.body.shippingInfo : {};
  const brief = typeof req.body?.brief === 'string' ? req.body.brief.trim() : '';
  const planSlug = typeof req.body?.planSlug === 'string' ? req.body.planSlug : '';

  const settings = getSettingsMap();
  const userId = req.authUser!.id;

  let itemTitle = '';
  let subtotalPi = 0;
  let platformFeePi = 0;
  let resolvedRefId = referenceId;

  if (orderType === 'course') {
    const course = db.prepare(`SELECT id, title, price_pi, approval_status FROM courses WHERE id = ?`).get(referenceId) as
      | { id: number; title: string; price_pi: number; approval_status: string }
      | undefined;
    if (!course || course.approval_status !== 'approved') {
      return res.status(404).json({ error: 'Approved course not found.' });
    }
    const existingEnrol = db.prepare(`SELECT id, status FROM enrolments WHERE user_id = ? AND course_id = ?`).get(userId, course.id) as
      | { id: number; status: string }
      | undefined;
    if (existingEnrol && existingEnrol.status !== 'pending_payment') {
      return res.status(409).json({ error: 'You are already enrolled in this course.' });
    }
    itemTitle = `Course Enrolment: ${course.title}`;
    subtotalPi = Number(course.price_pi);

    // Free courses can be enrolled immediately without a Pi transaction
    if (subtotalPi === 0) {
      db.transaction(() => {
        db.prepare(`
          INSERT OR REPLACE INTO enrolments (user_id, course_id, progress_percent, status)
          VALUES (?, ?, 0, 'active')
        `).run(userId, course.id);
        createNotification(userId, 'academy', 'Enrolment Confirmed', `You are now enrolled in ${course.title}.`, 'academy');
        recordAudit(userId, 'course_enrolled_free', 'course', course.id, req.ip || '', {});
      })();
      return res.json({ freeEnrolled: true, message: 'Enrolled in free course.' });
    }
  } else if (orderType === 'product') {
    const product = db.prepare(`
      SELECT p.id, p.title, p.price_pi, p.stock_qty, p.approval_status
      FROM products p WHERE p.id = ?
    `).get(referenceId) as
      | { id: number; title: string; price_pi: number; stock_qty: number; approval_status: string }
      | undefined;
    if (!product || product.approval_status !== 'approved') {
      return res.status(404).json({ error: 'Approved marketplace product not found.' });
    }
    if (product.stock_qty < 1) {
      return res.status(400).json({ error: 'This product is currently out of stock.' });
    }
    const qty = Math.max(1, Math.min(20, Number(req.body?.quantity) || 1));
    if (qty > product.stock_qty) {
      return res.status(400).json({ error: `Only ${product.stock_qty} units available.` });
    }
    itemTitle = `${product.title} (x${qty})`;
    subtotalPi = Number((product.price_pi * qty).toFixed(4));
    const commPct = Number(settings.marketplace_commission_pct || 5);
    platformFeePi = Number(((subtotalPi * commPct) / 100).toFixed(4));
  } else if (orderType === 'service') {
    const service = db.prepare(`
      SELECT id, freelancer_user_id, title, price_pi, approval_status
      FROM freelance_services WHERE id = ?
    `).get(referenceId) as
      | { id: number; freelancer_user_id: number; title: string; price_pi: number; approval_status: string }
      | undefined;
    if (!service || service.approval_status !== 'approved') {
      return res.status(404).json({ error: 'Approved freelance service not found.' });
    }
    if (service.freelancer_user_id === userId) {
      return res.status(400).json({ error: 'You cannot commission your own service.' });
    }
    if (brief.length < 15) {
      return res.status(400).json({ error: 'Please include a clear project brief (at least 15 characters).' });
    }
    const projRes = db.prepare(`
      INSERT INTO projects (service_id, client_user_id, freelancer_user_id, title, brief, budget_pi, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending_payment')
    `).run(service.id, userId, service.freelancer_user_id, service.title, brief, service.price_pi);
    resolvedRefId = Number(projRes.lastInsertRowid);
    itemTitle = `Freelance Service: ${service.title}`;
    subtotalPi = Number(service.price_pi);
    const commPct = Number(settings.freelance_commission_pct || 8);
    platformFeePi = Number(((subtotalPi * commPct) / 100).toFixed(4));
  } else if (orderType === 'subscription') {
    const prices: Record<string, number> = {
      pro_creator: Number(settings.subscription_pro_pi || 12),
      verified_business: Number(settings.subscription_business_pi || 35),
      enterprise: Number(settings.subscription_enterprise_pi || 90),
    };
    if (!prices[planSlug]) {
      return res.status(400).json({ error: 'Invalid paid subscription plan selected.' });
    }
    const subRes = db.prepare(`
      INSERT INTO subscriptions (user_id, plan_slug, price_pi, billing_cycle, status)
      VALUES (?, ?, ?, 'monthly', 'pending_payment')
    `).run(userId, planSlug, prices[planSlug]);
    resolvedRefId = Number(subRes.lastInsertRowid);
    itemTitle = `IFIOK-EN Subscription (${planSlug.replace('_', ' ')})`;
    subtotalPi = prices[planSlug];
  } else {
    return res.status(400).json({ error: 'Unsupported order type.' });
  }

  const totalPi = Number((subtotalPi + platformFeePi).toFixed(4));

  const created = db.transaction(() => {
    const orderRes = db.prepare(`
      INSERT INTO orders (buyer_user_id, order_type, reference_id, item_title, subtotal_pi, platform_fee_pi, total_pi, shipping_info_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment')
    `).run(userId, orderType, resolvedRefId, itemTitle, subtotalPi, platformFeePi, totalPi, JSON.stringify(shippingInfo));

    const orderId = Number(orderRes.lastInsertRowid);

    const payRes = db.prepare(`
      INSERT INTO payments (order_id, user_id, environment, amount_pi, status)
      VALUES (?, ?, 'testnet', ?, 'created')
    `).run(orderId, userId, totalPi);

    recordAudit(userId, 'payment_intent_created', 'order', orderId, req.ip || '', { orderType, totalPi });

    return {
      orderId,
      paymentRecordId: Number(payRes.lastInsertRowid),
      amountPi: totalPi,
      memo: itemTitle.slice(0, 120),
      environment: 'testnet',
    };
  })();

  return res.status(201).json(created);
});

router.post('/pi/approve', requireAuth, async (req, res) => {
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const orderId = Number(req.body?.orderId);

  if (!paymentId || !orderId) {
    return res.status(400).json({ error: 'paymentId and orderId are required for server approval.' });
  }

  const order = db.prepare(`
    SELECT o.id, o.buyer_user_id, o.total_pi, o.status, p.id as pay_id
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.id = ? AND o.buyer_user_id = ?
  `).get(orderId, req.authUser!.id) as
    | { id: number; buyer_user_id: number; total_pi: number; status: string; pay_id: number }
    | undefined;

  if (!order) {
    return res.status(404).json({ error: 'Order record not found for current user.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    recordSecurityEvent('pi_missing_api_key', 'warning', req.authUser!.id, req.ip || '', 'Attempted Pi payment approval without PI_API_KEY configured');
    return res.status(503).json({
      error: 'Pi Network server verification key (PI_API_KEY) is not configured on the server. Payment cannot be approved without live server verification.',
    });
  }

  try {
    // Verify payment details from Pi Platform API before approving
    const inspectRes = await fetch(`https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Key ${piKey}` },
    });
    if (!inspectRes.ok) {
      return res.status(502).json({ error: `Pi Platform API rejected payment lookup (${inspectRes.status}).` });
    }
    const paymentData = (await inspectRes.json()) as { amount?: number; network?: string };

    if (typeof paymentData.amount !== 'number' || Math.abs(paymentData.amount - order.total_pi) > 0.0001) {
      recordSecurityEvent('pi_amount_mismatch', 'critical', req.authUser!.id, req.ip || '', `Expected ${order.total_pi} PI, Pi API reported ${paymentData.amount}`);
      return res.status(400).json({ error: 'Payment amount mismatch detected during server verification.' });
    }

    const approveRes = await fetch(`https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    });

    if (!approveRes.ok) {
      const txt = await approveRes.text();
      return res.status(502).json({ error: `Pi Server Approval failed: ${txt}` });
    }

    const approvedJson = await approveRes.json();
    db.prepare(`
      UPDATE payments
      SET pi_payment_id = ?, status = 'approved', verification_payload_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(paymentId, JSON.stringify(approvedJson), order.pay_id);

    recordAudit(req.authUser!.id, 'pi_payment_approved', 'payment', order.pay_id, req.ip || '', { paymentId });
    return res.json({ approved: true, paymentId });
  } catch (err) {
    return res.status(502).json({ error: `Pi Server communication error: ${String(err)}` });
  }
});

router.post('/pi/complete', requireAuth, async (req, res) => {
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const txid = typeof req.body?.txid === 'string' ? req.body.txid.trim() : '';

  if (!paymentId || !txid) {
    return res.status(400).json({ error: 'paymentId and txid are required for server completion.' });
  }

  const paymentRow = db.prepare(`
    SELECT p.id as pay_id, p.order_id, p.amount_pi, o.buyer_user_id, o.order_type, o.reference_id, o.item_title
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.pi_payment_id = ? AND o.buyer_user_id = ?
  `).get(paymentId, req.authUser!.id) as
    | {
        pay_id: number;
        order_id: number;
        amount_pi: number;
        buyer_user_id: number;
        order_type: string;
        reference_id: number;
        item_title: string;
      }
    | undefined;

  if (!paymentRow) {
    return res.status(404).json({ error: 'Matching approved payment record not found.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    return res.status(503).json({
      error: 'PI_API_KEY is not configured. Server-side completion requires official Pi Platform API credentials.',
    });
  }

  try {
    const completeRes = await fetch(`https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${piKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
    });

    if (!completeRes.ok) {
      const txt = await completeRes.text();
      return res.status(502).json({ error: `Pi Server Completion failed: ${txt}` });
    }

    const completedPayload = (await completeRes.json()) as {
      amount?: number;
      status?: { developer_completed?: boolean; transaction_verified?: boolean };
    };

    if (!completedPayload?.status?.developer_completed || !completedPayload?.status?.transaction_verified) {
      recordSecurityEvent('pi_unverified_completion', 'critical', req.authUser!.id, req.ip || '', `Unverified completion payload for ${paymentId}`);
      return res.status(400).json({ error: 'Pi blockchain transaction could not be verified on server.' });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE payments
        SET txid = ?, status = 'completed', verification_payload_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(txid, JSON.stringify(completedPayload), paymentRow.pay_id);

      db.prepare(`UPDATE orders SET status = 'paid' WHERE id = ?`).run(paymentRow.order_id);

      if (paymentRow.order_type === 'course') {
        const certCode = `IFIOK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        db.prepare(`
          INSERT OR REPLACE INTO enrolments (user_id, course_id, progress_percent, certificate_code, status)
          VALUES (?, ?, 0, ?, 'active')
        `).run(paymentRow.buyer_user_id, paymentRow.reference_id, certCode);
      } else if (paymentRow.order_type === 'service') {
        db.prepare(`UPDATE projects SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(
          paymentRow.reference_id
        );
      } else if (paymentRow.order_type === 'subscription') {
        db.prepare(`
          UPDATE subscriptions
          SET status = 'active', starts_at = datetime('now'), ends_at = datetime('now', '+30 days')
          WHERE id = ?
        `).run(paymentRow.reference_id);
      } else if (paymentRow.order_type === 'product') {
        db.prepare(`UPDATE products SET stock_qty = MAX(0, stock_qty - 1) WHERE id = ?`).run(paymentRow.reference_id);
      }

      createNotification(
        paymentRow.buyer_user_id,
        'payment',
        'Pi Payment Verified & Completed',
        `Your Testnet settlement of ${paymentRow.amount_pi} π for "${paymentRow.item_title}" is confirmed (TX: ${txid.slice(0, 12)}...).`,
        'transactions'
      );
      recordAudit(paymentRow.buyer_user_id, 'pi_payment_completed', 'payment', paymentRow.pay_id, req.ip || '', {
        paymentId,
        txid,
        orderId: paymentRow.order_id,
      });
    })();

    return res.json({ completed: true, txid, orderId: paymentRow.order_id });
  } catch (err) {
    return res.status(502).json({ error: `Pi completion verification error: ${String(err)}` });
  }
});

router.post('/pi/cancel', requireAuth, (req, res) => {
  const orderId = Number(req.body?.orderId);
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  db.transaction(() => {
    db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND buyer_user_id = ? AND status = 'awaiting_payment'`).run(
      orderId,
      req.authUser!.id
    );
    db.prepare(`UPDATE payments SET status = 'cancelled', updated_at = datetime('now') WHERE order_id = ? AND user_id = ? AND status IN ('created', 'approved')`).run(
      orderId,
      req.authUser!.id
    );
  })();
  return res.json({ cancelled: true });
});

router.get('/my', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.id as order_id, o.order_type, o.reference_id, o.item_title, o.subtotal_pi, o.platform_fee_pi,
           o.total_pi, o.status as order_status, o.created_at,
           p.id as payment_id, p.pi_payment_id, p.txid, p.environment, p.status as payment_status
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.buyer_user_id = ?
    ORDER BY o.created_at DESC
  `).all(req.authUser!.id);

  res.json({ transactions: rows });
});

export default router;
