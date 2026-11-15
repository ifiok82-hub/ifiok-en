export interface AppStudioPiUser {
  uid?: string;
  username?: string;
  [key: string]: unknown;
}

export function isInAppStudio(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const referrer = typeof document !== 'undefined' ? document.referrer.toLowerCase() : '';
    return (
      window.parent !== window ||
      window.location.search.toLowerCase().includes('appstudio') ||
      referrer.includes('minepi') ||
      referrer.includes('piappengine') ||
      referrer.includes('pinet') ||
      referrer.includes('pi.app')
    );
  } catch {
    return true;
  }
}

export function sendTokenToAppStudio(accessToken: string, user?: AppStudioPiUser | null): void {
  if (typeof window === 'undefined' || !accessToken) return;

  const safeUser = user ? { uid: user.uid, username: user.username } : null;
  const payloads = [
    { type: 'PI_AUTH', accessToken, token: accessToken, user: safeUser, username: safeUser?.username },
    { type: 'pi-auth', accessToken, token: accessToken, user: safeUser },
    { type: 'PI_ACCESS_TOKEN', accessToken, token: accessToken },
    { type: 'APP_STUDIO_AUTH', accessToken, token: accessToken, user: safeUser },
    { type: 'pi_auth_success', accessToken, token: accessToken, user: safeUser },
  ];

  for (const payload of payloads) {
    try {
      window.parent?.postMessage(payload, '*');
    } catch {
      // Cross-origin frame guard
    }
    try {
      if (window.top && window.top !== window.parent) {
        window.top.postMessage(payload, '*');
      } else {
        window.top?.postMessage(payload, '*');
      }
    } catch {
      // Cross-origin top frame guard
    }
  }
}

export function broadcastTokenToAppStudioWithRetries(
  accessToken: string,
  user?: AppStudioPiUser | null
): void {
  if (typeof window === 'undefined' || !accessToken) return;
  sendTokenToAppStudio(accessToken, user);
  window.setTimeout(() => sendTokenToAppStudio(accessToken, user), 500);
  window.setTimeout(() => sendTokenToAppStudio(accessToken, user), 2000);
}

export function listenForAppStudioHandshake(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const readStoredTokenAndUser = (): { accessToken: string | null; user: AppStudioPiUser | null } => {
    try {
      const storedToken = window.localStorage.getItem('pi_access_token');
      const storedUserRaw = window.localStorage.getItem('pi_user');
      if (storedToken) {
        return {
          accessToken: storedToken,
          user: storedUserRaw ? (JSON.parse(storedUserRaw) as AppStudioPiUser) : null,
        };
      }
      const piAuthRaw = window.localStorage.getItem('pi_auth') || window.localStorage.getItem('ifiok_pi_auth');
      if (piAuthRaw) {
        const parsed = JSON.parse(piAuthRaw) as { accessToken?: string; uid?: string; username?: string };
        if (parsed?.accessToken) {
          return {
            accessToken: parsed.accessToken,
            user: { uid: parsed.uid, username: parsed.username },
          };
        }
      }
    } catch {
      // Ignore storage parse failure
    }
    return { accessToken: null, user: null };
  };

  const handleMessage = (event: MessageEvent) => {
    if (!event.data) return;
    const raw = event.data as { type?: unknown; action?: unknown } | string;
    const tag =
      typeof raw === 'string'
        ? raw
        : String(raw.type ?? raw.action ?? '');

    const normalized = tag.toLowerCase();
    if (
      normalized.includes('appstudio') ||
      tag === 'REQUEST_AUTH' ||
      tag === 'GET_TOKEN' ||
      normalized === 'pi_auth_request' ||
      normalized === 'pi-auth-request'
    ) {
      const { accessToken, user } = readStoredTokenAndUser();
      if (accessToken) {
        sendTokenToAppStudio(accessToken, user);
      }
    }
  };

  window.addEventListener('message', handleMessage);

  // If already signed in inside App Studio on page load/refresh, announce session right away
  if (isInAppStudio()) {
    const { accessToken, user } = readStoredTokenAndUser();
    if (accessToken) {
      broadcastTokenToAppStudioWithRetries(accessToken, user);
    }
  }

  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
