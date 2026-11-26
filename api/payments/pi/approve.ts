import {
  applyPiCors,
  getPiApiKey,
  PI_TESTNET_API_BASE,
  readJsonBody,
  sendJson,
  validateU2ATestnetPayment,
  type PiPaymentRecord,
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
  const orderId = Number(body.orderId || 0) || undefined;
  const expectedAmountPi =
    typeof body.expectedAmountPi === 'number' && body.expectedAmountPi > 0
      ? body.expectedAmountPi
      : undefined;

  if (!paymentId) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId is required for server approval.' });
  }

  const piKey = getPiApiKey();
  if (!piKey || piKey.length <= 10) {
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
    // Immediate single-hop Testnet approval (< 5s SLA)
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
      return sendJson(
        res,
        approveRes.status >= 400 && approveRes.status < 500 ? approveRes.status : 502,
        {
          success: false,
          ok: false,
          error: `Pi Testnet Server Approval failed (${approveRes.status}): ${rawText || 'Unknown error'}`,
        }
      );
    }

    const postCheck = validateU2ATestnetPayment(approvedJson, paymentId, expectedAmountPi);
    if (postCheck.valid === false) {
      return sendJson(res, postCheck.statusCode, {
        success: false,
        ok: false,
        error: postCheck.error,
      });
    }

    return sendJson(res, 200, {
      success: true,
      ok: true,
      approved: true,
      paymentId,
      orderId,
      amount: approvedJson.amount,
      status: 'approved',
      environment: 'testnet',
      elapsedMs,
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi Testnet approval request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
