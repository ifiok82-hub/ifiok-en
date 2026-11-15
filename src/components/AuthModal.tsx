import { ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import { COUNTRIES, EDUCATION_LEVELS, LANGUAGE_OPTIONS, PHONE_CODES, TIMEZONES } from '../lib/i18n.ts';
import { authenticateWithPi, isPiSdkAvailable } from '../lib/pi.ts';
import type { LanguageCode, UserProfile } from '../types/platform.ts';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, initialMode = 'login', onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'bootstrap'>(initialMode);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState('member');
  const [country, setCountry] = useState('Global');
  const [timezone, setTimezone] = useState('UTC');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('en');
  const [educationLevel, setEducationLevel] = useState('undergraduate');
  const [ageGroup, setAgeGroup] = useState<'adult' | 'teen_13_17' | 'under_13'>('adult');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setMfaToken(null);
    setMfaCode('');
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    apiRequest<{ bootstrapRequired: boolean }>('/api/auth/bootstrap-status')
      .then((res) => setBootstrapRequired(res.bootstrapRequired))
      .catch(() => setBootstrapRequired(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ user?: UserProfile; mfaRequired?: boolean; mfaToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken);
        setMfaCode('');
        return;
      }
      if (res.user) {
        onAuthenticated(res.user);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code: mfaCode.trim() }),
      });
      setMfaToken(null);
      setMfaCode('');
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          accountType,
          country,
          timezone,
          preferredLanguage,
          educationLevel,
          ageGroup,
          guardianName: ageGroup === 'under_13' ? guardianName : undefined,
          guardianEmail: ageGroup === 'under_13' ? guardianEmail : undefined,
          phoneCountryCode,
          phoneNumber,
        }),
      });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrator setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePiAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authenticateWithPi();
      onAuthenticated(res.user as UserProfile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pi Network authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="auth-modal-title" className="text-lg font-display font-bold text-slate-900 dark:text-white">
            {mfaToken
              ? 'Two-Factor Authentication Required'
              : mode === 'login'
                ? 'Sign in to IFIOK-EN'
                : mode === 'register'
                  ? 'Create your IFIOK-EN Account'
                  : 'Initialize Global Administrator'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!mfaToken && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#162244] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-[#162244] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Join IFIOK-EN
              </button>
              {bootstrapRequired && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('bootstrap');
                    setError('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    mode === 'bootstrap'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  Admin Setup
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
              {error}
            </div>
          )}

          {mfaToken ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Enter the 6-digit verification code from your TOTP authenticator application to unlock your session.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMfaToken(null);
                    setMfaCode('');
                    setError('');
                  }}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold text-sm hover:bg-[#192A54] dark:hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {mode !== 'bootstrap' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePiAuth}
                    className="w-full py-2.5 px-4 rounded-lg border border-amber-500/60 bg-amber-50/70 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 font-semibold text-sm hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Continue with Official Pi Network (Testnet)
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    {isPiSdkAvailable()
                      ? 'Pi Browser SDK detected. Your Pi identity is verified server-side via api.minepi.com.'
                      : 'Pi authentication activates automatically inside Pi Browser. Email authentication works in any browser.'}
                  </p>
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-[#0D152B] px-3 text-slate-500">or use Email Authentication</span>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@organization.org"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold text-sm hover:bg-[#192A54] dark:hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adaeze Okafor"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account Role</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="member">Member</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="school_admin">School Administrator</option>
                    <option value="guardian">Parent / Guardian</option>
                    <option value="instructor">IFIOK SCHOOL Educator / Instructor</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="seller">Marketplace Seller</option>
                    <option value="organisation">Business / Organisation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Preferred Language</label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeLabel} — {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Time Zone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                  <select
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>
                        {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Age Tier</label>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value as typeof ageGroup)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="adult">Adult (18+)</option>
                    <option value="teen_13_17">Teen (13–17)</option>
                    <option value="under_13">Under 13 (Guardian Required)</option>
                  </select>
                </div>
              </div>

              {ageGroup === 'under_13' && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Child Protection: Parent or Guardian Details Required
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent / Guardian Full Name"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                    <input
                      type="email"
                      required
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="Guardian Email Address"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  International Phone (Optional)
                </label>
                <div className="flex gap-2">
                  <select
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-2.5 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {PHONE_CODES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="800 000 0000"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold text-sm hover:bg-[#192A54] dark:hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'bootstrap' && bootstrapRequired && (
            <form onSubmit={handleBootstrapAdmin} className="space-y-4">
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  One-time platform setup: no Global Super Administrator exists yet. Creating this account permanently locks initial setup.
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Administrator Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Global Administrator"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Administrator Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@organization.org"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Strong Password (min. 10 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#081024] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Provisioning Admin...' : 'Claim Global Administrator Role'}
              </button>
            </form>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
