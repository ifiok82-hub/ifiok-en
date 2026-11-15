import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_API_BASE = 'https://api.minepi.com/v2';

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
  const attemptServerCancel = Boolean(body.attemptServerCancel);
  if (!paymentId) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId is required.' });
  }

  const piKey = process.env.PI_API_KEY?.trim();
  if (attemptServerCancel && piKey && piKey.length > 10) {
    await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Key ${piKey}` },
    }).catch(() => undefined);
  }

  return sendJson(res, 200, { success: true, ok: true, cancelled: true, paymentId });
}
