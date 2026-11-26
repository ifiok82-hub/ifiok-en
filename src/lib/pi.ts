import { apiRequest } from './api.ts';
import {
  broadcastTokenToAppStudio,
  clearCachedPiStorage,
  getAppStudioSession,
  isAppStudioEnvironment,
  sendTokenToAppStudio,
  sendTokenToAppStudioNow,
  startAppStudioHeartbeat,
} from './appStudio.ts';

export interface PiIncompletePayment {
  identifier?: string;
  user_uid?: string;
  amount?: number;
  metadata?: { orderId?: number | string; type?: string; app?: string; [key: string]: unknown } | null;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: {
    txid?: string;
    verified?: boolean;
  } | null;
}

export interface PiAuthSession {
  username: string;
  uid: string;
  accessToken: string;
  sessionToken?: string;
  connectedAt: string;
}

interface PiSDK {
  init: (config: { version: string }) => void | Promise<void>;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: PiIncompletePayment) => void
  ) => Promise<{
    accessToken: string;
    user?: { uid?: string; username?: string };
  }>;
  logout?: () => void | Promise<void>;
  createPayment: (
    paymentData: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: {
      onReadyForServerApproval: (paymentId: string) => void | Promise<void>;
      onReadyForServerCompletion: (paymentId: string, txid: string) => void | Promise<void>;
      onCancel: (paymentId: string) => void;
      onError: (error: Error, payment?: unknown) => void;
    }
  ) => void;
}

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

const PI_AUTH_STORAGE_KEY = 'pi_auth';
const LEGACY_PI_AUTH_STORAGE_KEY = 'ifiok_pi_auth';
const UNLOCK_TOKENS_STORAGE_KEY = 'ifiok_unlock_tokens';
export const PI_AUTH_EVENT = 'ifiok-pi-auth-changed';

let initialized = false;
let initPromise: Promise<boolean> | null = null;
let runtimePiAuth: PiAuthSession | null = null;
let paymentScopeAuthorized = false;

function notifyPiAuthChanged(session: PiAuthSession | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PI_AUTH_EVENT, { detail: session }));
  }
}

let appStudioCacheClearedOnce = false;
const PI_LOGGED_OUT_FLAG = 'ifiok_pi_logged_out';

export function getStoredPiAuth(): PiAuthSession | null {
  if (typeof window === 'undefined') return null;
  if (isAppStudioEnvironment() && !appStudioCacheClearedOnce) {
    appStudioCacheClearedOnce = true;
    clearCachedPiStorage();
    return null;
  }
  try {
    const raw =
      window.localStorage.getItem(PI_AUTH_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_PI_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PiAuthSession>;
    if (!parsed.username || !parsed.uid || !parsed.accessToken) return null;
    return {
      username: parsed.username,
      uid: parsed.uid,
      accessToken: parsed.accessToken,
      sessionToken: parsed.sessionToken,
      connectedAt: parsed.connectedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage restrictions in embedded WebViews
  }
}

function safeRemoveLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions in embedded WebViews
  }
}

export function saveStoredPiAuth(session: PiAuthSession | null) {
  if (typeof window === 'undefined') return;
  runtimePiAuth = session;
  if (!session) {
    paymentScopeAuthorized = false;
  }
  if (session) {
    const serialized = JSON.stringify(session);
    safeSetLocalStorage(PI_AUTH_STORAGE_KEY, serialized);
    safeSetLocalStorage(LEGACY_PI_AUTH_STORAGE_KEY, serialized);
    safeSetLocalStorage('pi_access_token', session.accessToken);
    safeSetLocalStorage('pi_user', JSON.stringify({ uid: session.uid, username: session.username }));
    window.__PI_ACCESS_TOKEN = session.accessToken;
    window.__PI_USER = { uid: session.uid, username: session.username };
    window.piAccessToken = session.accessToken;
  } else {
    safeRemoveLocalStorage(PI_AUTH_STORAGE_KEY);
    safeRemoveLocalStorage(LEGACY_PI_AUTH_STORAGE_KEY);
  }
  notifyPiAuthChanged(session);
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
    promise.then(
      (val) => {
        window.clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

function getPiAuthEndpoint(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.run.app')) {
      return '/api/pi/auth';
    }
  }
  return 'https://ifiok-en.vercel.app/api/pi/auth';
}

export function isPiSdkAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Pi);
}

export async function initPiTestnet(force = false): Promise<boolean> {
  if (!isPiSdkAvailable()) return false;
  if (!initialized || force) {
    initPromise = (async () => {
      try {
        await withTimeout(
          Promise.resolve(window.Pi!.init({ version: '2.0' })),
          4000,
          'Pi SDK initialization timed out'
        );
        initialized = true;
        return true;
      } catch (err) {
        initPromise = null;
        initialized = false;
        throw err;
      }
    })();
  }
  return initPromise ? initPromise : Promise.resolve(initialized);
}

export async function waitForPiSdk(timeoutMs = 3500): Promise<boolean> {
  if (isPiSdkAvailable()) {
    try {
      return await initPiTestnet(false);
    } catch {
      return false;
    }
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 120));
    if (isPiSdkAvailable()) {
      try {
        return await initPiTestnet(false);
      } catch {
        return false;
      }
    }
  }
  return false;
}

function buildUnlockKey(itemType: string, itemId: number | string, planSlug?: string): string {
  return planSlug ? `${itemType}:${itemId}:${planSlug}` : `${itemType}:${itemId}`;
}

export function saveUnlockToken(
  itemType: 'course' | 'product' | 'service' | 'subscription',
  itemId: number,
  token: string | null | undefined,
  planSlug?: string
) {
  if (typeof window === 'undefined' || !token) return;
  try {
    const raw = window.localStorage.getItem(UNLOCK_TOKENS_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[buildUnlockKey(itemType, itemId, planSlug)] = token;
    window.localStorage.setItem(UNLOCK_TOKENS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage restrictions
  }
}

export function getUnlockToken(
  itemType: 'course' | 'product' | 'service' | 'subscription',
  itemId: number,
  planSlug?: string
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(UNLOCK_TOKENS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[buildUnlockKey(itemType, itemId, planSlug)] || null;
  } catch {
    return null;
  }
}

export function getPiAuthHeaders(): Record<string, string> {
  const session = runtimePiAuth || getStoredPiAuth();
  const headers: Record<string, string> = {};
  if (session?.sessionToken) {
    headers.Authorization = `Bearer ${session.sessionToken}`;
  }
  if (session?.accessToken) {
    headers['x-pi-access-token'] = session.accessToken;
  }
  return headers;
}

// Unified handler for any incomplete Pi payment discovered during authenticate():
// Complete if transaction.txid exists, else cancel so stuck prior payments never block new payments.
export async function handleIncompletePaymentFound(incomplete: PiIncompletePayment): Promise<void> {
  const paymentId = incomplete?.identifier;
  if (!paymentId) return;

  const orderId = incomplete.metadata?.orderId ? Number(incomplete.metadata.orderId) : null;
  const orderType = typeof incomplete.metadata?.orderType === 'string' ? incomplete.metadata.orderType : undefined;
  const referenceId = incomplete.metadata?.referenceId ? Number(incomplete.metadata.referenceId) : undefined;
  const planSlug = typeof incomplete.metadata?.planSlug === 'string' ? incomplete.metadata.planSlug : undefined;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  const headers = { 'Content-Type': 'application/json', ...getPiAuthHeaders() };

  try {
    if (incomplete.transaction?.txid) {
      const txid = incomplete.transaction.txid;
      const res = await fetch(orderId ? '/api/payments/pi/complete' : '/api/pi/complete', {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          paymentId,
          txid,
          ...(orderId ? { orderId } : {}),
          ...(orderType ? { orderType } : {}),
          ...(referenceId ? { referenceId } : {}),
          ...(planSlug ? { planSlug } : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { unlockToken?: string };
        if (data.unlockToken && orderType && ['course', 'product', 'service', 'subscription'].includes(orderType)) {
          saveUnlockToken(
            orderType as 'course' | 'product' | 'service' | 'subscription',
            referenceId || 0,
            data.unlockToken,
            planSlug
          );
        }
      } else if (orderId) {
        await fetch('/api/pi/complete', {
          method: 'POST',
          headers,
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ paymentId, txid }),
        }).catch(() => undefined);
      }
      return;
    }

    const cancelRes = await fetch(orderId ? '/api/payments/pi/cancel' : '/api/pi/cancel', {
      method: 'POST',
      headers,
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        paymentId,
        ...(orderId ? { orderId } : {}),
      }),
    });
    if (!cancelRes.ok && orderId) {
      await fetch('/api/pi/cancel', {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ paymentId }),
      }).catch(() => undefined);
    }
  } catch {
    // Keep authentication resilient even if stale incomplete payment cleanup fails
  } finally {
    window.clearTimeout(timer);
  }
}

// Verify Pi accessToken exclusively via IFIOK-EN's own backend (/api/pi/auth) with 10s AbortController timeout.
async function verifyAccessTokenWithBackend(accessToken: string): Promise<{
  uid: string;
  username: string;
  sessionToken?: string;
}> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const serverResponse = await fetch(getPiAuthEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
      signal: controller.signal,
    });

    const verifyData = (await serverResponse.json().catch(() => ({}))) as {
      success?: boolean;
      ok?: boolean;
      error?: string;
      uid?: string;
      username?: string;
      sessionToken?: string;
      piUser?: { uid?: string; username?: string };
    };

    const resolvedUid = verifyData.piUser?.uid || verifyData.uid || '';
    const resolvedUsername = verifyData.piUser?.username || verifyData.username || '';
    const serverVerified = Boolean(
      serverResponse.ok && (verifyData.success || verifyData.ok) && resolvedUid && resolvedUsername
    );

    if (!serverVerified) {
      throw new Error(
        verifyData.error || `Server returned HTTP ${serverResponse.status}`
      );
    }

    return {
      uid: resolvedUid,
      username: resolvedUsername,
      sessionToken: verifyData.sessionToken,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Verification request timed out after 10 seconds');
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

let inFlightConnectPromise: Promise<PiAuthSession> | null = null;

export async function connectWithPi(
  scopes: string[] = ['username']
): Promise<PiAuthSession> {
  if (inFlightConnectPromise) {
    return inFlightConnectPromise;
  }

  inFlightConnectPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(PI_LOGGED_OUT_FLAG);
        } catch {
          // Ignore storage restriction
        }
      }

      const ready = await waitForPiSdk(3500);
      if (!ready || !window.Pi) {
        throw new Error(
          'Pi Browser not detected. Open https://ifiok-en.vercel.app inside Pi Browser'
        );
      }

      if (!initialized) {
        await initPiTestnet(true);
      }

      const auth = await withTimeout(
        window.Pi.authenticate(scopes, handleIncompletePaymentFound),
        9500,
        'Pi Browser sign-in timed out after 10 seconds'
      );
      if (scopes.includes('payments')) {
        paymentScopeAuthorized = true;
      }

      const accessToken = auth?.accessToken;
      if (!accessToken) {
        throw new Error('Pi Network did not return an accessToken');
      }

      const verified = await verifyAccessTokenWithBackend(accessToken);
      const verifiedUser = { uid: verified.uid, username: verified.username };

      if (typeof window !== 'undefined') {
        window.__PI_ACCESS_TOKEN = accessToken;
        window.__PI_USER = verifiedUser;
        window.piAccessToken = accessToken;
        safeSetLocalStorage('pi_access_token', accessToken);
        safeSetLocalStorage('pi_user', JSON.stringify(verifiedUser));
      }

      startAppStudioHeartbeat();
      sendTokenToAppStudioNow();
      broadcastTokenToAppStudio(accessToken, verifiedUser);

      const session: PiAuthSession = {
        username: verifiedUser.username,
        uid: verifiedUser.uid,
        accessToken,
        sessionToken: verified.sessionToken,
        connectedAt: new Date().toISOString(),
      };

      saveStoredPiAuth(session);
      return session;
    } finally {
      inFlightConnectPromise = null;
    }
  })();

  return inFlightConnectPromise;
}

let autoAuthAttempted = false;

export async function autoAuthenticatePi(): Promise<PiAuthSession | null> {
  if (typeof window === 'undefined' || autoAuthAttempted || inFlightConnectPromise) return runtimePiAuth;
  autoAuthAttempted = true;

  try {
    if (window.sessionStorage.getItem(PI_LOGGED_OUT_FLAG) === '1') {
      return null;
    }
  } catch {
    // Ignore storage restriction
  }

  return revalidateStoredPiAuth();
}

export async function logoutPi(): Promise<void> {
  appStudioCacheClearedOnce = true;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PI_LOGGED_OUT_FLAG, '1');
    } catch {
      // Ignore storage restriction
    }
  }
  saveStoredPiAuth(null);
  clearCachedPiStorage();
  try {
    await window.Pi?.logout?.();
  } catch {
    // Ignore if Pi SDK does not expose logout in current WebView
  }
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
}

export async function revalidateStoredPiAuth(): Promise<PiAuthSession | null> {
  const cached = getStoredPiAuth();
  if (!cached?.accessToken) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(getPiAuthEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ accessToken: cached.accessToken }),
    });
    if (res.status === 401 || res.status === 403) {
      saveStoredPiAuth(null);
      if (typeof window !== 'undefined') {
        safeRemoveLocalStorage('pi_access_token');
        safeRemoveLocalStorage('pi_user');
      }
      return null;
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        piUser?: { uid: string; username: string };
      };
      if (data.piUser?.uid && data.piUser?.username) {
        sendTokenToAppStudio(cached.accessToken, data.piUser);
      }
    }
  } catch {
    // Preserve cached session if offline
  } finally {
    window.clearTimeout(timer);
  }
  return getStoredPiAuth();
}

export async function authenticateWithPi() {
  const session = await connectWithPi(['username']);
  return apiRequest<{ user: unknown }>('/api/auth/pi', {
    method: 'POST',
    body: JSON.stringify({ accessToken: session.accessToken }),
  });
}

export interface TestnetPaymentSuccess {
  paymentId: string;
  txid: string;
  username: string;
  amount: number;
}

export class PiPaymentCancelledError extends Error {
  paymentId: string;
  constructor(paymentId: string, message = 'Cancelled') {
    super(message);
    this.name = 'PiPaymentCancelledError';
    this.paymentId = paymentId;
  }
}

export async function runPiTestnetTestPayment(onStatusUpdate?: (msg: string) => void): Promise<TestnetPaymentSuccess> {
  const sdkReady = await waitForPiSdk(5000);
  if (!sdkReady || !window.Pi) {
    throw new Error(
      'Pi SDK requires Pi Browser. Open https://ifiok-en.vercel.app inside Pi Browser to complete the 0.01 Pi test.'
    );
  }

  if (!initialized) {
    await window.Pi.init({ version: '2.0' });
    initialized = true;
  }

  // Ensure server-verified Pi authentication with payments scope is active in current runtime
  let session = runtimePiAuth;
  if (!session || !paymentScopeAuthorized) {
    onStatusUpdate?.('Authenticating with Pi...');
    session = await connectWithPi(['username', 'payments']);
  }

  const verifiedUsername = session.username;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getPiAuthHeaders(),
  };

  onStatusUpdate?.('Processing Testnet Payment...');

  return new Promise<TestnetPaymentSuccess>((resolve, reject) => {
    let settled = false;
    const safeReject = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    const safeResolve = (result: TestnetPaymentSuccess) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      window.Pi!.createPayment(
        {
          amount: 0.01,
          memo: 'IFIOK-EN Testnet Test',
          metadata: { app: 'ifiok-en', type: 'testnet_test', direction: 'user_to_app' },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            onStatusUpdate?.('Approving on IFIOK-EN server...');
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 4800);
            try {
              const res = await fetch('/api/pi/approve', {
                method: 'POST',
                headers: authHeaders,
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({ paymentId }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                success?: boolean;
                ok?: boolean;
                error?: string;
              };
              if (!res.ok || (!data.success && !data.ok)) {
                throw new Error(data.error || `Server approval failed (${res.status}).`);
              }
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            } finally {
              window.clearTimeout(timer);
            }
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            onStatusUpdate?.('Completing Testnet Payment...');
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 10000);
            try {
              const res = await fetch('/api/pi/complete', {
                method: 'POST',
                headers: authHeaders,
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({ paymentId, txid }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                success?: boolean;
                ok?: boolean;
                completed?: boolean;
                paymentId?: string;
                txid?: string;
                username?: string;
                amount?: number;
                error?: string;
              };
              if (!res.ok || (!data.success && !data.completed)) {
                throw new Error(data.error || `Server completion failed (${res.status}).`);
              }
              safeResolve({
                paymentId: data.paymentId || paymentId,
                txid: data.txid || txid,
                username: data.username || verifiedUsername,
                amount: data.amount ?? 0.01,
              });
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            } finally {
              window.clearTimeout(timer);
            }
          },
          onCancel: (paymentId: string) => {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 4500);
            fetch('/api/pi/cancel', {
              method: 'POST',
              headers: authHeaders,
              credentials: 'include',
              signal: controller.signal,
              body: JSON.stringify({ paymentId }),
            })
              .catch(() => undefined)
              .finally(() => window.clearTimeout(timer));
            safeReject(new PiPaymentCancelledError(paymentId, 'Cancelled'));
          },
          onError: (error: Error, payment?: unknown) => {
            console.error('[PI PAYMENT ERROR]', error, payment);
            safeReject(new Error(error?.message || 'Unable to process Pi Testnet payment. Please try again.'));
          },
        }
      );
    } catch (err) {
      safeReject(err instanceof Error ? err : new Error('Failed to start Pi Testnet payment.'));
    }
  });
}

export interface PaymentIntentPayload {
  orderType: 'product' | 'course' | 'service' | 'subscription';
  referenceId: number;
  quantity?: number;
  brief?: string;
  planSlug?: string;
  shippingInfo?: Record<string, string>;
  expectedFree?: boolean;
}

export interface PaymentFlowResult {
  status: 'free_enrolled' | 'completed';
  message: string;
  txid?: string;
  orderId?: number;
  unlockToken?: string;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pi-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function fetchJsonWithTimeout<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiRequest<T>(url, {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out communicating with IFIOK-EN server.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function startPiPaymentFlow(payload: PaymentIntentPayload): Promise<PaymentFlowResult> {
  if (!payload.expectedFree && isPiSdkAvailable() && (!runtimePiAuth || !paymentScopeAuthorized)) {
    await connectWithPi(['username', 'payments']);
  }

  const idempotencyKey = makeIdempotencyKey();
  const { expectedFree: _ignored, ...requestPayload } = payload;
  let intent: {
    freeEnrolled?: boolean;
    message?: string;
    orderId?: number;
    amountPi?: number;
    memo?: string;
    unlockToken?: string;
  };

  try {
    intent = await fetchJsonWithTimeout('/api/payments/create-intent', { ...requestPayload, idempotencyKey }, 10000);
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (isPiSdkAvailable() && (msg.includes('auth') || msg.includes('401') || msg.includes('sign in'))) {
      await connectWithPi(['username', 'payments']);
      intent = await fetchJsonWithTimeout('/api/payments/create-intent', { ...requestPayload, idempotencyKey }, 10000);
    } else {
      throw err;
    }
  }

  if (intent.freeEnrolled) {
    if (intent.unlockToken) {
      saveUnlockToken(payload.orderType, payload.referenceId, intent.unlockToken, payload.planSlug);
    }
    return {
      status: 'free_enrolled',
      message: intent.message || 'Enrolment confirmed.',
      orderId: intent.orderId,
      unlockToken: intent.unlockToken,
    };
  }

  const ready = await waitForPiSdk(3500);
  if (!ready || !window.Pi) {
    await fetchJsonWithTimeout('/api/payments/pi/cancel', { orderId: intent.orderId }, 4000).catch(() => undefined);

    throw new Error(
      `Order #${intent.orderId} requires Official Pi Browser Testnet settlement (${intent.amountPi} π). Open https://ifiok-en.vercel.app inside Pi Browser to complete payment.`
    );
  }

  if (!runtimePiAuth || !paymentScopeAuthorized) {
    await connectWithPi(['username', 'payments']);
  }

  return new Promise<PaymentFlowResult>((resolve, reject) => {
    let settled = false;
    const safeReject = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    const safeResolve = (result: PaymentFlowResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      window.Pi!.createPayment(
        {
          amount: intent.amountPi!,
          memo: intent.memo || `IFIOK-EN Order #${intent.orderId}`,
          metadata: {
            app: 'ifiok-en',
            orderId: intent.orderId,
            orderType: payload.orderType,
            referenceId: payload.referenceId,
            ...(payload.planSlug ? { planSlug: payload.planSlug } : {}),
            direction: 'user_to_app',
            environment: 'testnet',
          },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            try {
              await fetchJsonWithTimeout(
                '/api/payments/pi/approve',
                {
                  paymentId,
                  orderId: intent.orderId,
                  expectedAmountPi: intent.amountPi,
                },
                4800
              );
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            }
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const done = await fetchJsonWithTimeout<{
                completed: boolean;
                txid?: string;
                orderId?: number;
                unlockToken?: string;
              }>(
                '/api/payments/pi/complete',
                {
                  paymentId,
                  txid,
                  orderId: intent.orderId,
                  orderType: payload.orderType,
                  referenceId: payload.referenceId,
                  quantity: payload.quantity,
                  planSlug: payload.planSlug,
                },
                10000
              );
              if (done.unlockToken) {
                saveUnlockToken(payload.orderType, payload.referenceId, done.unlockToken, payload.planSlug);
              }
              const resolvedOrderId = done.orderId || intent.orderId;
              safeResolve({
                status: 'completed',
                message: `Testnet Pi payment verified and completed (Order #${resolvedOrderId}).`,
                txid: done.txid || txid,
                orderId: resolvedOrderId,
                unlockToken: done.unlockToken,
              });
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            }
          },
          onCancel: async (paymentId: string) => {
            await fetchJsonWithTimeout(
              '/api/payments/pi/cancel',
              { paymentId, orderId: intent.orderId },
              4500
            ).catch(() => undefined);
            safeReject(new Error('Pi payment was cancelled.'));
          },
          onError: (error: Error, payment?: unknown) => {
            console.error('[PI PAYMENT ERROR]', error, payment);
            safeReject(new Error(error?.message || 'Unable to complete Pi payment. Please try again.'));
          },
        }
      );
    } catch (err) {
      safeReject(err instanceof Error ? err : new Error('Unable to launch Pi Wallet payment.'));
    }
  });
}
