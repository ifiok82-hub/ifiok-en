import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_TESTNET_API_BASE = 'https://api.testnet.minepi.com/v2';

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
  const txid = typeof body.txid === 'string' ? body.txid.trim() : '';

  if (!paymentId || !txid) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId and txid are required.' });
  }

  console.log('Complete called', { paymentId, txid });

  const piKey = getPiApiKey();
  if (!piKey || piKey.length <= 10) {
    console.error('Complete failed', { paymentId, error: 'PI_API_KEY missing' });
    return sendJson(res, 503, {
      success: false,
      ok: false,
      error: 'PI_API_KEY is not configured on the server.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // Call Pi Testnet API /complete directly with txid
    const completeRes = await fetch(
      `${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${piKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txid }),
        signal: controller.signal,
      }
    );

    const rawText = await completeRes.text();
    let completedJson: PiPaymentRecord = {};
    try {
      completedJson = rawText ? (JSON.parse(rawText) as PiPaymentRecord) : {};
    } catch {
      completedJson = {};
    }

    if (!completeRes.ok) {
      // Check if payment was already completed idempotently
      const inspectRes = await fetch(
        `${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: { Authorization: `Key ${piKey}` },
          signal: controller.signal,
        }
      ).catch(() => null);
      if (inspectRes && inspectRes.ok) {
        const inspected = (await inspectRes.json().catch(() => ({}))) as PiPaymentRecord;
        const alreadyVerified = Boolean(
          inspected.status?.developer_completed &&
            (inspected.status?.transaction_verified || inspected.transaction?.verified)
        );
        if (alreadyVerified && (!inspected.transaction?.txid || inspected.transaction.txid === txid)) {
          const check = validateU2APayment(inspected, paymentId);
          if (!check.valid) {
            return sendJson(res, check.statusCode, { success: false, ok: false, error: check.error });
          }
          console.log('Complete success (idempotent)', { paymentId, txid, amount: inspected.amount });
          return sendJson(res, 200, {
            success: true,
            ok: true,
            completed: true,
            alreadyCompleted: true,
            paymentId,
            txid,
            amount: inspected.amount ?? 0.01,
            status: 'completed',
            environment: 'testnet',
          });
        }
      }

      console.error('Complete failed', { paymentId, status: completeRes.status, body: rawText.slice(0, 300) });
      return sendJson(res, 502, {
        success: false,
        ok: false,
        error: `Pi Testnet Server Completion failed (${completeRes.status}): ${rawText}`,
      });
    }

    const postCheck = validateU2APayment(completedJson, paymentId);
    if (!postCheck.valid) {
      console.error('Complete failed', { paymentId, error: postCheck.error });
      return sendJson(res, postCheck.statusCode, { success: false, ok: false, error: postCheck.error });
    }

    if (completedJson.transaction?.txid && completedJson.transaction.txid !== txid) {
      return sendJson(res, 409, {
        success: false,
        ok: false,
        error: 'Submitted txid does not match Pi Testnet transaction.',
      });
    }

    const verified = Boolean(completedJson.status?.transaction_verified || completedJson.transaction?.verified);
    if (!completedJson.status?.developer_completed || !verified) {
      console.error('Complete failed', { paymentId, error: 'Transaction not verified on Testnet' });
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: 'Pi Platform did not verify Testnet completion.',
      });
    }

    console.log('Complete success', { paymentId, txid, amount: completedJson.amount ?? 0.01 });
    return sendJson(res, 200, {
      success: true,
      ok: true,
      completed: true,
      paymentId,
      txid,
      amount: completedJson.amount ?? 0.01,
      status: 'completed',
      environment: 'testnet',
    });
  } catch (err) {
    console.error('Complete failed', { paymentId, error: err instanceof Error ? err.message : String(err) });
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi Testnet completion request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
