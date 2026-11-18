import { ArrowLeft, X } from 'lucide-react';
import type { PolicyKey } from '../types/platform.ts';

export type { PolicyKey };

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
        body: 'IFIOK-EN operates an integrated digital platform spanning IFIOK SCHOOL — Global Digital Learning, IFIOK Business Hub, IFIOK Freelance, IFIOK Opportunities, IFIOK Market (including IFIOK DIGITAL), and IFIOK Community. All accounts are subject to role-based access governance and truthful identity representation.',
      },
      {
        heading: '2. Pi Network Settlement & Testnet Environment',
        body: 'Pi (π) is the designated payment currency for eligible platform transactions. Mainnet transactions remain strictly disabled until official configuration, credentials, and network approvals are complete. All Pi payments require server-side verification and completion.',
      },
      {
        heading: '3. Honest Earnings & Educational Scope',
        body: 'IFIOK-EN provides educational resources, commerce infrastructure, and verified work channels. IFIOK SCHOOL certificates verify platform course completion only; we never claim external government or university accreditation where none exists, and never promise guaranteed income.',
      },
    ],
  },
  privacy: {
    title: 'IFIOK-EN Privacy Policy',
    updated: 'Last Updated: November 15, 2026',
    sections: [
      {
        heading: '1. Data We Collect (Pi Network Only)',
        body: 'IFIOK-EN (https://ifiok-en.vercel.app) uses Official Pi SDK authentication exclusively. When you tap Sign in with Pi, we collect only the authorized Pi account fields permitted by you: Pi username, Pi unique user identifier (UID), Pi wallet address (when wallet_address scope is granted), and Pi authentication access token (verified with Pi App Studio and Pi Platform APIs).',
      },
      {
        heading: '2. Pi Testnet Payments & Order Reconciliation',
        body: 'All eligible platform payments execute on Pi Network Testnet (sandbox mode) using the IFIOK-EN Testnet App Wallet (GDD4KZEBDEJMYJYP6O5SCBHE5GGIF6K3RTHCF4ZGIWWIPGAHLTTXZB2O). We record the Pi payment identifier (paymentId), Pi amount, payment memo, and blockchain transaction ID (txid) strictly to approve, verify, and reconcile your orders and course enrolments. We never sell or share private data with third parties.',
      },
      {
        heading: '3. Cookies & Browser Storage',
        body: 'IFIOK-EN uses essential HTTP-only signed session cookies for authentication security and local browser storage (pi_auth, pi_access_token, pi_user, piappstudio_session, theme, and language settings) to maintain active sessions and enable Pi App Studio session verification. We do not use advertising trackers.',
      },
      {
        heading: '4. Security Controls & Data Deletion Contact',
        body: 'API endpoints are rate-limited, role permissions are enforced server-side, minor learners under 13 require verified guardian consent, and administrative actions are logged in audit trails. To request access, correction, or deletion of your personal data, contact the IFIOK-EN privacy team directly at ifiok82@gmail.com or support@ifiok-en.org.',
      },
    ],
  },
  refund: {
    title: 'IFIOK-EN Refund & Dispute Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Freelance, Course & Digital Order Protection',
        body: 'Buyers and students may open a formal dispute from their Member Dashboard for undelivered freelance milestones, corrupted or inaccessible digital downloads, or inaccurate course/product listings.',
      },
      {
        heading: '2. Administrative Reconciliation',
        body: 'Finance and Trust administrators review project briefs, download audit logs, blockchain transaction hashes (txid), and delivery records before authorizing Pi refunds or revoking disputed entitlements.',
      },
    ],
  },
  seller: {
    title: 'IFIOK-EN Seller & Creator Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Genuine Listings & Creator Ownership',
        body: 'Sellers, instructors, freelancers, and hiring organisations must submit accurate descriptions, verifiable credentials, ownership/distribution proof, and real pricing in Pi (π). Misleading listings, counterfeit digital goods, executable malware, or fabricated reviews result in permanent account suspension.',
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
        heading: '2. Abuse & Safety Reporting',
        body: 'Any community post, classroom message, AI response, or direct message may be flagged by members or students. Flagged items are automatically routed to the Trust & Safety moderation queue.',
      },
    ],
  },
  child_safety: {
    title: 'IFIOK SCHOOL Child Safety & Guardian Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Age-Aware Learning Protections',
        body: 'Learners under 13 (under_13) are blocked from accessing IFIOK Professor AI tutoring until a Parent/Guardian registers, links, and verifies consent. Teen learners (13–17) operate under strict Child Safety content filtering.',
      },
      {
        heading: '2. School Isolation & Safety Officer Oversight',
        body: 'Registered primary and secondary schools designate a Child Safety Officer email and maintain strict tenant isolation: no outsider can view class rosters, homework grades, attendance, or report cards.',
      },
      {
        heading: '3. Zero-Tolerance Reporting',
        body: 'Students, guardians, and teachers can file immediate safety reports from the classroom, school portal, or IFIOK Professor for rapid moderator review.',
      },
    ],
  },
  teacher_content: {
    title: 'IFIOK SCHOOL Teacher Content Contribution Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Editorial & Pedagogical Standards',
        body: 'Educators uploading lesson plans, worksheets, slides, or practice exercises must provide accurate subject/level tags, accessibility notes, and clear learning objectives.',
      },
      {
        heading: '2. Nine-State Moderation Lifecycle & Versioning',
        body: 'Every teacher submission progresses transparently through Draft, Submitted, Under Review, Revision Required, Approved, Published, Rejected, Suspended, or Archived. Only Approved or Published resources enter the public library and IFIOK Professor retrieval index.',
      },
    ],
  },
  ip_policy: {
    title: 'IFIOK-EN Intellectual Property & Takedown Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Mandatory Authorship & Rights Attestation',
        body: 'Uploaders of courses, teacher resources, and IFIOK DIGITAL products must legally attest that content is original or duly licensed for distribution on IFIOK-EN.',
      },
      {
        heading: '2. Notice-and-Takedown Enforcement',
        body: 'Rights holders and members can file a structured Copyright/IP report on any course, teacher contribution, or digital product. Moderators investigate every open notice and can execute immediate suspension (takedown_executed) with full audit logging and owner notification.',
      },
    ],
  },
  digital_licence: {
    title: 'IFIOK DIGITAL End-User Licence Agreement',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Single-Buyer Educational & Business Licence',
        body: 'Each digital download unlocked via verified Pi Testnet settlement grants the purchasing account a personal or internal organizational usage licence as specified on the product listing.',
      },
      {
        heading: '2. Redistribution Restrictions & Cryptographic Integrity',
        body: 'Unless explicitly marked under an open redistribution licence (such as CC BY-NC-SA 4.0), buyers may not resell or redistribute paid files. Every file stored in IFIOK DIGITAL is SHA-256 checksummed, scanned against executable malware signatures, and delivered via expiring single-use signed URLs.',
      },
    ],
  },
  acceptable_use: {
    title: 'IFIOK-EN Acceptable Use & AI Ethics Policy',
    updated: 'Effective November 2026',
    sections: [
      {
        heading: '1. Integrity of Learning & Assessment',
        body: 'IFIOK Professor is designed to teach, clarify uploaded study materials, generate practice quizzes, and offer rubric-based formative feedback. Students must not submit plagiarized work as original institutional coursework.',
      },
      {
        heading: '2. Security & Anti-Abuse Limits',
        body: 'Automated scraping, credential sharing, payment txid replay attempts, or uploading dangerous executables (.exe, .sh, .bat, active scripts) triggers automated security alerts and account suspension.',
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

      <footer className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>© {new Date().getFullYear()} IFIOK-EN · Contact: ifiok82@gmail.com</span>
        <div className="flex items-center gap-4">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              onSwitchPolicy('privacy');
            }}
            className="hover:text-slate-950 dark:hover:text-white underline"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              onSwitchPolicy('terms');
            }}
            className="hover:text-slate-950 dark:hover:text-white underline"
          >
            Terms of Service
          </a>
        </div>
      </footer>
    </main>
  );
}
