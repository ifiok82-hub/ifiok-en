import type { IncomingMessage, ServerResponse } from 'node:http';

const PI_PLATFORM_ME_URL = 'https://api.minepi.com/v2/me';
const ALLOWED_ORIGINS = new Set([
  'https://ifiok-en.vercel.app',
  'https://ifiokenu4714.pinet.com',
]);

type Req = IncomingMessage & { body?: Record<string, unknown> };
type Res = ServerResponse;

function applyCors(req: Req, res: Res) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.pinet.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://ifiok-en.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, ok: false, error: 'Method Not Allowed' });
  }

  const body = await readJsonBody(req);
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

  if (!accessToken) {
    return sendJson(res, 400, { success: false, ok: false, error: 'Pi accessToken is required.' });
  }

  const piKey = process.env.PI_API_KEY?.trim() || process.env.PI_NETWORK_API_KEY?.trim() || '';
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
    // Verify the Pioneer's accessToken directly with Pi Platform API; never trust frontend username/uid.
    const meRes = await fetch(PI_PLATFORM_ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (!meRes.ok) {
      const errBody = await meRes.text().catch(() => '');
      console.error('Pi auth verification failed', { status: meRes.status });
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: `Pi Network rejected the accessToken (${meRes.status})${errBody ? `: ${errBody.slice(0, 160)}` : '.'}`,
      });
    }

    const meData = (await meRes.json().catch(() => ({}))) as {
      uid?: string;
      username?: string;
    };

    const uid = typeof meData.uid === 'string' ? meData.uid.trim() : '';
    const username = typeof meData.username === 'string' ? meData.username.trim() : '';

    if (!uid || !username) {
      console.error('Pi auth verification failed', { reason: 'Incomplete Pi user identity' });
      return sendJson(res, 401, {
        success: false,
        ok: false,
        error: 'Incomplete Pi user identity returned by Pi Network.',
      });
    }

    return sendJson(res, 200, {
      success: true,
      ok: true,
      username,
      uid,
      piUser: {
        uid,
        username,
      },
    });
  } catch (err) {
    console.error('Pi auth verification error', { error: err instanceof Error ? err.message : String(err) });
    return sendJson(res, 502, {
      success: false,
      ok: false,
      error: `Unable to reach Pi verification service: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
