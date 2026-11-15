import { Router } from 'express';
import { db } from '../db.ts';
import { optionalAuth, recordAudit, recordSecurityEvent } from '../middleware/auth.ts';

const router = Router();

const PI_API_BASE = 'https://api.minepi.com/v2';
const TESTNET_AMOUNT_PI = 0.01;
const TESTNET_APP_WALLET =
  process.env.PI_TESTNET_WALLET?.trim() || 'GDD4KZEBDEJMYJYP6O5SCBHE5GGIF6K3RTHCF4ZGIWWIPGAHLTTXZB2O';
const TESTNET_APP_URL = 'https://ifiok-en.vercel.app';

interface PiPlatformPayment {
  identifier?: string;
  user_uid?: string;
  amount?: number;
  memo?: string;
  metadata?: { type?: string; app?: string; [key: string]: unknown } | null;
  to_address?: string;
  network?: string;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  } | null;
}

function getPiApiKey(): string | null {
  const key = process.env.PI_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

function validateTestnetPaymentForApp(
  piPayment: PiPlatformPayment,
  expectedPaymentId: string
): { valid: true } | { valid: false; statusCode: number; error: string } {
  if (piPayment.identifier && piPayment.identifier !== expectedPaymentId) {
    return { valid: false, statusCode: 400, error: 'Payment identifier mismatch.' };
  }

  // Strictly block Mainnet payments on Testnet endpoint
  if (piPayment.network && !piPayment.network.toLowerCase().includes('testnet')) {
    return {
      valid: false,
      statusCode: 403,
      error: `Only Pi Testnet payments are permitted here (received network: ${piPayment.network}).`,
    };
  }

  // Verify amount equals 0.01 Pi
  if (typeof piPayment.amount !== 'number' || Math.abs(piPayment.amount - TESTNET_AMOUNT_PI) > 0.00001) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid Testnet test amount. Expected ${TESTNET_AMOUNT_PI} Pi, received ${piPayment.amount ?? 'unknown'}.`,
    };
  }

  // Verify metadata belongs to IFIOK-EN if metadata was included
  if (piPayment.metadata && piPayment.metadata.app && piPayment.metadata.app !== 'ifiok-en') {
    return {
      valid: false,
      statusCode: 403,
      error: 'Payment metadata does not belong to the IFIOK-EN application.',
    };
  }

  return { valid: true };
}

router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    app: 'IFIOK-EN',
    appUrl: TESTNET_APP_URL,
    environment: 'testnet',
    sandbox: true,
    sdkVersion: '2.0',
    testAmountPi: TESTNET_AMOUNT_PI,
    testnetWallet: TESTNET_APP_WALLET,
    piServerKeyConfigured: Boolean(getPiApiKey()),
  });
});

router.post('/approve', optionalAuth, async (req, res) => {
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 80) : '';
  const piUid = typeof req.body?.piUid === 'string' ? req.body.piUid.trim().slice(0, 120) : '';

  if (!paymentId) {
    return res.status(400).json({ ok: false, error: 'paymentId is required for server approval.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    recordSecurityEvent(
      'pi_testnet_missing_api_key',
      'warning',
      req.authUser?.id ?? null,
      req.ip || '',
      `Approval attempted for ${paymentId} without PI_API_KEY configured`
    );
    return res.status(503).json({
      ok: false,
      error: 'PI_API_KEY is not configured on the server. Add your Pi Developer Portal Testnet Server API Key to PI_API_KEY.',
    });
  }

  try {
    // 1. Inspect payment on Pi Platform API to verify app ownership & exact 0.01 Pi amount
    const inspectRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Key ${piKey}` },
    });

    if (!inspectRes.ok) {
      const errText = await inspectRes.text();
      return res.status(502).json({
        ok: false,
        error: `Pi Platform API rejected payment lookup (${inspectRes.status}): ${errText || 'Not found'}`,
      });
    }

    const piPayment = (await inspectRes.json()) as PiPlatformPayment;
    const validation = validateTestnetPaymentForApp(piPayment, paymentId);
    if (!validation.valid) {
      recordSecurityEvent(
        'pi_testnet_approval_validation_failed',
        'warning',
        req.authUser?.id ?? null,
        req.ip || '',
        `${paymentId}: ${validation.error}`
      );
      return res.status(validation.statusCode).json({ ok: false, error: validation.error });
    }

    // 2. Call Pi Platform API /approve
    const approveRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    });

    if (!approveRes.ok) {
      const errText = await approveRes.text();
      db.prepare(`
        INSERT INTO pi_testnet_payments (payment_id, username, pi_uid, user_id, amount_pi, memo, metadata_json, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?)
        ON CONFLICT(payment_id) DO UPDATE SET
          status = 'failed',
          error_message = excluded.error_message,
          updated_at = datetime('now')
      `).run(
        paymentId,
        username,
        piUid || piPayment.user_uid || '',
        req.authUser?.id ?? null,
        TESTNET_AMOUNT_PI,
        piPayment.memo || 'IFIOK-EN Testnet Test',
        JSON.stringify(piPayment.metadata || {}),
        errText.slice(0, 400)
      );
      return res.status(502).json({
        ok: false,
        error: `Pi Server Approval failed (${approveRes.status}): ${errText}`,
      });
    }

    const approvedJson = (await approveRes.json()) as PiPlatformPayment;
    const resolvedUid = piUid || approvedJson.user_uid || piPayment.user_uid || '';

    db.prepare(`
      INSERT INTO pi_testnet_payments (
        payment_id, username, pi_uid, user_id, amount_pi, memo, metadata_json, environment, status, verification_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'testnet', 'approved', ?)
      ON CONFLICT(payment_id) DO UPDATE SET
        username = CASE WHEN excluded.username != '' THEN excluded.username ELSE pi_testnet_payments.username END,
        pi_uid = CASE WHEN excluded.pi_uid != '' THEN excluded.pi_uid ELSE pi_testnet_payments.pi_uid END,
        status = 'approved',
        verification_payload_json = excluded.verification_payload_json,
        error_message = '',
        updated_at = datetime('now')
    `).run(
      paymentId,
      username,
      resolvedUid,
      req.authUser?.id ?? null,
      TESTNET_AMOUNT_PI,
      approvedJson.memo || piPayment.memo || 'IFIOK-EN Testnet Test',
      JSON.stringify(approvedJson.metadata || piPayment.metadata || {}),
      JSON.stringify(approvedJson)
    );

    recordAudit(req.authUser?.id ?? null, 'pi_testnet_approved', 'pi_testnet_payment', paymentId, req.ip || '', {
      paymentId,
      username,
      amount: TESTNET_AMOUNT_PI,
      environment: 'testnet',
    });

    console.log(`[PI TESTNET APPROVE] paymentId=${paymentId} username=${username || 'pi-user'} amount=${TESTNET_AMOUNT_PI}`);

    return res.json({
      ok: true,
      approved: true,
      paymentId,
      amount: TESTNET_AMOUNT_PI,
      username,
      status: 'approved',
      environment: 'testnet',
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: `Pi Server Approval communication error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

router.post('/complete', optionalAuth, async (req, res) => {
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const txid = typeof req.body?.txid === 'string' ? req.body.txid.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 80) : '';
  const piUid = typeof req.body?.piUid === 'string' ? req.body.piUid.trim().slice(0, 120) : '';

  if (!paymentId || !txid) {
    return res.status(400).json({ ok: false, error: 'paymentId and txid are required for server completion.' });
  }

  // Block replay of a txid already used by another paymentId
  const duplicateTx = db.prepare(`
    SELECT payment_id FROM pi_testnet_payments WHERE txid = ? AND payment_id != ? AND status = 'completed'
  `).get(txid, paymentId) as { payment_id: string } | undefined;
  if (duplicateTx) {
    recordSecurityEvent(
      'pi_testnet_duplicate_txid',
      'critical',
      req.authUser?.id ?? null,
      req.ip || '',
      `Blocked duplicate txid ${txid} for ${paymentId} (already bound to ${duplicateTx.payment_id})`
    );
    return res.status(409).json({ ok: false, error: 'Duplicate blockchain transaction ID (txid) rejected.' });
  }

  const piKey = getPiApiKey();
  if (!piKey) {
    return res.status(503).json({
      ok: false,
      error: 'PI_API_KEY is not configured on the server. Add your Pi Developer Portal Testnet Server API Key to PI_API_KEY.',
    });
  }

  try {
    // 1. Inspect payment on Pi Platform API first to confirm app ownership & amount === 0.01
    const inspectRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Key ${piKey}` },
    });

    if (!inspectRes.ok) {
      const errText = await inspectRes.text();
      return res.status(502).json({
        ok: false,
        error: `Pi Platform API rejected payment verification (${inspectRes.status}): ${errText || 'Not found'}`,
      });
    }

    const piPayment = (await inspectRes.json()) as PiPlatformPayment;
    const validation = validateTestnetPaymentForApp(piPayment, paymentId);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({ ok: false, error: validation.error });
    }

    // 2. Call Pi Platform API /complete with txid
    const completeRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${piKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
    });

    if (!completeRes.ok) {
      const errText = await completeRes.text();
      db.prepare(`
        INSERT INTO pi_testnet_payments (payment_id, txid, username, pi_uid, user_id, amount_pi, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)
        ON CONFLICT(payment_id) DO UPDATE SET
          txid = excluded.txid,
          status = 'failed',
          error_message = excluded.error_message,
          updated_at = datetime('now')
      `).run(paymentId, txid, username, piUid || piPayment.user_uid || '', req.authUser?.id ?? null, TESTNET_AMOUNT_PI, errText.slice(0, 400));

      return res.status(502).json({
        ok: false,
        error: `Pi Server Completion failed (${completeRes.status}): ${errText}`,
      });
    }

    const completedJson = (await completeRes.json()) as PiPlatformPayment;
    const txVerified = Boolean(completedJson?.status?.transaction_verified || completedJson?.transaction?.verified);
    const devCompleted = Boolean(completedJson?.status?.developer_completed);

    if (!devCompleted || !txVerified) {
      return res.status(400).json({
        ok: false,
        error: 'Pi Platform did not confirm both developer_completed and transaction_verified on Testnet.',
      });
    }

    const resolvedUid = piUid || completedJson.user_uid || piPayment.user_uid || '';
    const existingRow = db.prepare(`SELECT username FROM pi_testnet_payments WHERE payment_id = ?`).get(paymentId) as
      | { username: string }
      | undefined;
    const finalUsername = username || existingRow?.username || '';

    db.prepare(`
      INSERT INTO pi_testnet_payments (
        payment_id, txid, username, pi_uid, user_id, amount_pi, memo, metadata_json, environment, status, verification_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'testnet', 'completed', ?)
      ON CONFLICT(payment_id) DO UPDATE SET
        txid = excluded.txid,
        username = CASE WHEN excluded.username != '' THEN excluded.username ELSE pi_testnet_payments.username END,
        pi_uid = CASE WHEN excluded.pi_uid != '' THEN excluded.pi_uid ELSE pi_testnet_payments.pi_uid END,
        status = 'completed',
        verification_payload_json = excluded.verification_payload_json,
        error_message = '',
        updated_at = datetime('now')
    `).run(
      paymentId,
      txid,
      finalUsername,
      resolvedUid,
      req.authUser?.id ?? null,
      TESTNET_AMOUNT_PI,
      completedJson.memo || piPayment.memo || 'IFIOK-EN Testnet Test',
      JSON.stringify(completedJson.metadata || piPayment.metadata || {}),
      JSON.stringify(completedJson)
    );

    recordAudit(req.authUser?.id ?? null, 'pi_testnet_completed', 'pi_testnet_payment', paymentId, req.ip || '', {
      paymentId,
      txid,
      username: finalUsername,
      amount: TESTNET_AMOUNT_PI,
      environment: 'testnet',
    });

    console.log(
      `[PI TESTNET COMPLETE] paymentId=${paymentId} txid=${txid} username=${finalUsername || 'pi-user'} amount=${TESTNET_AMOUNT_PI}`
    );

    return res.json({
      ok: true,
      completed: true,
      paymentId,
      txid,
      amount: TESTNET_AMOUNT_PI,
      username: finalUsername,
      status: 'completed',
      environment: 'testnet',
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: `Pi Server Completion error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

router.post('/cancel', optionalAuth, async (req, res) => {
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 80) : '';
  const attemptServerCancel = Boolean(req.body?.attemptServerCancel);

  if (!paymentId) {
    return res.status(400).json({ ok: false, error: 'paymentId is required.' });
  }

  const piKey = getPiApiKey();
  if (attemptServerCancel && piKey) {
    await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    }).catch(() => undefined);
  }

  db.prepare(`
    INSERT INTO pi_testnet_payments (payment_id, username, user_id, amount_pi, status)
    VALUES (?, ?, ?, ?, 'cancelled')
    ON CONFLICT(payment_id) DO UPDATE SET
      status = CASE WHEN pi_testnet_payments.status = 'completed' THEN 'completed' ELSE 'cancelled' END,
      updated_at = datetime('now')
  `).run(paymentId, username, req.authUser?.id ?? null, TESTNET_AMOUNT_PI);

  return res.json({ ok: true, cancelled: true, paymentId });
});

export default router;
