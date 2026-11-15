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
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim().slice(0, 120) : '';

  if (!accessToken) {
    return sendJson(res, 400, { success: false, ok: false, error: 'Pi accessToken is required.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const meRes = await fetch(`${PI_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!meRes.ok) {
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: 'Pi Platform rejected the accessToken.',
      });
    }
    const piUser = (await meRes.json()) as { uid?: string; username?: string };
    if (!piUser.uid || !piUser.username) {
      return sendJson(res, 401, { success: false, ok: false, error: 'Incomplete Pi user profile.' });
    }

    return sendJson(res, 200, {
      success: true,
      ok: true,
      piUser: {
        uid: piUser.uid,
        username: piUser.username,
        walletAddress: walletAddress || undefined,
      },
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Unable to verify Pi token: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
