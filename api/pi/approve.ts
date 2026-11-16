import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_API_BASE = 'https://api.minepi.com/v2';
const TESTNET_AMOUNT_PI = 0.01;

type Req = IncomingMessage & { body?: Record<string, unknown> };
type Res = ServerResponse & {
  status?: (code: number) => Res;
  json?: (data: unknown) => void;
};

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

  if (!paymentId) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId is required.' });
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
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    // 1. Retrieve & validate payment from Pi Platform API before approving
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
        error: `Pi payment lookup failed (${inspectRes.status}): ${inspectText}`,
      });
    }

    const preCheck = validateU2APayment(inspected, paymentId);
    if (!preCheck.valid) {
      return sendJson(res, preCheck.statusCode, { success: false, ok: false, error: preCheck.error });
    }

    if (inspected.status?.cancelled || inspected.status?.user_cancelled) {
      return sendJson(res, 409, { success: false, ok: false, error: 'Payment was already cancelled.' });
    }

    // Idempotent retry if Pi already recorded developer_approved
    if (inspected.status?.developer_approved) {
      return sendJson(res, 200, {
        success: true,
        ok: true,
        approved: true,
        alreadyApproved: true,
        paymentId,
        amount: TESTNET_AMOUNT_PI,
        status: 'approved',
        environment: 'testnet',
      });
    }

    // 2. Approve on Pi Platform API
    const approveRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
      signal: controller.signal,
    });
    const rawText = await approveRes.text();
    let approvedJson: PiPaymentRecord = {};
    try {
      approvedJson = rawText ? (JSON.parse(rawText) as PiPaymentRecord) : {};
    } catch {
      approvedJson = {};
    }

    if (!approveRes.ok) {
      console.error(`[VERCEL PI APPROVE FAIL] paymentId=${paymentId} status=${approveRes.status} body=${rawText.slice(0, 300)}`);
      return sendJson(res, 502, {
        success: false,
        ok: false,
        error: `Pi Server Approval failed (${approveRes.status}): ${rawText}`,
      });
    }

    const postCheck = validateU2APayment(approvedJson, paymentId);
    if (!postCheck.valid) {
      return sendJson(res, postCheck.statusCode, { success: false, ok: false, error: postCheck.error });
    }

    console.log(`[VERCEL PI APPROVE OK] paymentId=${paymentId}`);
    return sendJson(res, 200, {
      success: true,
      ok: true,
      approved: true,
      paymentId,
      amount: TESTNET_AMOUNT_PI,
      status: 'approved',
      environment: 'testnet',
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi approval request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
