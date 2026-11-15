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

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  const txid = typeof body.txid === 'string' ? body.txid.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 80) : '';

  if (!paymentId || !txid) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId and txid are required.' });
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
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
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
    let completedJson: {
      amount?: number;
      network?: string;
      metadata?: { app?: string };
      status?: { developer_completed?: boolean; transaction_verified?: boolean };
      transaction?: { verified?: boolean };
    } = {};
    try {
      completedJson = rawText ? JSON.parse(rawText) : {};
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

    if (completedJson.network && !completedJson.network.toLowerCase().includes('testnet')) {
      return sendJson(res, 403, {
        success: false,
        ok: false,
        error: `Only Pi Testnet payments are permitted (received ${completedJson.network}).`,
      });
    }
    if (typeof completedJson.amount !== 'number' || Math.abs(completedJson.amount - TESTNET_AMOUNT_PI) > 0.00001) {
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: `Expected ${TESTNET_AMOUNT_PI} Pi, received ${completedJson.amount ?? 'unknown'}.`,
      });
    }
    const verified = Boolean(completedJson.status?.transaction_verified || completedJson.transaction?.verified);
    if (!completedJson.status?.developer_completed || !verified) {
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: 'Pi Platform did not verify Testnet completion.',
      });
    }

    console.log(`[VERCEL PI COMPLETE OK] paymentId=${paymentId} txid=${txid} username=${username || 'pi-user'}`);
    return sendJson(res, 200, {
      success: true,
      ok: true,
      completed: true,
      paymentId,
      txid,
      amount: TESTNET_AMOUNT_PI,
      username,
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
