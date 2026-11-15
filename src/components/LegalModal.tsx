import { ArrowLeft, X } from 'lucide-react';

export type PolicyKey = 'terms' | 'privacy' | 'refund' | 'seller' | 'community';

interface LegalModalProps {
  policy: PolicyKey | null;
  onClose: () => void;
}

export const POLICIES: Record<
  PolicyKey,
  { title: string; updated: string; sections: Array<{ heading: string; body: string }> }
> = {
  terms: {
    title: 'IFIOK-EN Terms of Service',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Scope of the Digital Empowerment Ecosystem',
        body: 'IFIOK-EN operates an integrated digital platform spanning IFIOK SCHOOL — Global Digital Learning, IFIOK Business Hub, IFIOK Freelance, IFIOK Opportunities, IFIOK Market, and IFIOK Community. All accounts are subject to role-based access governance and truthful identity representation.',
      },
      {
        heading: '2. Pi Network Settlement & Testnet Environment',
        body: 'Pi (π) is the designated payment currency for eligible platform transactions. Mainnet transactions remain strictly disabled until official configuration, credentials, and network approvals are complete. All Pi payments require server-side verification and completion.',
      },
      {
        heading: '3. Honest Earnings & No Financial Guarantees',
        body: 'IFIOK-EN provides educational resources, commerce infrastructure, and verified work channels. We never promise guaranteed earnings, investment returns, or automatic profits.',
      },
    ],
  },
  privacy: {
    title: 'IFIOK-EN Privacy Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Data Minimization & Consent',
        body: 'Personal contact details including email addresses, international phone numbers, and Pi Network identifiers are stored strictly for authentication, order reconciliation, and authorized administrative governance. Private contact fields are never exposed in public member directories.',
      },
      {
        heading: '2. Pi Network Authentication & Payment Records',
        body: 'When you authenticate or perform Testnet payments via Pi Browser, only your authorized Pi username, UID, payment identifier, and blockchain transaction ID (txid) are verified and recorded to reconcile your transaction state.',
      },
      {
        heading: '3. Security Controls & Audit Trails',
        body: 'Passwords are hashed using industry-standard adaptive bcrypt. Sessions rely on HTTP-only signed tokens, rate-limited endpoints, and immutable security audit trails.',
      },
    ],
  },
  refund: {
    title: 'IFIOK-EN Refund & Dispute Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Freelance & Marketplace Order Protection',
        body: 'Buyers and clients may open a formal dispute from their Member Dashboard for undelivered freelance milestones, defective digital/physical items, or inaccurate service fulfilment.',
      },
      {
        heading: '2. Administrative Reconciliation',
        body: 'Finance and Trust administrators review project briefs, blockchain transaction hashes (txid), and delivery records before authorizing refunds or order settlements.',
      },
    ],
  },
  seller: {
    title: 'IFIOK-EN Seller & Creator Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Genuine Listings Only',
        body: 'Sellers, instructors, freelancers, and hiring organisations must submit accurate descriptions, verifiable credentials, and real pricing in Pi (π). Misleading listings, counterfeit digital goods, or fabricated reviews result in permanent account suspension.',
      },
      {
        heading: '2. Transparent Platform Commissions',
        body: 'Applicable platform commissions (currently published transparently in Platform Settings) sustain server verification, dispute resolution, and infrastructure operations.',
      },
    ],
  },
  community: {
    title: 'IFIOK-EN Community Guidelines',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Constructive Global Collaboration',
        body: 'Members must treat peers across all regions with respect. Unsolicited spam, phishing links, impersonation, or harassment are strictly prohibited and subject to immediate moderation.',
      },
      {
        heading: '2. Abuse Reporting',
        body: 'Any community post or direct message may be flagged by members. Flagged items are automatically routed to the Trust & Safety moderation queue.',
      },
    ],
  },
};

export function LegalModal({ policy, onClose }: LegalModalProps) {
  if (!policy) return null;
  const doc = POLICIES[policy];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">{doc.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{doc.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal policy"
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {doc.sections.map((s) => (
            <section key={s.heading} className="space-y-1.5">
              <h3 className="font-display font-semibold text-slate-900 dark:text-white">{s.heading}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LegalPageProps {
  policy: 'privacy' | 'terms';
  onBackHome: () => void;
  onSwitchPolicy: (next: 'privacy' | 'terms') => void;
}

export function LegalPage({ policy, onBackHome, onSwitchPolicy }: LegalPageProps) {
  const doc = POLICIES[policy];

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitchPolicy('privacy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              policy === 'privacy'
                ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onSwitchPolicy('terms')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              policy === 'terms'
                ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            Terms of Service
          </button>
        </div>
      </div>

      <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 sm:p-8 space-y-6">
        <header className="border-b border-slate-200 dark:border-slate-800 pb-4 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-950 dark:text-white">
            {doc.title}
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {doc.updated} · App URL: https://ifiok-en.vercel.app
          </p>
        </header>

        <div className="space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {doc.sections.map((s) => (
            <section key={s.heading} className="space-y-1.5">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">{s.heading}</h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
