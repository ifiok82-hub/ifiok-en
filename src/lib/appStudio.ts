export const SESSION = 'piappstudio-RsKPKVTM5NR6Lji7gF8t3PUN29yGIUqI';
export const APP_STUDIO_SESSION = SESSION;
const APP_STUDIO_STORAGE_KEY = 'piappstudio_session';

export interface AppStudioPiUser {
  uid?: string;
  username?: string;
  [key: string]: unknown;
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

export function sendTokenToAppStudio(accessToken: string, user?: AppStudioPiUser | null): void {
  if (typeof window === 'undefined' || !accessToken) return;
  const activeSession = getAppStudioSession();
  const payload = {
    type: 'piappstudio-auth',
    sessionId: activeSession,
    session: activeSession,
    piappstudio: activeSession,
    accessToken,
    token: accessToken,
    username: user?.username,
    uid: user?.uid,
    user: user || null,
    app: 'ifiok-en',
    timestamp: Date.now(),
  };

  const variants = [
    payload,
    { ...payload, type: 'PI_AUTH' },
    { ...payload, type: 'pi-auth' },
    { ...payload, type: 'APP_STUDIO_AUTH' },
    { ...payload, type: 'pi_auth_success' },
    { ...payload, type: 'PI_ACCESS_TOKEN' },
  ];

  for (const p of variants) {
    try {
      window.parent.postMessage(p, '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
    try {
      window.parent.postMessage(JSON.stringify(p), '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
    try {
      window.top?.postMessage(p, '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
    try {
      window.top?.postMessage(JSON.stringify(p), '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
  }

  console.log('[AppStudio] token sent', user?.username || '');
}

export function broadcastTokenToAppStudio(accessToken: string, user?: AppStudioPiUser | null): void {
  if (typeof window === 'undefined' || !accessToken) return;
  for (let i = 0; i < 6; i++) {
    window.setTimeout(() => {
      sendTokenToAppStudio(accessToken, user);
    }, i * 1000);
  }
  window.setTimeout(() => {
    sendTokenToAppStudio(accessToken, user);
  }, 500);
}

let bridgeRegistered = false;

export function initAppStudioBridge(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  // Capture any ?piappstudio= / ?appStudioSession= / ?session= / window.name session ID on load
  getAppStudioSession();

  // Force fresh login inside App Studio preview so cached localStorage never blocks verification
  if (isAppStudioEnvironment()) {
    clearCachedPiStorage();
  }

  if (bridgeRegistered) return () => undefined;
  bridgeRegistered = true;

  const onMessage = (e: MessageEvent) => {
    let parsed: unknown = e.data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Keep string
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
          // Ignore storage failure
        }
      }
    }

    const d = parsed as { type?: string; action?: string } | string | null;
    const t = (typeof d === 'string' ? d : String(d?.type || d?.action || '')).toLowerCase();

    if (
      t.includes('appstudio') ||
      t.includes('request') ||
      t.includes('token') ||
      t.includes('pi_auth') ||
      t.includes('pi-auth') ||
      t.includes('handshake') ||
      t.includes('ping')
    ) {
      try {
        const tok = window.localStorage.getItem('pi_access_token');
        const usr = JSON.parse(window.localStorage.getItem('pi_user') || 'null') as AppStudioPiUser | null;
        if (tok) {
          sendTokenToAppStudio(tok, usr);
        }
      } catch {
        // Ignore storage read failure
      }
    }
  };

  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    bridgeRegistered = false;
  };
}
