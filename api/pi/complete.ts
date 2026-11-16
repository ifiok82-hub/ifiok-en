import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_API_BASE = 'https://api.minepi.com/v2';
const TESTNET_AMOUNT_PI = 0.01;

type Req = IncomingMessage & { body?: Record<string, unknown> };
type Res = ServerResponse;

async function readJsonBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sendJson(res: Res, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

interface PiPaymentRecord {
  identifier?: string;
  user_uid?: string;
  amount?: number;
  direction?: string;
  network?: string;
  metadata?: { app?: string; type?: string; [key: string]: unknown } | null;
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
  } | null;
}

function getPiApiKey(): string {
  return process.env.PI_NETWORK_API_KEY?.trim() || process.env.PI_API_KEY?.trim() || '';
}

function validateU2APayment(
  payment: PiPaymentRecord,
  expectedPaymentId: string
): { valid: true } | { valid: false; statusCode: number; error: string } {
  if (payment.identifier && payment.identifier !== expectedPaymentId) {
    return { valid: false, statusCode: 400, error: 'Payment identifier mismatch.' };
  }
  if (payment.direction && payment.direction !== 'user_to_app') {
    return { valid: false, statusCode: 400, error: `Invalid payment direction (${payment.direction}). Expected user_to_app.` };
  }
  if (payment.network && !payment.network.toLowerCase().includes('testnet')) {
    return { valid: false, statusCode: 403, error: `Only Pi Testnet payments are permitted (received ${payment.network}).` };
  }
  if (typeof payment.amount !== 'number' || Math.abs(payment.amount - TESTNET_AMOUNT_PI) > 0.00001) {
    return { valid: false, statusCode: 400, error: `Expected ${TESTNET_AMOUNT_PI} Pi, received ${payment.amount ?? 'unknown'}.` };
  }
  if (payment.metadata?.app && payment.metadata.app !== 'ifiok-en') {
    return { valid: false, statusCode: 403, error: 'Payment metadata does not belong to IFIOK-EN.' };
  }
  return { valid: true };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  const txid = typeof body.txid === 'string' ? body.txid.trim() : '';

  if (!paymentId || !txid) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId and txid are required.' });
  }

  const piKey = getPiApiKey();
  if (!piKey || piKey.length <= 10) {
    return sendJson(res, 503, {
      success: false,
      ok: false,
      error: 'PI_NETWORK_API_KEY is not configured on the server.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // 1. Inspect payment state before completion
    const inspectRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Key ${piKey}` },
      signal: controller.signal,
    });
    const inspectText = await inspectRes.text();
    let inspected: PiPaymentRecord = {};
    try {
      inspected = inspectText ? (JSON.parse(inspectText) as PiPaymentRecord) : {};
    } catch {
      inspected = {};
    }

    if (!inspectRes.ok) {
      return sendJson(res, 502, {
        success: false,
        ok: false,
        error: `Pi payment verification lookup failed (${inspectRes.status}): ${inspectText}`,
      });
    }

    const preCheck = validateU2APayment(inspected, paymentId);
    if (!preCheck.valid) {
      return sendJson(res, preCheck.statusCode, { success: false, ok: false, error: preCheck.error });
    }

    if (inspected.transaction?.txid && inspected.transaction.txid !== txid) {
      return sendJson(res, 409, {
        success: false,
        ok: false,
        error: 'Submitted txid does not match the transaction recorded on Pi Platform.',
      });
    }

    const alreadyVerified = Boolean(inspected.status?.transaction_verified || inspected.transaction?.verified);
    if (inspected.status?.developer_completed && alreadyVerified) {
      return sendJson(res, 200, {
        success: true,
        ok: true,
        completed: true,
        alreadyCompleted: true,
        paymentId,
        txid,
        amount: TESTNET_AMOUNT_PI,
        status: 'completed',
        environment: 'testnet',
      });
    }

    // 2. Complete payment with Pi Platform API
    const completeRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${piKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
      signal: controller.signal,
    });

    const rawText = await completeRes.text();
    let completedJson: PiPaymentRecord = {};
    try {
      completedJson = rawText ? (JSON.parse(rawText) as PiPaymentRecord) : {};
    } catch {
      completedJson = {};
    }

    if (!completeRes.ok) {
      console.error(`[VERCEL PI COMPLETE FAIL] paymentId=${paymentId} status=${completeRes.status} body=${rawText.slice(0, 300)}`);
      return sendJson(res, 502, {
        success: false,
        ok: false,
        error: `Pi Server Completion failed (${completeRes.status}): ${rawText}`,
      });
    }

    const postCheck = validateU2APayment(completedJson, paymentId);
    if (!postCheck.valid) {
      return sendJson(res, postCheck.statusCode, { success: false, ok: false, error: postCheck.error });
    }

    const verified = Boolean(completedJson.status?.transaction_verified || completedJson.transaction?.verified);
    if (!completedJson.status?.developer_completed || !verified) {
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: 'Pi Platform did not verify Testnet completion.',
      });
    }

    console.log(`[VERCEL PI COMPLETE OK] paymentId=${paymentId} txid=${txid}`);
    return sendJson(res, 200, {
      success: true,
      ok: true,
      completed: true,
      paymentId,
      txid,
      amount: TESTNET_AMOUNT_PI,
      status: 'completed',
      environment: 'testnet',
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi completion request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
