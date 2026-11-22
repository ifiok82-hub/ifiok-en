import type { IncomingMessage, ServerResponse } from 'node:http';

const APP_STUDIO_LOGIN_URL =
  'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login';

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

  if (!accessToken) {
    return sendJson(res, 400, { success: false, ok: false, error: 'Pi accessToken is required.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    // Send ONLY { accessToken } to IFIOK-EN App Studio backend; trust ONLY App Studio uid/username.
    console.log('AppStudio auth sent');
    const appStudioRes = await fetch(APP_STUDIO_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ifiok-en.vercel.app',
        Referer: 'https://ifiok-en.vercel.app/',
      },
      body: JSON.stringify({ accessToken }),
      signal: controller.signal,
    });

    if (!appStudioRes.ok) {
      const errBody = await appStudioRes.text().catch(() => '');
      console.error('AppStudio auth failed', { status: appStudioRes.status });
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: `App Studio rejected the Pi accessToken (${appStudioRes.status})${errBody ? `: ${errBody.slice(0, 160)}` : '.'}`,
      });
    }

    const data = (await appStudioRes.json().catch(() => ({}))) as {
      sessionToken?: string;
      token?: string;
      uid?: string;
      username?: string;
      user?: { uid?: string; username?: string };
      data?: { sessionToken?: string; uid?: string; username?: string; user?: { uid?: string; username?: string } };
    };

    const uid = data?.user?.uid || data?.data?.user?.uid || data?.data?.uid || data?.uid || '';
    const username =
      data?.user?.username || data?.data?.user?.username || data?.data?.username || data?.username || '';
    const sessionToken = data?.sessionToken || data?.data?.sessionToken || data?.token || '';

    if (!uid || !username) {
      console.error('AppStudio auth failed', { reason: 'Incomplete App Studio user identity' });
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: 'Incomplete App Studio user identity.',
      });
    }

    return sendJson(res, 200, {
      success: true,
      ok: true,
      username,
      uid,
      sessionToken,
      piUser: {
        uid,
        username,
      },
    });
  } catch (err) {
    console.error('AppStudio auth failed', { error: err instanceof Error ? err.message : String(err) });
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Unable to reach App Studio auth server: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
