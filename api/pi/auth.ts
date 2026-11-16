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
  const appStudioSession =
    typeof body.appStudioSession === 'string' && body.appStudioSession.trim()
      ? body.appStudioSession.trim()
      : 'piappstudio-RsKPKVTM5NR6Lji7gF8t3PUN29yGIUqI';

  if (!accessToken) {
    return sendJson(res, 400, { success: false, ok: false, error: 'Pi accessToken is required.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    // Exchange accessToken with App Studio; ignore any browser-supplied uid/username
    const appStudioRes = await fetch(APP_STUDIO_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
      signal: controller.signal,
    });

    if (!appStudioRes.ok) {
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: 'App Studio rejected the Pi accessToken.',
      });
    }

    const data = (await appStudioRes.json()) as {
      sessionToken?: string;
      user?: { uid?: string; username?: string };
    };
    if (!data?.user?.uid || !data?.user?.username) {
      return sendJson(res, 401, { success: false, ok: false, error: 'Incomplete App Studio user identity.' });
    }

    console.log(
      `[PI APPSTUDIO AUTH] verified @${data.user.username} (${data.user.uid}) session=${appStudioSession}`
    );

    return sendJson(res, 200, {
      success: true,
      ok: true,
      username: data.user.username,
      uid: data.user.uid,
      appStudioSession,
      sessionToken: data.sessionToken || '',
      piUser: {
        uid: data.user.uid,
        username: data.user.username,
      },
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Unable to reach App Studio auth server: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
