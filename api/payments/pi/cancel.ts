import {
  applyPiCors,
  getPiApiKey,
  PI_TESTNET_API_BASE,
  readJsonBody,
  sendJson,
  type VercelReq,
  type VercelRes,
} from '../../../server/lib/vercelPayments.ts';

export default async function handler(req: VercelReq, res: VercelRes) {
  applyPiCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';

  const piKey = getPiApiKey();
  if (paymentId && piKey && piKey.length > 10) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      await fetch(`${PI_TESTNET_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Key ${piKey}` },
        signal: controller.signal,
      }).catch(() => undefined);
    } finally {
      clearTimeout(timer);
    }
  }

  return sendJson(res, 200, {
    success: true,
    ok: true,
    cancelled: true,
    paymentId: paymentId || undefined,
    environment: 'testnet',
  });
}
