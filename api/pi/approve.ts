import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_TESTNET_API_BASE = 'https://api.testnet.minepi.com/v2';

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
  return process.env.PI_API_KEY?.trim() || process.env.PI_NETWORK_API_KEY?.trim() || '';
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
  if (typeof payment.amount !== 'number' || payment.amount <= 0) {
    return { valid: false, statusCode: 400, error: `Invalid Pi payment amount (${payment.amount ?? 'unknown'}).` };
  }
  if (payment.metadata?.type === 'testnet_test' && Math.abs(payment.amount - 0.01) > 0.00001) {
    return { valid: false, statusCode: 400, error: `Expected 0.01 Pi for Testnet test, received ${payment.amount}.` };
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

  console.log('Approve called', { paymentId });

  const piKey = getPiApiKey();
  if (!piKey || piKey.length <= 10) {
    console.error('Approve failed', { paymentId, error: 'PI_API_KEY missing' });
    return sendJson(res, 503, {
      success: false,
      ok: false,
      error: 'PI_API_KEY is not configured on the server.',
    });
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4200);
  try {
    // Immediate single-hop Testnet approval (no DB delay, no pre-lookup RTT)
    const approveRes = await fetch(
      `${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Key ${piKey}` },
        signal: controller.signal,
      }
    );
    const rawText = await approveRes.text();
    let approvedJson: PiPaymentRecord = {};
    try {
      approvedJson = rawText ? (JSON.parse(rawText) as PiPaymentRecord) : {};
    } catch {
      approvedJson = {};
    }

    const elapsedMs = Date.now() - startedAt;

    if (!approveRes.ok) {
      console.error('Approve failed', { paymentId, status: approveRes.status, elapsedMs, body: rawText.slice(0, 300) });
      return sendJson(res, approveRes.status >= 400 && approveRes.status < 500 ? approveRes.status : 502, {
        success: false,
        ok: false,
        error: `Pi Testnet Server Approval failed (${approveRes.status}): ${rawText || 'Unknown error'}`,
      });
    }

    const postCheck = validateU2APayment(approvedJson, paymentId);
    if (!postCheck.valid) {
      console.error('Approve failed', { paymentId, error: postCheck.error });
      return sendJson(res, postCheck.statusCode, { success: false, ok: false, error: postCheck.error });
    }

    console.log('Approve success', { paymentId, amount: approvedJson.amount ?? 0.01, elapsedMs });
    return sendJson(res, 200, {
      success: true,
      ok: true,
      approved: true,
      paymentId,
      amount: approvedJson.amount ?? 0.01,
      status: 'approved',
      environment: 'testnet',
      elapsedMs,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error('Approve failed', { paymentId, elapsedMs, error: err instanceof Error ? err.message : String(err) });
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi Testnet approval request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
