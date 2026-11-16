import type { IncomingMessage, ServerResponse } from 'node:http';

const APP_STUDIO_LOGIN_URL =
  'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login';

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
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const appStudioRes = await fetch(APP_STUDIO_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ifiok-en.vercel.app',
        Referer: 'https://ifiok-en.vercel.app/',
      },
      body: JSON.stringify({ accessToken: headerToken }),
      signal: controller.signal,
    });
    if (!appStudioRes.ok) {
      return sendJson(res, 403, { success: false, ok: false, error: 'Access Denied - Admin Only' });
    }
    const data = (await appStudioRes.json().catch(() => ({}))) as {
      username?: string;
      user?: { username?: string };
      data?: { user?: { username?: string } };
    };
    const username = data?.user?.username || data?.data?.user?.username || data?.username || '';
    if (username.replace(/^@/, '').toLowerCase() !== 'ifiok1967') {
      return sendJson(res, 403, { success: false, ok: false, error: 'Access Denied - Admin Only' });
    }

    return sendJson(res, 200, { success: true, ok: true, payments: [] });
  } catch {
    return sendJson(res, 502, { success: false, ok: false, error: 'Unable to verify Admin identity.' });
  } finally {
    clearTimeout(timer);
  }
}
