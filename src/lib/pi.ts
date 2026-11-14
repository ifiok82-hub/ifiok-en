import { apiRequest } from './api.ts';

interface PiSDK {
  init: (config: { version: string; sandbox: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void
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

export function initPiTestnet(): boolean {
  if (!isPiSdkAvailable()) return false;
  if (!initialized) {
    // Strictly Testnet (sandbox: true) until official Mainnet configuration & approvals are active
    window.Pi!.init({ version: '2.0', sandbox: true });
    initialized = true;
  }
  return true;
}

export async function authenticateWithPi() {
  if (!initPiTestnet()) {
    throw new Error(
      'Official Pi Network SDK requires the Pi Browser runtime. Please open IFIOK-EN inside Pi Browser or sign in using Email Authentication.'
    );
  }

  const authResult = await window.Pi!.authenticate(['username', 'payments'], () => {
    // Incomplete payments are reconciled server-side when resumed
  });

  if (!authResult?.accessToken) {
    throw new Error('Pi Network did not return a valid access token.');
  }

  return apiRequest<{ user: unknown }>('/api/auth/pi', {
    method: 'POST',
    body: JSON.stringify({ accessToken: authResult.accessToken }),
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

export async function startPiPaymentFlow(payload: PaymentIntentPayload): Promise<PaymentFlowResult> {
  const intent = await apiRequest<{
    freeEnrolled?: boolean;
    message?: string;
    orderId?: number;
    amountPi?: number;
    memo?: string;
  }>('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (intent.freeEnrolled) {
    return {
      status: 'free_enrolled',
      message: intent.message || 'Enrolment confirmed.',
    };
  }

  if (!initPiTestnet()) {
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
