export const SESSION = 'piappstudio-RsKPKVTM5NR6Lji7gF8t3PUN29yGIUqI';
export const APP_STUDIO_SESSION = SESSION;
const APP_STUDIO_STORAGE_KEY = 'piappstudio_session';

export interface AppStudioPiUser {
  uid?: string;
  username?: string;
  [key: string]: unknown;
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
    const fromUrl = (params.get('piappstudio') || params.get('session') || '').trim();
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
  const base = {
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
    { ...base, type: 'piappstudio-auth' },
    { ...base, type: 'PI_AUTH' },
    { ...base, type: 'pi-auth' },
    { ...base, type: 'APP_STUDIO_AUTH' },
    { ...base, type: 'pi_auth_success' },
    { ...base, type: 'PI_ACCESS_TOKEN' },
  ];

  for (const p of variants) {
    try {
      window.parent.postMessage(p, '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
    try {
      window.top?.postMessage(p, '*');
    } catch {
      // Ignore cross-origin postMessage restriction
    }
    try {
      window.parent.postMessage(JSON.stringify(p), '*');
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

let bridgeRegistered = false;

export function initAppStudioBridge(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  // Capture any ?piappstudio= / ?session= / window.name session ID on page load
  getAppStudioSession();

  // If a token was previously persisted in this preview session, emit it on mount too
  try {
    const existingToken = window.localStorage.getItem('pi_access_token');
    const existingUser = JSON.parse(window.localStorage.getItem('pi_user') || 'null') as AppStudioPiUser | null;
    if (existingToken) {
      sendTokenToAppStudio(existingToken, existingUser);
    }
  } catch {
    // Ignore storage read failure
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

    // Capture incoming session ID if provided by parent App Studio container
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const incomingSession =
        (typeof obj.piappstudio === 'string' && obj.piappstudio) ||
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
    const t = typeof d === 'string' ? d : String(d?.type || d?.action || '');
    const lower = t.toLowerCase();

    if (
      lower.includes('appstudio') ||
      lower.includes('pi_auth') ||
      lower.includes('pi-auth') ||
      lower.includes('handshake') ||
      t === 'REQUEST_AUTH' ||
      t === 'GET_TOKEN' ||
      t === 'REQUEST_TOKEN' ||
      t === 'PING'
    ) {
      try {
        const token = window.localStorage.getItem('pi_access_token');
        const user = JSON.parse(window.localStorage.getItem('pi_user') || 'null') as AppStudioPiUser | null;
        if (token) {
          sendTokenToAppStudio(token, user);
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
