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

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 80) : '';

  if (!paymentId) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId is required.' });
  }

  const piKey = process.env.PI_API_KEY?.trim();
  if (!piKey || piKey.length <= 10) {
    return sendJson(res, 503, {
      success: false,
      ok: false,
      error: 'PI_API_KEY is not configured in Vercel Environment Variables.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const approveRes = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
      signal: controller.signal,
    });
    const rawText = await approveRes.text();
    let approvedJson: { amount?: number; network?: string; metadata?: { app?: string } } = {};
    try {
      approvedJson = rawText ? JSON.parse(rawText) : {};
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

    if (approvedJson.network && !approvedJson.network.toLowerCase().includes('testnet')) {
      return sendJson(res, 403, {
        success: false,
        ok: false,
        error: `Only Pi Testnet payments are permitted (received ${approvedJson.network}).`,
      });
    }
    if (typeof approvedJson.amount === 'number' && Math.abs(approvedJson.amount - TESTNET_AMOUNT_PI) > 0.00001) {
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: `Expected ${TESTNET_AMOUNT_PI} Pi, received ${approvedJson.amount}.`,
      });
    }

    console.log(`[VERCEL PI APPROVE OK] paymentId=${paymentId} username=${username || 'pi-user'}`);
    return sendJson(res, 200, {
      success: true,
      ok: true,
      approved: true,
      paymentId,
      amount: TESTNET_AMOUNT_PI,
      username,
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
