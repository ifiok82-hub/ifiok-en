import { AlertCircle, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PiPaymentCancelledError, runPiTestnetTestPayment, type TestnetPaymentSuccess } from '../lib/pi.ts';

interface PiTestnetPaymentButtonProps {
  compact?: boolean;
}

type PaymentUiState =
  | { status: 'idle' }
  | { status: 'loading'; label: string }
  | { status: 'success'; receipt: TestnetPaymentSuccess }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string };

export function PiTestnetPaymentButton({ compact = false }: PiTestnetPaymentButtonProps) {
  const [state, setState] = useState<PaymentUiState>({ status: 'idle' });

  const handlePayTestnet = async () => {
    setState({ status: 'loading', label: 'Processing Testnet Payment...' });
    try {
      const receipt = await runPiTestnetTestPayment((label) => {
        setState({ status: 'loading', label });
      });
      setState({ status: 'success', receipt });
    } catch (err) {
      if (err instanceof PiPaymentCancelledError) {
        setState({ status: 'cancelled', message: 'Payment cancelled' });
      } else {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unable to process Pi Testnet payment.',
        });
      }
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-400/40 dark:border-amber-500/30 bg-amber-50/70 dark:bg-[#0D152B] ${
        compact ? 'p-4' : 'p-5'
      } space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-purple-800 dark:text-amber-300">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Pi Developer Portal · Sandbox Testnet Verification</span>
        </span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          SDK v2.0 · 0.01 π
        </span>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handlePayTestnet}
          disabled={state.status === 'loading'}
          className="w-full sm:w-auto min-w-[260px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg text-sm sm:text-base font-bold bg-gradient-to-r from-[#4C1D95] to-[#0E1A36] hover:from-[#5B21B6] hover:to-[#172952] dark:from-amber-500 dark:to-amber-400 dark:hover:from-amber-400 dark:hover:to-amber-300 text-white dark:text-slate-950 shadow-md transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {state.status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{state.label}</span>
            </>
          ) : (
            <span>Pay 0.01 Pi - Testnet Test</span>
          )}
        </button>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Testnet Only - No Real Pi Used
        </p>
      </div>

      {state.status === 'success' && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2 text-xs text-emerald-950 dark:text-emerald-100"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Testnet Payment Successful 💚</span>
            </div>
            <button
              type="button"
              onClick={() => setState({ status: 'idle' })}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Run Another Test
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] break-all">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Username: </span>
              <span className="font-semibold">{state.receipt.username}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Amount: </span>
              <span className="font-semibold">{state.receipt.amount} Pi (Testnet)</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 dark:text-slate-400">Payment ID: </span>
              <span className="font-semibold">{state.receipt.paymentId}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 dark:text-slate-400">Transaction ID: </span>
              <span className="font-semibold">{state.receipt.txid}</span>
            </div>
          </div>
        </div>
      )}

      {state.status === 'cancelled' && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-100/70 dark:bg-amber-950/40 p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <span className="font-semibold">{state.message}</span>
          <button
            type="button"
            onClick={handlePayTestnet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3.5 flex flex-wrap items-start justify-between gap-3 text-xs text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{state.message}</span>
          </div>
          <button
            type="button"
            onClick={handlePayTestnet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
}
