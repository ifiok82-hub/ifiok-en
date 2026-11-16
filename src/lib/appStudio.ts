export const SESSION = 'piappstudio-RsKPKVTM5NR6Lji7gF8t3PUN29yGIUqI';
export const APP_STUDIO_SESSION = SESSION;
const APP_STUDIO_STORAGE_KEY = 'piappstudio_session';

export interface AppStudioPiUser {
  uid?: string;
  username?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    __PI_ACCESS_TOKEN?: string;
    __PI_USER?: AppStudioPiUser | null;
    piAccessToken?: string;
  }
}

export function isAppStudioEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const href = (window.location.href || '').toLowerCase();
    const ref = (typeof document !== 'undefined' ? document.referrer || '' : '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    let inIframe = false;
    try {
      inIframe = window.parent !== window;
    } catch {
      inIframe = true;
    }
    return (
      href.includes('appstudio') ||
      inIframe ||
      ref.includes('pi') ||
      params.has('appStudioSession') ||
      params.has('piappstudio')
    );
  } catch {
    return false;
  }
}

export function clearCachedPiStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('pi_user');
    window.localStorage.removeItem('pi_access_token');
    window.localStorage.removeItem('pi_auth');
    window.localStorage.removeItem('ifiok_pi_auth');
    delete window.__PI_ACCESS_TOKEN;
    delete window.__PI_USER;
    delete window.piAccessToken;
  } catch {
    // Ignore storage restriction
  }
}

function extractSessionFromWindowName(): string | null {
  if (typeof window === 'undefined' || !window.name) return null;
  const raw = window.name.trim();
  if (!raw) return null;
  if (raw.startsWith('piappstudio-')) {
    return raw;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate =
      (typeof parsed.piappstudio === 'string' && parsed.piappstudio) ||
      (typeof parsed.session === 'string' && parsed.session) ||
      (typeof parsed.sessionId === 'string' && parsed.sessionId) ||
      '';
    return candidate.trim() || null;
  } catch {
    const match = raw.match(/piappstudio-[A-Za-z0-9_-]+/);
    return match ? match[0] : null;
  }
}

export function getAppStudioSession(): string {
  if (typeof window === 'undefined') return SESSION;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (
      params.get('piappstudio') ||
      params.get('appStudioSession') ||
      params.get('session') ||
      ''
    ).trim();
    const fromName = extractSessionFromWindowName();
    const detected = fromUrl || fromName;
    if (detected) {
      window.localStorage.setItem(APP_STUDIO_STORAGE_KEY, detected);
      return detected;
    }
    const stored = window.localStorage.getItem(APP_STUDIO_STORAGE_KEY)?.trim();
    if (stored) return stored;
  } catch {
    // Fallback cleanly if storage is restricted
  }
  return SESSION;
}

export function sendTokenToAppStudioNow(): boolean {
  if (typeof window === 'undefined') return false;
  let token = '';
  try {
    token = window.localStorage.getItem('pi_access_token') || window.__PI_ACCESS_TOKEN || '';
  } catch {
    token = window.__PI_ACCESS_TOKEN || '';
  }
  let user: AppStudioPiUser = {};
  try {
    const userStr = window.localStorage.getItem('pi_user') || '{}';
    user = (JSON.parse(userStr) as AppStudioPiUser) || window.__PI_USER || {};
  } catch {
    user = window.__PI_USER || {};
  }
  if (!token) return false;

  const activeSession = getAppStudioSession();
  const base = {
    sessionId: activeSession,
    session: activeSession,
    appStudioSession: activeSession,
    appStudioSessionId: activeSession,
    piappstudio: activeSession,
    accessToken: token,
    token,
    authToken: token,
    piAccessToken: token,
    username: user?.username,
    uid: user?.uid,
    user,
    app: 'ifiok-en',
    timestamp: Date.now(),
  };

  const payloads = [
    { type: 'piappstudio-auth', ...base },
    { type: 'PI_AUTH', ...base },
    { type: 'pi-auth', ...base },
    { type: 'pi_auth', ...base },
    { type: 'APP_STUDIO_AUTH', ...base },
    { type: 'app-studio-auth', ...base },
    { type: 'PI_ACCESS_TOKEN', ...base },
    { type: 'pi_access_token', ...base },
    { type: 'auth', ...base },
    { type: 'authenticated', ...base },
    { type: 'PI_AUTH_SUCCESS', ...base },
    { type: 'pi-auth-success', ...base },
    { action: 'piappstudio-auth', ...base },
    { event: 'piappstudio-auth', ...base },
  ];

  for (const p of payloads) {
    try {
      window.parent.postMessage(p, '*');
    } catch {
      // Ignore postMessage error
    }
    try {
      window.parent.postMessage(JSON.stringify(p), '*');
    } catch {
      // Ignore postMessage error
    }
    try {
      window.top?.postMessage(p, '*');
    } catch {
      // Ignore postMessage error
    }
    try {
      window.top?.postMessage(JSON.stringify(p), '*');
    } catch {
      // Ignore postMessage error
    }
    try {
      window.postMessage(p, '*');
    } catch {
      // Ignore postMessage error
    }
  }

  window.__PI_ACCESS_TOKEN = token;
  window.__PI_USER = user;
  window.piAccessToken = token;
  return true;
}

export function sendTokenToAppStudio(accessToken: string, user?: AppStudioPiUser | null): void {
  if (typeof window === 'undefined' || !accessToken) return;
  try {
    window.localStorage.setItem('pi_access_token', accessToken);
    if (user) {
      window.localStorage.setItem('pi_user', JSON.stringify(user));
    }
  } catch {
    // Ignore storage error
  }
  window.__PI_ACCESS_TOKEN = accessToken;
  if (user) window.__PI_USER = user;
  window.piAccessToken = accessToken;
  sendTokenToAppStudioNow();
}

export function broadcastTokenToAppStudio(accessToken: string, user?: AppStudioPiUser | null): void {
  if (typeof window === 'undefined' || !accessToken) return;
  sendTokenToAppStudio(accessToken, user);
  startAppStudioHeartbeat();
  for (let i = 1; i <= 10; i++) {
    window.setTimeout(() => {
      sendTokenToAppStudioNow();
    }, i * 1000);
  }
}

let heartbeatStarted = false;

export function startAppStudioHeartbeat(): void {
  if (typeof window === 'undefined' || heartbeatStarted) return;
  heartbeatStarted = true;

  getAppStudioSession();
  sendTokenToAppStudioNow();

  // Every 1 second for 2 minutes, then transition to every 3 seconds continuously
  let fastTicks = 0;
  const fastInterval = window.setInterval(() => {
    fastTicks += 1;
    sendTokenToAppStudioNow();
    if (fastTicks >= 120) {
      window.clearInterval(fastInterval);
      window.setInterval(() => {
        sendTokenToAppStudioNow();
      }, 3000);
    }
  }, 1000);

  window.addEventListener('message', (e: MessageEvent) => {
    let parsed: unknown = e.data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Keep raw string
      }
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const incomingSession =
        (typeof obj.piappstudio === 'string' && obj.piappstudio) ||
        (typeof obj.appStudioSession === 'string' && obj.appStudioSession) ||
        (typeof obj.session === 'string' && obj.session) ||
        (typeof obj.sessionId === 'string' && obj.sessionId) ||
        '';
      if (incomingSession.trim()) {
        try {
          window.localStorage.setItem(APP_STUDIO_STORAGE_KEY, incomingSession.trim());
        } catch {
          // Ignore storage error
        }
      }
    }

    const raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || {});
    const low = raw.toLowerCase();
    if (
      low.includes('appstudio') ||
      low.includes('token') ||
      low.includes('auth') ||
      low.includes('verify') ||
      low.includes('request')
    ) {
      sendTokenToAppStudioNow();
      window.setTimeout(sendTokenToAppStudioNow, 200);
      window.setTimeout(sendTokenToAppStudioNow, 1000);
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => sendTokenToAppStudioNow());
  }
  window.addEventListener('focus', () => sendTokenToAppStudioNow());
}

let bridgeCacheCleared = false;

export function initAppStudioBridge(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  getAppStudioSession();
  if (isAppStudioEnvironment() && !bridgeCacheCleared) {
    bridgeCacheCleared = true;
    clearCachedPiStorage();
  }
  startAppStudioHeartbeat();
  return () => undefined;
}
