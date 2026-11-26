import {
  applyPiCors,
  readJsonBody,
  resolveCatalogIntent,
  sendJson,
  type VercelReq,
  type VercelRes,
} from '../../server/lib/vercelPayments.ts';

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
  const result = resolveCatalogIntent(body);
  if (result.ok === false) {
    return sendJson(res, result.statusCode, { success: false, ok: false, error: result.error });
  }

  if (result.freeEnrolled) {
    return sendJson(res, 200, {
      success: true,
      ok: true,
      freeEnrolled: true,
      unlocked: true,
      orderId: result.orderId,
      orderType: result.orderType,
      referenceId: result.referenceId,
      unlockToken: result.unlockToken || undefined,
      message: result.message || 'Enrolled in free course.',
    });
  }

  return sendJson(res, 201, {
    success: true,
    ok: true,
    orderId: result.orderId,
    orderType: result.orderType,
    referenceId: result.referenceId,
    quantity: result.quantity,
    planSlug: result.planSlug,
    amountPi: result.amountPi,
    subtotalPi: result.subtotalPi,
    platformFeePi: result.platformFeePi,
    memo: result.memo,
    environment: 'testnet',
    lockedUntilVerified: true,
  });
}
