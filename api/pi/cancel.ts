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

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  if (!paymentId) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId is required.' });
  }

  console.log('Cancel called', { paymentId });

  const piKey = process.env.PI_API_KEY?.trim() || process.env.PI_NETWORK_API_KEY?.trim();
  if (piKey && piKey.length > 10) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const cancelRes = await fetch(
        `${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Key ${piKey}` },
          signal: controller.signal,
        }
      );
      console.log('Cancel response', { paymentId, status: cancelRes.status });
    } catch (err) {
      console.error('Cancel failed', { paymentId, error: err instanceof Error ? err.message : String(err) });
    } finally {
      clearTimeout(timer);
    }
  }

  return sendJson(res, 200, { success: true, ok: true, cancelled: true, paymentId, environment: 'testnet' });
}
