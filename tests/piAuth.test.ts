import assert from 'node:assert/strict';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { db, initDatabase } from '../server/db.ts';
import { csrfOriginGuard } from '../server/middleware/auth.ts';
import { APP_STUDIO_LOGIN_URL } from '../server/lib/piAppStudioAuth.ts';
import authRoutes from '../server/routes/auth.ts';
import piTestnetRoutes from '../server/routes/piTestnet.ts';

initDatabase();

function createTestServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrfOriginGuard);
  app.use('/api/auth', authRoutes);
  app.use('/api/pi', piTestnetRoutes);
  return app;
}

test('POST /api/pi/auth ignores browser-supplied uid/username and stores only App Studio identity', async () => {
  const app = createTestServer();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const originalFetch = globalThis.fetch;
  let capturedAppStudioBody: Record<string, unknown> | null = null;
  let appStudioCallCount = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === APP_STUDIO_LOGIN_URL) {
      appStudioCallCount += 1;
      capturedAppStudioBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          sessionToken: 'appstudio-session-xyz',
          user: {
            uid: 'test-verified-appstudio-uid-001',
            username: 'VerifiedAppStudioUser',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const res = await originalFetch(`${baseUrl}/api/pi/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({
        accessToken: 'real-looking-pi-access-token',
        uid: 'spoofed-browser-uid',
        username: 'Ifiok1967',
      }),
    });

    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      success: boolean;
      username: string;
      uid: string;
      piUser: { uid: string; username: string };
      user: { pi_uid: string; pi_username: string };
    };

    assert.equal(appStudioCallCount, 1);
    assert.deepEqual(capturedAppStudioBody, { accessToken: 'real-looking-pi-access-token' });
    assert.equal(json.success, true);
    assert.equal(json.uid, 'test-verified-appstudio-uid-001');
    assert.equal(json.username, 'VerifiedAppStudioUser');
    assert.equal(json.piUser.uid, 'test-verified-appstudio-uid-001');
    assert.equal(json.piUser.username, 'VerifiedAppStudioUser');
    assert.equal(json.user.pi_uid, 'test-verified-appstudio-uid-001');
    assert.equal(json.user.pi_username, 'VerifiedAppStudioUser');

    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=None/i);
    assert.match(setCookie, /Secure/i);

    const dbRow = db
      .prepare(`SELECT pi_uid, pi_username FROM users WHERE pi_uid = ?`)
      .get('test-verified-appstudio-uid-001') as { pi_uid: string; pi_username: string } | undefined;
    assert.ok(dbRow);
    assert.equal(dbRow.pi_username, 'VerifiedAppStudioUser');

    const spoofRow = db.prepare(`SELECT id FROM users WHERE pi_uid = ?`).get('spoofed-browser-uid');
    assert.equal(spoofRow, undefined);

    const logoutRes = await originalFetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https' },
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    assert.match(logoutCookie, /SameSite=None/i);
    assert.match(logoutCookie, /Secure/i);
  } finally {
    globalThis.fetch = originalFetch;
    const row = db
      .prepare(`SELECT id FROM users WHERE pi_uid = ?`)
      .get('test-verified-appstudio-uid-001') as { id: number } | undefined;
    if (row) {
      db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(row.id);
      db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(row.id);
      db.prepare(`DELETE FROM audit_logs WHERE actor_user_id = ?`).run(row.id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(row.id);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('POST /api/auth/pi rejects invalid App Studio token and never trusts body identity', async () => {
  const app = createTestServer();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === APP_STUDIO_LOGIN_URL) {
      return new Response(JSON.stringify({ error: 'Invalid access token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const res = await originalFetch(`${baseUrl}/api/auth/pi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'forged-token',
        uid: 'test-spoofed-uid-999',
        username: 'Ifiok1967',
      }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
    const spoofRow = db.prepare(`SELECT id FROM users WHERE pi_uid = ?`).get('test-spoofed-uid-999');
    assert.equal(spoofRow, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
