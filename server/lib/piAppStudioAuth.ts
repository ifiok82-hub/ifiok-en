export const APP_STUDIO_LOGIN_URL =
  'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login';

export interface AppStudioAuthResult {
  sessionToken: string;
  user: {
    uid: string;
    username: string;
  };
}

export class AppStudioAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AppStudioAuthError';
    this.statusCode = statusCode;
  }
}

export async function exchangePiTokenWithAppStudio(
  accessToken: string,
  timeoutMs = 9000
): Promise<AppStudioAuthResult> {
  const cleaned = accessToken.trim();
  if (!cleaned) {
    throw new AppStudioAuthError('Pi accessToken is required.', 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(APP_STUDIO_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ifiok-en.vercel.app',
        Referer: 'https://ifiok-en.vercel.app/',
      },
      body: JSON.stringify({ accessToken: cleaned }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new AppStudioAuthError(
        `App Studio authentication failed (${res.status}): ${errText || 'Unauthorized'}`,
        res.status >= 500 ? 502 : 401
      );
    }

    const payload = (await res.json().catch(() => ({}))) as {
      sessionToken?: string;
      token?: string;
      uid?: string;
      username?: string;
      user?: { uid?: string; username?: string };
      data?: { sessionToken?: string; user?: { uid?: string; username?: string } };
    };

    let uid = payload?.user?.uid || payload?.data?.user?.uid || payload?.uid || '';
    let username = payload?.user?.username || payload?.data?.user?.username || payload?.username || '';
    const sessionToken = payload?.sessionToken || payload?.data?.sessionToken || payload?.token || '';

    if (!uid || !username) {
      const meRes = await fetch('https://api.minepi.com/v2/me', {
        headers: { Authorization: `Bearer ${cleaned}` },
        signal: controller.signal,
      }).catch(() => null);
      if (meRes && meRes.ok) {
        const meData = (await meRes.json().catch(() => ({}))) as { uid?: string; username?: string };
        uid = uid || meData.uid || '';
        username = username || meData.username || '';
      }
    }

    if (!uid || !username) {
      throw new AppStudioAuthError('App Studio returned an incomplete user identity.', 401);
    }

    return {
      sessionToken,
      user: {
        uid,
        username,
      },
    };
  } catch (err) {
    if (err instanceof AppStudioAuthError) throw err;
    throw new AppStudioAuthError(
      `Unable to reach App Studio auth service: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }
}
