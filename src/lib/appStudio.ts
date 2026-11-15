export const APP_STUDIO_SESSION = 'piappstudio-RsKPKVTM5NR6Lji7gF8t3PUN29yGIUqI';
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
  if (typeof window === 'undefined') return APP_STUDIO_SESSION;
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
  return APP_STUDIO_SESSION;
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
    user,
    app: 'ifiok-en',
    timestamp: Date.now(),
  };

  const targets: Window[] = [];
  if (window.parent) targets.push(window.parent);
  if (window.top && window.top !== window.parent) targets.push(window.top);
  if (targets.length === 0) targets.push(window);

  for (const target of targets) {
    try {
      target.postMessage(payload, '*');
      target.postMessage({ ...payload, type: 'PI_AUTH' }, '*');
      target.postMessage({ ...payload, type: 'pi-auth' }, '*');
      target.postMessage({ ...payload, type: 'APP_STUDIO_AUTH' }, '*');
      target.postMessage(JSON.stringify(payload), '*');
    } catch {
      // Ignore cross-origin postMessage restrictions cleanly
    }
  }
}

let bridgeRegistered = false;

export function initAppStudioBridge(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  // Capture any ?piappstudio= / ?session= / window.name session ID on page load
  getAppStudioSession();

  if (bridgeRegistered) return () => undefined;
  bridgeRegistered = true;

  const onMessage = (event: MessageEvent) => {
    let data: unknown = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // Keep raw string check
      }
    }

    // Capture incoming session ID if provided by parent App Studio container
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
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

    const serialized = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || '');
    const asksForToken = /piappstudio|pi_auth|pi-auth|app_studio|handshake|request|token|session|ping/i.test(
      serialized
    );

    if (asksForToken) {
      try {
        const token = window.localStorage.getItem('pi_access_token');
        const rawUser = window.localStorage.getItem('pi_user');
        const parsedUser = rawUser ? (JSON.parse(rawUser) as AppStudioPiUser) : null;
        if (token) {
          sendTokenToAppStudio(token, parsedUser);
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
