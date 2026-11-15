import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_API_BASE = 'https://api.minepi.com/v2';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const headerToken =
    typeof req.headers['x-pi-access-token'] === 'string' ? req.headers['x-pi-access-token'].trim() : '';
  if (!headerToken) {
    return sendJson(res, 403, { success: false, ok: false, error: 'Access Denied - Admin Only' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const meRes = await fetch(`${PI_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${headerToken}` },
      signal: controller.signal,
    });
    if (!meRes.ok) {
      return sendJson(res, 403, { success: false, ok: false, error: 'Access Denied - Admin Only' });
    }
    const piUser = (await meRes.json()) as { username?: string };
    if ((piUser.username || '').replace(/^@/, '').toLowerCase() !== 'ifiok1967') {
      return sendJson(res, 403, { success: false, ok: false, error: 'Access Denied - Admin Only' });
    }

    return sendJson(res, 200, { success: true, ok: true, payments: [] });
  } catch {
    return sendJson(res, 502, { success: false, ok: false, error: 'Unable to verify Admin identity.' });
  } finally {
    clearTimeout(timer);
  }
}
