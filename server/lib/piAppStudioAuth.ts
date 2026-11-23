const PI_PLATFORM_ME_URL = 'https://api.minepi.com/v2/me';

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
  timeoutMs = 8000
): Promise<AppStudioAuthResult> {
  const cleaned = accessToken.trim();
  if (!cleaned) {
    throw new AppStudioAuthError('Pi accessToken is required.', 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(PI_PLATFORM_ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleaned}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Pi auth verification failed', { status: res.status });
      throw new AppStudioAuthError(
        `Pi authentication failed (${res.status}): ${errText || 'Unauthorized'}`,
        res.status >= 500 ? 502 : 401
      );
    }

    const payload = (await res.json().catch(() => ({}))) as {
      uid?: string;
      username?: string;
    };

    const uid = typeof payload?.uid === 'string' ? payload.uid.trim() : '';
    const username = typeof payload?.username === 'string' ? payload.username.trim() : '';

    if (!uid || !username) {
      console.error('Pi auth verification failed', { reason: 'Incomplete Pi user identity' });
      throw new AppStudioAuthError('Pi Network returned an incomplete user identity.', 401);
    }

    return {
      sessionToken: '',
      user: {
        uid,
        username,
      },
    };
  } catch (err) {
    if (err instanceof AppStudioAuthError) throw err;
    console.error('Pi auth verification error', { error: err instanceof Error ? err.message : String(err) });
    throw new AppStudioAuthError(
      `Unable to reach Pi verification service: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }
}
