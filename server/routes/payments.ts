import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { db, getSettingsMap, PRIVATE_ASSETS_DIR } from '../db.ts';
import { decryptSensitive, signDownloadToken, verifyDownloadToken } from '../lib/crypto.ts';
import {
  createNotification,
  createSecurityAlert,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
} from '../middleware/auth.ts';

const router = Router();

const PI_TESTNET_API_BASE = 'https://api.testnet.minepi.com/v2';

function getPiApiKey(): string | null {
  const key = process.env.PI_API_KEY?.trim() || process.env.PI_NETWORK_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

function checkSuspiciousPaymentVelocity(userId: number, ip: string) {
  const recentFailures = db.prepare(`
    SELECT COUNT(*) as c FROM payments
    WHERE user_id = ? AND status IN ('cancelled', 'failed') AND created_at > datetime('now', '-1 hour')
  `).get(userId) as { c: number };

  if (recentFailures.c >= 6) {
    createSecurityAlert(
      'suspicious_payment_velocity',
      'warning',
      userId,
      ip,
      `User #${userId} recorded ${recentFailures.c} cancelled/failed Pi payment attempts within 1 hour.`
    );
  }
}

router.get('/config', (_req, res) => {
  const settings = getSettingsMap();
  res.json({
    environment: 'testnet',
    mainnetEnabled: settings.mainnet_enabled === 'true' && Boolean(process.env.PI_MAINNET_APPROVED === 'true'),
    piServerKeyConfigured: Boolean(getPiApiKey()),
    currency: 'PI',
    paymentMethodExclusive: 'pi_network',
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
  const idempotencyKey =
    typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim().length >= 8
      ? `${req.authUser!.id}:${req.body.idempotencyKey.trim().slice(0, 64)}`
      : null;

  const settings = getSettingsMap();
  const userId = req.authUser!.id;

  // Duplicate submission guard via idempotencyKey
  if (idempotencyKey) {
    const existingOrder = db.prepare(`
      SELECT id, total_pi, item_title, status FROM orders WHERE idempotency_key = ?
    `).get(idempotencyKey) as { id: number; total_pi: number; item_title: string; status: string } | undefined;
    if (existingOrder) {
      if (existingOrder.status === 'paid' || existingOrder.status === 'fulfilled') {
        return res.status(409).json({ error: 'Duplicate transaction blocked: this order is already settled.' });
      }
      return res.status(200).json({
        orderId: existingOrder.id,
        amountPi: existingOrder.total_pi,
        memo: existingOrder.item_title.slice(0, 120),
        environment: 'testnet',
      });
    }
  }

  let itemTitle = '';
  let subtotalPi = 0;
  let platformFeePi = 0;
  let resolvedRefId = referenceId;
  let lockItemType: 'product' | 'course' | null = null;
  let lockItemId = 0;

  if (orderType === 'course') {
    const course = db.prepare(`SELECT id, title, price_pi, approval_status, availability_status FROM courses WHERE id = ?`).get(referenceId) as
      | { id: number; title: string; price_pi: number; approval_status: string; availability_status: string }
      | undefined;
    if (!course || course.approval_status !== 'approved' || course.availability_status === 'closed') {
      return res.status(404).json({ error: 'Approved available course not found.' });
    }
    const existingEnrol = db.prepare(`SELECT id, status FROM enrolments WHERE user_id = ? AND course_id = ?`).get(userId, course.id) as
      | { id: number; status: string }
      | undefined;
    if (existingEnrol && existingEnrol.status !== 'pending_payment') {
      return res.status(409).json({ error: 'You are already enrolled in this course.' });
    }
    itemTitle = `Course Enrolment: ${course.title}`;
    subtotalPi = Number(course.price_pi);
    lockItemType = 'course';
    lockItemId = course.id;

    // Free courses (0 PI) unlock immediately; paid courses stay LOCKED until server confirms Pi completion
    if (subtotalPi === 0) {
      db.transaction(() => {
        const orderRes = db.prepare(`
          INSERT INTO orders (buyer_user_id, order_type, reference_id, item_title, subtotal_pi, platform_fee_pi, total_pi, status, fulfillment_status)
          VALUES (?, 'course', ?, ?, 0, 0, 0, 'paid', 'unlocked_digital')
        `).run(userId, course.id, itemTitle);
        const freeOrderId = Number(orderRes.lastInsertRowid);
        db.prepare(`
          INSERT OR REPLACE INTO enrolments (user_id, course_id, progress_percent, status)
          VALUES (?, ?, 0, 'active')
        `).run(userId, course.id);
        db.prepare(`
          INSERT OR REPLACE INTO entitlements (user_id, order_id, item_type, item_id, is_unlocked, unlocked_at)
          VALUES (?, ?, 'course', ?, 1, datetime('now'))
        `).run(userId, freeOrderId, course.id);
        createNotification(userId, 'academy', 'Enrolment Confirmed', `You are now enrolled in ${course.title}.`, 'academy');
        recordAudit(userId, 'course_enrolled_free', 'course', course.id, req.ip || '', {});
      })();
      return res.json({ freeEnrolled: true, message: 'Enrolled in free course.' });
    }

    // Paid course: create pending_payment enrolment & LOCKED entitlement
    db.prepare(`
      INSERT OR IGNORE INTO enrolments (user_id, course_id, progress_percent, status)
      VALUES (?, ?, 0, 'pending_payment')
    `).run(userId, course.id);
  } else if (orderType === 'product') {
    const product = db.prepare(`
      SELECT p.id, p.title, p.price_pi, p.stock_qty, p.approval_status, p.lifecycle_status, p.product_type, p.availability_status
      FROM products p WHERE p.id = ?
    `).get(referenceId) as
      | {
          id: number;
          title: string;
          price_pi: number;
          stock_qty: number;
          approval_status: string;
          lifecycle_status: string;
          product_type: string;
          availability_status: string;
        }
      | undefined;
    if (
      !product ||
      product.approval_status !== 'approved' ||
      !['approved', 'published'].includes(product.lifecycle_status || 'published') ||
      product.availability_status === 'out_of_stock'
    ) {
      return res.status(404).json({ error: 'Approved in-stock marketplace product not found.' });
    }
    if (product.stock_qty < 1) {
      return res.status(400).json({ error: 'This product is currently out of stock.' });
    }
    const qty = Math.max(1, Math.min(20, Number(req.body?.quantity) || 1));
    if (qty > product.stock_qty) {
      return res.status(400).json({ error: `Only ${product.stock_qty} units available.` });
    }
    if (product.product_type !== 'physical') {
      const unlocked = db.prepare(`
        SELECT is_unlocked FROM entitlements WHERE user_id = ? AND item_type = 'product' AND item_id = ? AND is_unlocked = 1
      `).get(userId, product.id);
      if (unlocked) {
        return res.status(409).json({ error: 'You already unlocked this digital product.' });
      }
      lockItemType = 'product';
      lockItemId = product.id;
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
      INSERT INTO orders (
        buyer_user_id, order_type, reference_id, item_title, subtotal_pi, platform_fee_pi, total_pi,
        shipping_info_json, status, fulfillment_status, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'locked_awaiting_payment', ?)
    `).run(
      userId,
      orderType,
      resolvedRefId,
      itemTitle,
      subtotalPi,
      platformFeePi,
      totalPi,
      JSON.stringify(shippingInfo),
      idempotencyKey
    );

    const orderId = Number(orderRes.lastInsertRowid);

    const payRes = db.prepare(`
      INSERT INTO payments (order_id, user_id, environment, amount_pi, status)
      VALUES (?, ?, 'testnet', ?, 'created')
    `).run(orderId, userId, totalPi);

    if (lockItemType && lockItemId) {
      db.prepare(`
        INSERT OR IGNORE INTO entitlements (user_id, order_id, item_type, item_id, is_unlocked)
        VALUES (?, ?, ?, ?, 0)
      `).run(userId, orderId, lockItemType, lockItemId);
    }

    recordAudit(userId, 'payment_intent_created', 'order', orderId, req.ip || '', { orderType, totalPi });

    return {
      orderId,
      paymentRecordId: Number(payRes.lastInsertRowid),
      amountPi: totalPi,
      memo: itemTitle.slice(0, 120),
      environment: 'testnet',
      lockedUntilVerified: true,
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

  // Prevent reusing a Pi paymentId across different orders
  const duplicatePiPayment = db.prepare(`
    SELECT id, order_id FROM payments WHERE pi_payment_id = ? AND order_id != ?
  `).get(paymentId, orderId);
  if (duplicatePiPayment) {
    recordSecurityEvent('pi_duplicate_payment_id', 'critical', req.authUser!.id, req.ip || '', `Attempted reuse of paymentId ${paymentId} on order #${orderId}`);
    return res.status(409).json({ error: 'Duplicate Pi payment identifier rejected.' });
  }

  const order = db.prepare(`
    SELECT o.id, o.buyer_user_id, o.total_pi, o.status, p.id as pay_id, p.status as pay_status
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.id = ? AND o.buyer_user_id = ?
  `).get(orderId, req.authUser!.id) as
    | { id: number; buyer_user_id: number; total_pi: number; status: string; pay_id: number; pay_status: string }
    | undefined;

  if (!order) {
    return res.status(404).json({ error: 'Order record not found for current user.' });
  }
  if (order.status !== 'awaiting_payment' || order.pay_status === 'completed') {
    return res.status(409).json({ error: 'Order is no longer awaiting approval.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    recordSecurityEvent('pi_missing_api_key', 'warning', req.authUser!.id, req.ip || '', 'Attempted Pi payment approval without PI_API_KEY configured');
    return res.status(503).json({
      error: 'Pi Network server verification key (PI_API_KEY) is not configured on the server. Payment cannot be approved without live server verification.',
    });
  }

  console.log('Approve called', { paymentId, orderId });

  try {
    const approveRes = await fetch(`${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    });
    if (!approveRes.ok) {
      const txt = await approveRes.text();
      console.error('Approve failed', { paymentId, status: approveRes.status, body: txt.slice(0, 200) });
      return res.status(502).json({ error: `Pi Testnet Server Approval failed (${approveRes.status}): ${txt}` });
    }
    const paymentData = (await approveRes.json()) as {
      identifier?: string;
      amount?: number;
      direction?: string;
      user_uid?: string;
      network?: string;
      metadata?: { orderId?: number | string; [key: string]: unknown } | null;
      status?: { developer_approved?: boolean; cancelled?: boolean; user_cancelled?: boolean };
    };

    if (paymentData.direction && paymentData.direction !== 'user_to_app') {
      return res.status(400).json({ error: `Invalid payment direction (${paymentData.direction}). Expected user_to_app.` });
    }
    if (paymentData.network && !paymentData.network.toLowerCase().includes('testnet')) {
      return res.status(403).json({ error: 'Only Pi Testnet payments are permitted.' });
    }
    if (req.authUser?.pi_uid && paymentData.user_uid && paymentData.user_uid !== req.authUser.pi_uid) {
      return res.status(403).json({ error: 'Payment payer identity does not match authenticated user.' });
    }
    if (paymentData.metadata?.orderId && Number(paymentData.metadata.orderId) !== order.id) {
      return res.status(400).json({ error: 'Payment metadata orderId mismatch.' });
    }
    if (typeof paymentData.amount !== 'number' || Math.abs(paymentData.amount - order.total_pi) > 0.0001) {
      recordSecurityEvent('pi_amount_mismatch', 'critical', req.authUser!.id, req.ip || '', `Expected ${order.total_pi} PI, Pi API reported ${paymentData.amount}`);
      return res.status(400).json({ error: 'Payment amount mismatch detected during server verification.' });
    }
    if (paymentData.status?.cancelled || paymentData.status?.user_cancelled) {
      return res.status(409).json({ error: 'Pi payment was cancelled.' });
    }

    db.prepare(`
      UPDATE payments
      SET pi_payment_id = ?, status = 'approved', verification_payload_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(paymentId, JSON.stringify(paymentData), order.pay_id);

    recordAudit(req.authUser!.id, 'pi_payment_approved', 'payment', order.pay_id, req.ip || '', { paymentId });
    console.log('Approve success', { paymentId, orderId });
    return res.json({ approved: true, paymentId });
  } catch (err) {
    console.error('Approve failed', { paymentId, error: String(err) });
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
    SELECT p.id as pay_id, p.order_id, p.amount_pi, p.status as pay_status, p.txid as existing_txid,
           o.buyer_user_id, o.order_type, o.reference_id, o.item_title
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.pi_payment_id = ? AND o.buyer_user_id = ?
  `).get(paymentId, req.authUser!.id) as
    | {
        pay_id: number;
        order_id: number;
        amount_pi: number;
        pay_status: string;
        existing_txid: string | null;
        buyer_user_id: number;
        order_type: string;
        reference_id: number;
        item_title: string;
      }
    | undefined;

  if (!paymentRow) {
    return res.status(404).json({ error: 'Matching approved payment record not found.' });
  }
  if (paymentRow.pay_status === 'completed') {
    if (paymentRow.existing_txid === txid) {
      return res.json({ completed: true, unlocked: true, alreadyCompleted: true, txid, orderId: paymentRow.order_id });
    }
    return res.status(409).json({ error: 'Payment already verified and completed with a different txid.' });
  }

  // Prevent duplicate txid replay across different orders
  const existingTx = db.prepare(`SELECT id, order_id FROM payments WHERE txid = ? AND order_id != ?`).get(
    txid,
    paymentRow.order_id
  ) as { id: number; order_id: number } | undefined;
  if (existingTx) {
    recordSecurityEvent('pi_duplicate_txid_replay', 'critical', req.authUser!.id, req.ip || '', `Duplicate txid replay blocked: ${txid}`);
    return res.status(409).json({ error: 'Duplicate blockchain transaction ID (txid) detected and blocked.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    return res.status(503).json({
      error: 'PI_NETWORK_API_KEY is not configured. Server-side completion requires official Pi Platform API credentials.',
    });
  }

  try {
    const inspectRes = await fetch(`${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Key ${piKey}` },
    });
    if (!inspectRes.ok) {
      return res.status(502).json({ error: `Pi Platform API payment lookup failed (${inspectRes.status}).` });
    }
    const inspectedPayload = (await inspectRes.json()) as {
      amount?: number;
      direction?: string;
      user_uid?: string;
      network?: string;
      status?: { developer_completed?: boolean; transaction_verified?: boolean };
      transaction?: { txid?: string; verified?: boolean } | null;
    };

    if (inspectedPayload.direction && inspectedPayload.direction !== 'user_to_app') {
      return res.status(400).json({ error: `Invalid payment direction (${inspectedPayload.direction}).` });
    }
    if (inspectedPayload.network && !inspectedPayload.network.toLowerCase().includes('testnet')) {
      return res.status(403).json({ error: 'Only Pi Testnet payments are permitted.' });
    }
    if (req.authUser?.pi_uid && inspectedPayload.user_uid && inspectedPayload.user_uid !== req.authUser.pi_uid) {
      return res.status(403).json({ error: 'Payment payer identity mismatch.' });
    }
    if (typeof inspectedPayload.amount !== 'number' || Math.abs(inspectedPayload.amount - paymentRow.amount_pi) > 0.0001) {
      return res.status(400).json({ error: 'Payment amount mismatch detected during completion verification.' });
    }
    if (inspectedPayload.transaction?.txid && inspectedPayload.transaction.txid !== txid) {
      return res.status(409).json({ error: 'Submitted txid does not match Pi Platform record.' });
    }

    const alreadyDoneOnPi = Boolean(
      inspectedPayload.status?.developer_completed &&
        (inspectedPayload.status?.transaction_verified || inspectedPayload.transaction?.verified)
    );

    const completedPayload = alreadyDoneOnPi
      ? inspectedPayload
      : await (async () => {
          const completeRes = await fetch(`${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`, {
            method: 'POST',
            headers: {
              Authorization: `Key ${piKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ txid }),
          });
          if (!completeRes.ok) {
            const txt = await completeRes.text();
            throw new Error(`Pi Server Completion failed: ${txt}`);
          }
          return completeRes.json();
        })();

    const txVerified = Boolean(
      completedPayload?.status?.transaction_verified || completedPayload?.transaction?.verified
    );
    if (!completedPayload?.status?.developer_completed || !txVerified) {
      recordSecurityEvent('pi_unverified_completion', 'critical', req.authUser!.id, req.ip || '', `Unverified completion payload for ${paymentId}`);
      return res.status(400).json({ error: 'Pi blockchain transaction could not be verified on server.' });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE payments
        SET txid = ?, status = 'completed', verification_payload_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(txid, JSON.stringify(completedPayload), paymentRow.pay_id);

      let fulfillmentStatus = 'unlocked_digital';

      if (paymentRow.order_type === 'course') {
        const certCode = `IFIOK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        db.prepare(`
          INSERT OR REPLACE INTO enrolments (user_id, course_id, progress_percent, certificate_code, status)
          VALUES (?, ?, 0, ?, 'active')
        `).run(paymentRow.buyer_user_id, paymentRow.reference_id, certCode);

        db.prepare(`
          INSERT OR REPLACE INTO entitlements (user_id, order_id, item_type, item_id, is_unlocked, unlocked_at)
          VALUES (?, ?, 'course', ?, 1, datetime('now'))
        `).run(paymentRow.buyer_user_id, paymentRow.order_id, paymentRow.reference_id);
      } else if (paymentRow.order_type === 'service') {
        fulfillmentStatus = 'service_in_progress';
        db.prepare(`UPDATE projects SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(
          paymentRow.reference_id
        );
      } else if (paymentRow.order_type === 'subscription') {
        fulfillmentStatus = 'subscription_active';
        db.prepare(`
          UPDATE subscriptions
          SET status = 'active', starts_at = datetime('now'), ends_at = datetime('now', '+30 days')
          WHERE id = ?
        `).run(paymentRow.reference_id);
      } else if (paymentRow.order_type === 'product') {
        const prod = db.prepare(`SELECT product_type FROM products WHERE id = ?`).get(paymentRow.reference_id) as
          | { product_type: string }
          | undefined;
        db.prepare(`UPDATE products SET stock_qty = MAX(0, stock_qty - 1) WHERE id = ?`).run(paymentRow.reference_id);

        if (prod && prod.product_type === 'physical') {
          fulfillmentStatus = 'ready_for_shipment';
        } else {
          fulfillmentStatus = 'unlocked_digital';
          db.prepare(`
            INSERT OR REPLACE INTO entitlements (user_id, order_id, item_type, item_id, is_unlocked, unlocked_at)
            VALUES (?, ?, 'product', ?, 1, datetime('now'))
          `).run(paymentRow.buyer_user_id, paymentRow.order_id, paymentRow.reference_id);
        }
      }

      db.prepare(`UPDATE orders SET status = 'paid', fulfillment_status = ? WHERE id = ?`).run(
        fulfillmentStatus,
        paymentRow.order_id
      );

      createNotification(
        paymentRow.buyer_user_id,
        'payment',
        'Pi Payment Verified & Content Unlocked',
        `Testnet settlement of ${paymentRow.amount_pi} π for "${paymentRow.item_title}" verified (TX: ${txid.slice(0, 12)}...).`,
        'transactions'
      );
      recordAudit(paymentRow.buyer_user_id, 'pi_payment_completed', 'payment', paymentRow.pay_id, req.ip || '', {
        paymentId,
        txid,
        orderId: paymentRow.order_id,
        fulfillmentStatus,
      });
    })();

    return res.json({ completed: true, unlocked: true, txid, orderId: paymentRow.order_id });
  } catch (err) {
    return res.status(502).json({ error: `Pi completion verification error: ${String(err)}` });
  }
});

// Paid content unlock check: strictly enforces verified Pi payment before releasing locked materials
router.get('/entitlements/:itemType/:itemId', requireAuth, (req, res) => {
  const itemType = req.params.itemType;
  const itemId = Number(req.params.itemId);
  if (!['product', 'course'].includes(itemType) || !itemId) {
    return res.status(400).json({ error: 'Invalid entitlement query.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');

  if (itemType === 'product') {
    const prod = db.prepare(`
      SELECT p.id, p.title, p.locked_content_enc, p.file_storage_key, p.file_original_name, p.file_format,
             p.file_size_bytes, p.file_sha256, p.version, s.user_id as seller_user_id
      FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?
    `).get(itemId) as
      | {
          id: number;
          title: string;
          locked_content_enc: string;
          file_storage_key: string;
          file_original_name: string;
          file_format: string;
          file_size_bytes: number;
          file_sha256: string;
          version: string;
          seller_user_id: number;
        }
      | undefined;

    if (!prod) return res.status(404).json({ error: 'Digital product not found.' });

    const ent = db.prepare(`
      SELECT e.is_unlocked, e.unlocked_at
      FROM entitlements e
      JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? AND e.item_type = 'product' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
    `).get(req.authUser!.id, itemId) as { is_unlocked: number; unlocked_at: string } | undefined;

    if (!ent && !isAdmin && prod.seller_user_id !== req.authUser!.id) {
      return res.status(402).json({
        unlocked: false,
        error: 'Content is locked until server verifies Pi Network payment completion.',
      });
    }

    return res.json({
      unlocked: true,
      unlockedAt: ent?.unlocked_at || new Date().toISOString(),
      title: prod.title,
      content: prod.locked_content_enc ? decryptSensitive(prod.locked_content_enc) : 'Verified digital entitlement active.',
      hasFile: Boolean(prod.file_storage_key),
      fileOriginalName: prod.file_original_name || '',
      fileFormat: prod.file_format || '',
      fileSizeBytes: prod.file_size_bytes || 0,
      fileSha256: prod.file_sha256 || '',
      version: prod.version || '1.0.0',
    });
  }

  const course = db.prepare(`
    SELECT c.id, c.title, c.price_pi, c.locked_materials_enc, c.course_files_json, i.user_id as instructor_user_id
    FROM courses c JOIN instructors i ON i.id = c.instructor_id WHERE c.id = ?
  `).get(itemId) as
    | {
        id: number;
        title: string;
        price_pi: number;
        locked_materials_enc: string;
        course_files_json: string;
        instructor_user_id: number;
      }
    | undefined;
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const ent = db.prepare(`
    SELECT e.is_unlocked, e.unlocked_at
    FROM entitlements e
    JOIN orders o ON o.id = e.order_id
    WHERE e.user_id = ? AND e.item_type = 'course' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
  `).get(req.authUser!.id, itemId) as { is_unlocked: number; unlocked_at: string } | undefined;

  const isFree = Number(course.price_pi) === 0;
  if (!ent && !isFree && !isAdmin && course.instructor_user_id !== req.authUser!.id) {
    return res.status(402).json({
      unlocked: false,
      error: 'Content is locked until server verifies Pi Network payment completion.',
    });
  }

  let courseFiles: Array<{ storageKey: string; originalName: string; fileFormat: string; fileSizeBytes: number }> = [];
  try {
    const parsed = JSON.parse(course.course_files_json || '[]');
    if (Array.isArray(parsed)) courseFiles = parsed;
  } catch {
    courseFiles = [];
  }

  return res.json({
    unlocked: true,
    unlockedAt: ent?.unlocked_at || new Date().toISOString(),
    title: course.title,
    content: course.locked_materials_enc ? decryptSensitive(course.locked_materials_enc) : 'Verified course curriculum unlocked.',
    courseFiles,
  });
});

// Issue short-lived (300s) HMAC-SHA256 signed download token for an unlocked product or course file
router.post('/entitlements/:itemType/:itemId/download-token', requireAuth, (req, res) => {
  const itemType = req.params.itemType;
  const itemId = Number(req.params.itemId);
  const requestedFileKey = typeof req.body?.fileKey === 'string' ? path.basename(req.body.fileKey.trim()) : '';

  if (!['product', 'course'].includes(itemType) || !itemId) {
    return res.status(400).json({ error: 'Invalid download token request.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  let storageKey = '';
  let originalName = '';
  let fileFormat = '';
  let fileSizeBytes = 0;

  if (itemType === 'product') {
    const prod = db.prepare(`
      SELECT p.id, p.title, p.file_storage_key, p.file_original_name, p.file_format, p.file_size_bytes, s.user_id as seller_user_id
      FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?
    `).get(itemId) as
      | {
          id: number;
          title: string;
          file_storage_key: string;
          file_original_name: string;
          file_format: string;
          file_size_bytes: number;
          seller_user_id: number;
        }
      | undefined;
    if (!prod) return res.status(404).json({ error: 'Product not found.' });

    const ent = db.prepare(`
      SELECT e.id FROM entitlements e
      JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? AND e.item_type = 'product' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
    `).get(req.authUser!.id, itemId);

    if (!ent && !isAdmin && prod.seller_user_id !== req.authUser!.id) {
      return res.status(402).json({ error: 'Download locked: Pi Network payment verification required.' });
    }
    if (!prod.file_storage_key) {
      return res.status(404).json({ error: 'No binary digital file is attached to this listing.' });
    }
    storageKey = path.basename(prod.file_storage_key);
    originalName = prod.file_original_name || storageKey;
    fileFormat = prod.file_format || '';
    fileSizeBytes = prod.file_size_bytes || 0;
  } else {
    const course = db.prepare(`
      SELECT c.id, c.price_pi, c.course_files_json, i.user_id as instructor_user_id
      FROM courses c JOIN instructors i ON i.id = c.instructor_id WHERE c.id = ?
    `).get(itemId) as
      | { id: number; price_pi: number; course_files_json: string; instructor_user_id: number }
      | undefined;
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const ent = db.prepare(`
      SELECT e.id FROM entitlements e
      JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? AND e.item_type = 'course' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
    `).get(req.authUser!.id, itemId);
    const isFree = Number(course.price_pi) === 0;
    if (!ent && !isFree && !isAdmin && course.instructor_user_id !== req.authUser!.id) {
      return res.status(402).json({ error: 'Download locked: complete Pi payment or enrolment first.' });
    }

    let files: Array<{ storageKey: string; originalName: string; fileFormat?: string; fileSizeBytes?: number }> = [];
    try {
      const parsed = JSON.parse(course.course_files_json || '[]');
      if (Array.isArray(parsed)) files = parsed;
    } catch {
      files = [];
    }
    const matched = requestedFileKey ? files.find((f) => f.storageKey === requestedFileKey) : files[0];
    if (!matched || !matched.storageKey) {
      return res.status(404).json({ error: 'Requested course material file was not found.' });
    }
    storageKey = path.basename(matched.storageKey);
    originalName = matched.originalName || storageKey;
    fileFormat = matched.fileFormat || '';
    fileSizeBytes = Number(matched.fileSizeBytes || 0);
  }

  const targetPath = path.join(PRIVATE_ASSETS_DIR, storageKey);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Asset file not found in private vault.' });
  }

  const ttlSeconds = 300;
  const token = signDownloadToken(
    {
      userId: req.authUser!.id,
      itemType: itemType as 'product' | 'course',
      itemId,
      storageKey,
      originalName,
    },
    ttlSeconds
  );

  return res.json({
    token,
    downloadUrl: `/api/payments/download/${encodeURIComponent(token)}`,
    expiresInSeconds: ttlSeconds,
    fileName: originalName,
    fileFormat,
    fileSizeBytes,
  });
});

// Stream private digital asset ONLY with valid, unexpired, DB-verified entitlement token
router.get('/download/:token', requireAuth, (req, res) => {
  const token = String(req.params.token || '');
  const verified = verifyDownloadToken(token);
  if (verified.valid === false) {
    return res.status(verified.status).json({ error: verified.error });
  }

  const { payload } = verified;
  if (payload.userId !== req.authUser!.id && !req.authUser!.roles.includes('super_admin')) {
    recordSecurityEvent(
      'download_token_user_mismatch',
      'critical',
      req.authUser!.id,
      req.ip || '',
      `User #${req.authUser!.id} attempted download using token belonging to user #${payload.userId}`
    );
    return res.status(403).json({ error: 'Download token belongs to a different account.' });
  }

  const safeKey = path.basename(payload.storageKey);
  const targetPath = path.join(PRIVATE_ASSETS_DIR, safeKey);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'File no longer exists in private vault.' });
  }

  // Re-verify live entitlement at download time (prevents revoked/refunded orders from downloading)
  const isAdmin = req.authUser!.roles.includes('super_admin');
  if (payload.itemType === 'product') {
    const prodOwner = db.prepare(`SELECT s.user_id FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?`).get(payload.itemId) as
      | { user_id: number }
      | undefined;
    const ent = db.prepare(`
      SELECT e.order_id FROM entitlements e
      JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? AND e.item_type = 'product' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
    `).get(payload.userId, payload.itemId) as { order_id: number } | undefined;

    if (!ent && !isAdmin && prodOwner?.user_id !== payload.userId) {
      return res.status(403).json({ error: 'Entitlement revoked or unpaid. Download denied.' });
    }

    db.prepare(`
      INSERT INTO product_downloads (user_id, product_id, order_id, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(req.authUser!.id, payload.itemId, ent?.order_id ?? null, req.ip || '');
    db.prepare(`UPDATE products SET download_count = download_count + 1 WHERE id = ?`).run(payload.itemId);
  } else if (payload.itemType === 'course') {
    const course = db.prepare(`
      SELECT c.price_pi, i.user_id as instructor_user_id
      FROM courses c JOIN instructors i ON i.id = c.instructor_id WHERE c.id = ?
    `).get(payload.itemId) as { price_pi: number; instructor_user_id: number } | undefined;
    const ent = db.prepare(`
      SELECT e.id FROM entitlements e
      JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? AND e.item_type = 'course' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
    `).get(payload.userId, payload.itemId);
    const isFree = course && Number(course.price_pi) === 0;
    if (!ent && !isFree && !isAdmin && course?.instructor_user_id !== payload.userId) {
      return res.status(403).json({ error: 'Course entitlement revoked or unpaid. Download denied.' });
    }

    db.prepare(`
      INSERT INTO course_downloads (user_id, course_id, file_key, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(req.authUser!.id, payload.itemId, safeKey, req.ip || '');
  }

  recordAudit(req.authUser!.id, 'digital_asset_downloaded', payload.itemType, payload.itemId, req.ip || '', {
    storageKey: safeKey,
  });

  const cleanFileName = payload.originalName.replace(/["\r\n]/g, '_') || safeKey;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
  return res.sendFile(targetPath);
});

// Physical order fulfillment guard (strictly blocks shipping unpaid orders)
router.post('/orders/:orderId/fulfill', requireAuth, (req, res) => {
  const orderId = Number(req.params.orderId);
  const order = db.prepare(`
    SELECT o.id, o.order_type, o.reference_id, o.status, o.buyer_user_id
    FROM orders o WHERE o.id = ?
  `).get(orderId) as
    | { id: number; order_type: string; reference_id: number; status: string; buyer_user_id: number }
    | undefined;

  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const isAdmin = req.authUser!.roles.some((r) => ['super_admin', 'finance_admin'].includes(r));
  let isSellerOwner = false;
  if (order.order_type === 'product') {
    const owner = db.prepare(`
      SELECT s.user_id FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?
    `).get(order.reference_id) as { user_id: number } | undefined;
    isSellerOwner = owner?.user_id === req.authUser!.id;
  }

  if (!isAdmin && !isSellerOwner) {
    return res.status(403).json({ error: 'Unauthorized to fulfill this order.' });
  }

  if (order.status !== 'paid') {
    recordSecurityEvent('unpaid_fulfillment_blocked', 'critical', req.authUser!.id, req.ip || '', `Blocked fulfillment attempt on unpaid order #${orderId} (status: ${order.status})`);
    return res.status(403).json({
      error: 'Order cannot be fulfilled before server-verified Pi payment completion.',
    });
  }

  db.prepare(`UPDATE orders SET status = 'fulfilled', fulfillment_status = 'fulfilled' WHERE id = ?`).run(orderId);
  createNotification(order.buyer_user_id, 'payment', 'Order Fulfilled', `Order #${orderId} has been fulfilled by the seller.`, 'orders');
  recordAudit(req.authUser!.id, 'order_fulfilled', 'order', orderId, req.ip || '', {});
  return res.json({ fulfilled: true });
});

router.post('/pi/cancel', requireAuth, async (req, res) => {
  const orderId = Number(req.body?.orderId);
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const piKey = getPiApiKey();
  if (paymentId && piKey) {
    await fetch(`${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    }).catch(() => undefined);
  }

  db.transaction(() => {
    db.prepare(`UPDATE orders SET status = 'cancelled', fulfillment_status = 'cancelled_locked' WHERE id = ? AND buyer_user_id = ? AND status = 'awaiting_payment'`).run(
      orderId,
      req.authUser!.id
    );
    db.prepare(`UPDATE payments SET status = 'cancelled', updated_at = datetime('now') WHERE order_id = ? AND user_id = ? AND status IN ('created', 'approved')`).run(
      orderId,
      req.authUser!.id
    );
  })();
  checkSuspiciousPaymentVelocity(req.authUser!.id, req.ip || '');
  return res.json({ cancelled: true });
});

router.get('/my', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.id as order_id, o.order_type, o.reference_id, o.item_title, o.subtotal_pi, o.platform_fee_pi,
           o.total_pi, o.status as order_status, o.fulfillment_status, o.created_at,
           p.id as payment_id, p.pi_payment_id, p.txid, p.environment, p.status as payment_status
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.buyer_user_id = ?
    ORDER BY o.created_at DESC
  `).all(req.authUser!.id);

  res.json({ transactions: rows });
});

export default router;
