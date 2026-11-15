import { apiRequest } from './api.ts';

export interface PiIncompletePayment {
  identifier?: string;
  user_uid?: string;
  amount?: number;
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

interface PiSDK {
  init: (config: { version: string; sandbox: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: PiIncompletePayment) => void
  ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>;
  createPayment: (
    paymentData: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: {
      onReadyForServerApproval: (paymentId: string) => void;
      onReadyForServerCompletion: (paymentId: string, txid: string) => void;
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

let initialized = false;

export function isPiSdkAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Pi);
}

export function initPiTestnet(force = false): boolean {
  if (!isPiSdkAvailable()) return false;
  if (!initialized || force) {
    // Strictly Testnet (sandbox: true) — NEVER Mainnet
    window.Pi!.init({ version: '2.0', sandbox: true });
    initialized = true;
  }
  return true;
}

export async function waitForPiSdk(timeoutMs = 2500): Promise<boolean> {
  if (isPiSdkAvailable()) return initPiTestnet(true);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 120));
    if (isPiSdkAvailable()) {
      return initPiTestnet(true);
    }
  }
  return false;
}

export async function authenticateWithPi() {
  const ready = await waitForPiSdk(1500);
  if (!ready) {
    throw new Error(
      'Official Pi Network SDK requires the Pi Browser runtime. Please open IFIOK-EN inside Pi Browser or sign in using Email Authentication.'
    );
  }

  const authResult = await window.Pi!.authenticate(['username', 'payments'], async (incomplete) => {
    if (incomplete?.identifier && incomplete.transaction?.txid) {
      await apiRequest('/api/pi/complete', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: incomplete.identifier,
          txid: incomplete.transaction.txid,
        }),
      }).catch(() => undefined);
    }
  });

  if (!authResult?.accessToken) {
    throw new Error('Pi Network did not return a valid access token.');
  }

  return apiRequest<{ user: unknown }>('/api/auth/pi', {
    method: 'POST',
    body: JSON.stringify({ accessToken: authResult.accessToken }),
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
  constructor(paymentId: string, message = 'Payment cancelled') {
    super(message);
    this.name = 'PiPaymentCancelledError';
    this.paymentId = paymentId;
  }
}

export async function runPiTestnetTestPayment(onStatusUpdate?: (msg: string) => void): Promise<TestnetPaymentSuccess> {
  const sdkReady = await waitForPiSdk(2500);
  if (!sdkReady || !window.Pi) {
    throw new Error(
      'Pi SDK is only active inside Pi Browser. Open https://ifiok-en.vercel.app inside Pi Browser (Testnet) to complete the 0.01 Pi test.'
    );
  }

  // Always initialize strictly with version "2.0" and sandbox: true
  window.Pi.init({ version: '2.0', sandbox: true });
  initialized = true;

  onStatusUpdate?.('Processing Testnet Payment...');

  let resolvedUsername = '';
  let resolvedPiUid = '';

  const onIncompletePaymentFound = async (incomplete: PiIncompletePayment) => {
    try {
      const incId = incomplete?.identifier;
      const incTxid = incomplete?.transaction?.txid;
      if (!incId) return;
      if (incTxid) {
        await apiRequest('/api/pi/complete', {
          method: 'POST',
          body: JSON.stringify({
            paymentId: incId,
            txid: incTxid,
            username: resolvedUsername,
            piUid: resolvedPiUid,
          }),
        });
      } else {
        await apiRequest('/api/pi/cancel', {
          method: 'POST',
          body: JSON.stringify({
            paymentId: incId,
            username: resolvedUsername,
            attemptServerCancel: true,
          }),
        });
      }
    } catch {
      // Do not crash authenticate flow if cleanup fails
    }
  };

  const auth = await window.Pi.authenticate(['payments', 'username'], onIncompletePaymentFound);
  resolvedUsername = auth?.user?.username || '';
  resolvedPiUid = auth?.user?.uid || '';

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
          metadata: { type: 'testnet_test', app: 'ifiok-en' },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            try {
              onStatusUpdate?.('Processing Testnet Payment...');
              const res = await fetch('/api/pi/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  paymentId,
                  username: resolvedUsername,
                  piUid: resolvedPiUid,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
              if (!res.ok || data.ok === false) {
                throw new Error(data.error || `Server approval failed (${res.status}).`);
              }
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            }
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              onStatusUpdate?.('Processing Testnet Payment...');
              const res = await fetch('/api/pi/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  paymentId,
                  txid,
                  username: resolvedUsername,
                  piUid: resolvedPiUid,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                completed?: boolean;
                paymentId?: string;
                txid?: string;
                username?: string;
                amount?: number;
                error?: string;
              };
              if (!res.ok || !data.completed) {
                throw new Error(data.error || `Server completion failed (${res.status}).`);
              }
              safeResolve({
                paymentId: data.paymentId || paymentId,
                txid: data.txid || txid,
                username: data.username || resolvedUsername || 'Pi Pioneer',
                amount: data.amount ?? 0.01,
              });
            } catch (err) {
              safeReject(err instanceof Error ? err : new Error(String(err)));
            }
          },
          onCancel: (paymentId: string) => {
            fetch('/api/pi/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ paymentId, username: resolvedUsername }),
            }).catch(() => undefined);
            safeReject(new PiPaymentCancelledError(paymentId, 'Payment cancelled'));
          },
          onError: (error: Error, payment?: unknown) => {
            const msg = error?.message || 'Pi SDK payment error occurred.';
            void payment;
            safeReject(new Error(msg));
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

  const ready = await waitForPiSdk(2000);
  if (!ready) {
    await apiRequest('/api/payments/pi/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId: intent.orderId }),
    }).catch(() => undefined);

    throw new Error(
      `Order #${intent.orderId} requires Official Pi Browser Testnet settlement (${intent.amountPi} π). Open IFIOK-EN inside Pi Browser with server PI_API_KEY configured to complete payment.`
    );
  }

  return new Promise<PaymentFlowResult>((resolve, reject) => {
    window.Pi!.createPayment(
      {
        amount: intent.amountPi!,
        memo: intent.memo || `IFIOK-EN Order #${intent.orderId}`,
        metadata: { orderId: intent.orderId, environment: 'testnet' },
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
        onCancel: async () => {
          await apiRequest('/api/payments/pi/cancel', {
            method: 'POST',
            body: JSON.stringify({ orderId: intent.orderId }),
          }).catch(() => undefined);
          reject(new Error('Pi payment was cancelled.'));
        },
        onError: (error: Error) => {
          reject(error || new Error('Pi SDK payment error occurred.'));
        },
      }
    );
  });
}
