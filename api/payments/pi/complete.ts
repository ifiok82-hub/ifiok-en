import {
  applyPiCors,
  getPiApiKey,
  PI_TESTNET_API_BASE,
  readJsonBody,
  sendJson,
  signUnlockToken,
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
  const txid = typeof body.txid === 'string' ? body.txid.trim() : '';
  const orderId = Number(body.orderId || 0);
  const orderTypeRaw = typeof body.orderType === 'string' ? body.orderType.trim() : '';
  const referenceId = Number(body.referenceId || 0);
  const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : '';

  if (!paymentId || !txid) {
    return sendJson(res, 400, { success: false, ok: false, error: 'paymentId and txid are required.' });
  }

  const piKey = getPiApiKey();
  if (!piKey || piKey.length <= 10) {
    return sendJson(res, 503, {
      success: false,
      ok: false,
      error: 'PI_API_KEY is not configured on the server.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
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
          const check = validateU2ATestnetPayment(inspected, paymentId);
          if (check.valid === false) {
            return sendJson(res, check.statusCode, { success: false, ok: false, error: check.error });
          }
          const resolvedType = (orderTypeRaw || inspected.metadata?.orderType || '') as
            | 'course'
            | 'product'
            | 'service'
            | 'subscription';
          const resolvedRefId = referenceId || Number(inspected.metadata?.referenceId || 0);
          const unlockToken =
            resolvedType && ['course', 'product', 'service', 'subscription'].includes(resolvedType)
              ? signUnlockToken({
                  itemType: resolvedType,
                  itemId: resolvedRefId,
                  planSlug: planSlug || (typeof inspected.metadata?.planSlug === 'string' ? inspected.metadata.planSlug : undefined),
                  paymentId,
                  txid,
                })
              : null;

          return sendJson(res, 200, {
            success: true,
            ok: true,
            completed: true,
            unlocked: true,
            alreadyCompleted: true,
            paymentId,
            txid,
            orderId: orderId || Number(inspected.metadata?.orderId || 0),
            amount: inspected.amount,
            unlockToken,
            status: 'completed',
            environment: 'testnet',
          });
        }
      }

      return sendJson(res, 502, {
        success: false,
        ok: false,
        error: `Pi Testnet Server Completion failed (${completeRes.status}): ${rawText}`,
      });
    }

    const postCheck = validateU2ATestnetPayment(completedJson, paymentId);
    if (postCheck.valid === false) {
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
      return sendJson(res, 400, {
        success: false,
        ok: false,
        error: 'Pi Platform did not verify Testnet completion.',
      });
    }

    const resolvedType = (orderTypeRaw || completedJson.metadata?.orderType || '') as
      | 'course'
      | 'product'
      | 'service'
      | 'subscription';
    const resolvedRefId = referenceId || Number(completedJson.metadata?.referenceId || 0);
    const unlockToken =
      resolvedType && ['course', 'product', 'service', 'subscription'].includes(resolvedType)
        ? signUnlockToken({
            itemType: resolvedType,
            itemId: resolvedRefId,
            planSlug: planSlug || (typeof completedJson.metadata?.planSlug === 'string' ? completedJson.metadata.planSlug : undefined),
            paymentId,
            txid,
          })
        : null;

    return sendJson(res, 200, {
      success: true,
      ok: true,
      completed: true,
      unlocked: true,
      paymentId,
      txid,
      orderId: orderId || Number(completedJson.metadata?.orderId || 0),
      amount: completedJson.amount,
      unlockToken,
      status: 'completed',
      environment: 'testnet',
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Pi Testnet completion request error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
