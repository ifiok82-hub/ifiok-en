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

export function isPiSdkAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Pi);
}

export async function initPiTestnet(force = false): Promise<boolean> {
  if (!isPiSdkAvailable()) return false;
  if (!initialized || force) {
    initPromise = (async () => {
      await window.Pi!.init({ version: '2.0' });
      initialized = true;
      return true;
    })();
  }
  return initPromise ? initPromise : Promise.resolve(initialized);
}

export async function waitForPiSdk(timeoutMs = 5000): Promise<boolean> {
  if (isPiSdkAvailable()) return initPiTestnet(false);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 120));
    if (isPiSdkAvailable()) {
      return initPiTestnet(false);
    }
  }
  return false;
}

// Unified handler for any incomplete Pi payment discovered during authenticate():
// Complete if transaction.txid exists, else cancel so stuck prior payments never block new payments.
export async function handleIncompletePaymentFound(incomplete: PiIncompletePayment): Promise<void> {
  const paymentId = incomplete?.identifier;
  if (!paymentId) return;

  const orderId = incomplete.metadata?.orderId ? Number(incomplete.metadata.orderId) : null;

  try {
    if (incomplete.transaction?.txid) {
      const txid = incomplete.transaction.txid;
      const res = await fetch(orderId ? '/api/payments/pi/complete' : '/api/pi/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentId,
          txid,
          ...(orderId ? { orderId } : {}),
        }),
      });
      if (!res.ok && orderId) {
        await fetch('/api/pi/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ paymentId, txid }),
        }).catch(() => undefined);
      }
      return;
    }

    const cancelRes = await fetch(orderId ? '/api/payments/pi/cancel' : '/api/pi/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        paymentId,
        ...(orderId ? { orderId } : {}),
      }),
    });
    if (!cancelRes.ok && orderId) {
      await fetch('/api/pi/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId }),
      }).catch(() => undefined);
    }
  } catch {
    // Keep authentication resilient even if stale incomplete payment cleanup fails
  }
}

// App Studio backend URL removed until IFIOK-EN's own App Studio backend URL is provided.
// Verify Pi accessToken exclusively via IFIOK-EN's own backend (/api/pi/auth).
async function verifyAccessTokenWithAppStudio(accessToken: string): Promise<{
  uid: string;
  username: string;
  sessionToken?: string;
}> {
  const serverResponse = await fetch('/api/pi/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accessToken }),
  }).catch(() => null);

  const verifyData = serverResponse
    ? ((await serverResponse.json().catch(() => ({}))) as {
        success?: boolean;
        ok?: boolean;
        error?: string;
        uid?: string;
        username?: string;
        sessionToken?: string;
        piUser?: { uid?: string; username?: string };
      })
    : {};

  const resolvedUid = verifyData.piUser?.uid || verifyData.uid || '';
  const resolvedUsername = verifyData.piUser?.username || verifyData.username || '';
  const serverVerified = Boolean(
    serverResponse?.ok && (verifyData.success || verifyData.ok) && resolvedUid && resolvedUsername
  );

  if (!serverVerified) {
    throw new Error(
      verifyData.error || 'IFIOK-EN backend could not verify your Pi Network identity.'
    );
  }

  return {
    uid: resolvedUid,
    username: resolvedUsername,
    sessionToken: verifyData.sessionToken,
  };
}

export async function connectWithPi(
  scopes: string[] = ['username', 'payments']
): Promise<PiAuthSession> {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(PI_LOGGED_OUT_FLAG);
    } catch {
      // Ignore storage restriction
    }
  }

  const ready = await waitForPiSdk(5000);
  if (!ready || !window.Pi) {
    throw new Error(
      'Pi Browser runtime not detected. Open https://ifiok-en.vercel.app inside Pi Browser and tap Sign in with Pi.'
    );
  }

  if (!initialized) {
    await window.Pi.init({ version: '2.0' });
    initialized = true;
  }

  const auth = await window.Pi.authenticate(scopes, handleIncompletePaymentFound);
  if (scopes.includes('payments')) {
    paymentScopeAuthorized = true;
  }

  const accessToken = auth?.accessToken;
  if (!accessToken) {
    throw new Error('Pi Network authentication did not return a valid accessToken.');
  }

  startAppStudioHeartbeat();
  const verified = await verifyAccessTokenWithAppStudio(accessToken);
  const verifiedUser = { uid: verified.uid, username: verified.username };

  if (typeof window !== 'undefined') {
    window.__PI_ACCESS_TOKEN = accessToken;
    window.__PI_USER = verifiedUser;
    window.piAccessToken = accessToken;
    safeSetLocalStorage('pi_access_token', accessToken);
    safeSetLocalStorage('pi_user', JSON.stringify(verifiedUser));
  }

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
}

let autoAuthAttempted = false;

export async function autoAuthenticatePi(): Promise<PiAuthSession | null> {
  if (typeof window === 'undefined' || autoAuthAttempted) return runtimePiAuth;
  autoAuthAttempted = true;

  try {
    if (window.sessionStorage.getItem(PI_LOGGED_OUT_FLAG) === '1') {
      return null;
    }
  } catch {
    // Ignore storage restriction
  }

  const ready = await waitForPiSdk(4000);
  if (!ready || !window.Pi) return null;

  try {
    if (!initialized) {
      await window.Pi.init({ version: '2.0' });
      initialized = true;
    }
    const auth = await window.Pi.authenticate(['username'], handleIncompletePaymentFound);
    const accessToken = auth?.accessToken;
    if (!accessToken) return null;

    const verified = await verifyAccessTokenWithAppStudio(accessToken);
    const verifiedUser = { uid: verified.uid, username: verified.username };
    const session: PiAuthSession = {
      username: verifiedUser.username,
      uid: verifiedUser.uid,
      accessToken,
      sessionToken: verified.sessionToken,
      connectedAt: new Date().toISOString(),
    };
    saveStoredPiAuth(session);
    broadcastTokenToAppStudio(accessToken, verifiedUser);
    return session;
  } catch {
    return null;
  }
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
  try {
    const res = await fetch('/api/pi/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session.sessionToken) {
    authHeaders.Authorization = `Bearer ${session.sessionToken}`;
  }

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
            try {
              const res = await fetch('/api/pi/approve', {
                method: 'POST',
                headers: authHeaders,
                credentials: 'include',
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
            }
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            onStatusUpdate?.('Completing Testnet Payment...');
            try {
              const res = await fetch('/api/pi/complete', {
                method: 'POST',
                headers: authHeaders,
                credentials: 'include',
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
            }
          },
          onCancel: (paymentId: string) => {
            fetch('/api/pi/cancel', {
              method: 'POST',
              headers: authHeaders,
              credentials: 'include',
              body: JSON.stringify({ paymentId }),
            }).catch(() => undefined);
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
}

export interface PaymentFlowResult {
  status: 'free_enrolled' | 'completed';
  message: string;
  txid?: string;
  orderId?: number;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pi-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function startPiPaymentFlow(payload: PaymentIntentPayload): Promise<PaymentFlowResult> {
  const idempotencyKey = makeIdempotencyKey();
  const intent = await apiRequest<{
    freeEnrolled?: boolean;
    message?: string;
    orderId?: number;
    amountPi?: number;
    memo?: string;
  }>('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ ...payload, idempotencyKey }),
  });

  if (intent.freeEnrolled) {
    return {
      status: 'free_enrolled',
      message: intent.message || 'Enrolment confirmed.',
    };
  }

  const ready = await waitForPiSdk(2500);
  if (!ready || !window.Pi) {
    await apiRequest('/api/payments/pi/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId: intent.orderId }),
    }).catch(() => undefined);

    throw new Error(
      `Order #${intent.orderId} requires Official Pi Browser Testnet settlement (${intent.amountPi} π). Open IFIOK-EN inside Pi Browser with server PI_NETWORK_API_KEY configured to complete payment.`
    );
  }

  if (!runtimePiAuth || !paymentScopeAuthorized) {
    await connectWithPi(['username', 'payments']);
  }

  return new Promise<PaymentFlowResult>((resolve, reject) => {
    window.Pi!.createPayment(
      {
        amount: intent.amountPi!,
        memo: intent.memo || `IFIOK-EN Order #${intent.orderId}`,
        metadata: {
          app: 'ifiok-en',
          orderId: intent.orderId,
          direction: 'user_to_app',
          environment: 'testnet',
        },
      },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          try {
            await apiRequest('/api/payments/pi/approve', {
              method: 'POST',
              body: JSON.stringify({ paymentId, orderId: intent.orderId }),
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            const done = await apiRequest<{ completed: boolean; txid: string; orderId: number }>(
              '/api/payments/pi/complete',
              {
                method: 'POST',
                body: JSON.stringify({ paymentId, txid }),
              }
            );
            resolve({
              status: 'completed',
              message: `Testnet Pi payment verified and completed (Order #${done.orderId}).`,
              txid: done.txid,
              orderId: done.orderId,
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        onCancel: async (paymentId: string) => {
          await apiRequest('/api/payments/pi/cancel', {
            method: 'POST',
            body: JSON.stringify({ paymentId, orderId: intent.orderId }),
          }).catch(() => undefined);
          reject(new Error('Pi payment was cancelled.'));
        },
        onError: (error: Error, payment?: unknown) => {
          console.error('[PI PAYMENT ERROR]', error, payment);
          reject(new Error(error?.message || 'Unable to complete Pi payment. Please try again.'));
        },
      }
    );
  });
}
