import { SEED_COURSES, SEED_MARKET_LISTINGS } from '../../../../../src/lib/seed.ts';
import {
  applyPiCors,
  sendJson,
  signUnlockToken,
  verifyUnlockToken,
  type VercelReq,
  type VercelRes,
} from '../../../../../server/lib/vercelPayments.ts';

function getPathParam(req: VercelReq, key: string, fallbackIdxFromEnd: number): string {
  const fromQ = req.query?.[key];
  if (typeof fromQ === 'string') return fromQ;
  if (Array.isArray(fromQ) && typeof fromQ[0] === 'string') return fromQ[0];
  const parts = (req.url || '/').split('?')[0].split('/').filter(Boolean);
  return parts[parts.length - fallbackIdxFromEnd] || '';
}

export default function handler(req: VercelReq, res: VercelRes) {
  applyPiCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  // URL: /api/payments/entitlements/:itemType/:itemId/download-token
  const itemType = getPathParam(req, 'itemType', 3);
  const itemId = Number(getPathParam(req, 'itemId', 2));
  if (!['product', 'course'].includes(itemType) || !itemId) {
    return sendJson(res, 400, { error: 'Invalid download token request.' });
  }

  const rawToken =
    typeof req.headers['x-ifiok-unlock-token'] === 'string'
      ? req.headers['x-ifiok-unlock-token'].trim()
      : '';
  const verified = rawToken ? verifyUnlockToken(rawToken) : null;
  const hasValidUnlock = Boolean(verified && verified.itemType === itemType && verified.itemId === itemId);

  let fileName = 'ifiok-digital-asset.pdf';
  if (itemType === 'product') {
    const prod = SEED_MARKET_LISTINGS.find((p) => p.id === itemId);
    if (!prod) return sendJson(res, 404, { error: 'Product not found.' });
    if (!hasValidUnlock) {
      return sendJson(res, 402, { error: 'Download locked: Pi Network payment verification required.' });
    }
    fileName = `${prod.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}_v${prod.version || '1.0.0'}.pdf`;
  } else {
    const course = SEED_COURSES.find((c) => c.id === itemId);
    if (!course) return sendJson(res, 404, { error: 'Course not found.' });
    const isFree = Number(course.price_pi) === 0;
    if (!hasValidUnlock && !isFree) {
      return sendJson(res, 402, { error: 'Download locked: complete Pi payment or enrolment first.' });
    }
    fileName = `${course.slug || `ifiok-course-${course.id}`}.pdf`;
  }

  const dlToken = signUnlockToken(
    {
      itemType: itemType as 'course' | 'product',
      itemId,
      paymentId: verified?.paymentId || `free-${itemType}-${itemId}`,
      txid: verified?.txid || 'verified',
    },
    300
  );
  if (!dlToken) {
    return sendJson(res, 503, { error: 'Server download signing key not configured.' });
  }

  return sendJson(res, 200, {
    token: dlToken,
    downloadUrl: `/api/payments/download/${encodeURIComponent(dlToken)}`,
    expiresInSeconds: 300,
    fileName,
    fileFormat: 'PDF',
  });
}
