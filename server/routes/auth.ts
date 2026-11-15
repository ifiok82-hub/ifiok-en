import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { db } from '../db.ts';
import { AppStudioAuthError, exchangePiTokenWithAppStudio } from '../lib/piAppStudioAuth.ts';
import {
  buildOtpAuthUri,
  decryptSensitive,
  encryptSensitive,
  generateTotpSecret,
  verifyTotpCode,
} from '../lib/crypto.ts';
import {
  assignRole,
  clearSessionCookie,
  createNotification,
  loadUserWithRoles,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
  setSessionCookie,
  signMfaPendingToken,
  signSessionToken,
  verifyMfaPendingToken,
} from '../middleware/auth.ts';

const router = Router();

const ALLOWED_ACCOUNT_TYPES = new Set([
  'member',
  'student',
  'instructor',
  'teacher',
  'school_admin',
  'guardian',
  'freelancer',
  'seller',
  'organisation',
]);

const ALLOWED_AGE_GROUPS = new Set(['under_13', 'teen_13_17', 'adult']);
const ALLOWED_EDU_LEVELS = new Set(['primary', 'secondary', 'high_school', 'undergraduate', 'graduate', 'professional']);

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const cleaned = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) || cleaned.length > 180) return null;
  return cleaned;
}

function getAdminCount(): number {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = 'super_admin'
  `).get() as { cnt: number };
  return row.cnt;
}

router.get('/bootstrap-status', (_req, res) => {
  res.json({ bootstrapRequired: getAdminCount() === 0 });
});

router.post('/bootstrap-admin', (req, res) => {
  if (getAdminCount() > 0) {
    return res.status(409).json({ error: 'Global administrator is already configured.' });
  }
  const email = validateEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';

  if (!email) return res.status(400).json({ error: 'Valid administrator email is required.' });
  if (password.length < 10) {
    return res.status(400).json({ error: 'Administrator password must be at least 10 characters.' });
  }
  if (fullName.length < 2) {
    return res.status(400).json({ error: 'Administrator full name is required.' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, country, timezone, account_type, email_verified)
      VALUES (?, ?, ?, 'Global', 'UTC', 'organisation', 1)
    `).run(email, hash, fullName);
    const userId = Number(ins.lastInsertRowid);
    assignRole(userId, 'super_admin', userId);
    assignRole(userId, 'member', userId);
    recordAudit(userId, 'bootstrap_super_admin', 'user', userId, req.ip || '', { email });
    return userId;
  })();

  const user = loadUserWithRoles(result);
  const token = signSessionToken(result);
  setSessionCookie(res, token);
  return res.status(201).json({ user });
});

router.post('/register', (req, res) => {
  const email = validateEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const country = typeof req.body?.country === 'string' && req.body.country.trim() ? req.body.country.trim().slice(0, 80) : 'Global';
  const timezone = typeof req.body?.timezone === 'string' && req.body.timezone.trim() ? req.body.timezone.trim().slice(0, 80) : 'UTC';
  const phoneCountryCode = typeof req.body?.phoneCountryCode === 'string' ? req.body.phoneCountryCode.trim().slice(0, 10) : '+1';
  const phoneNumber = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim().slice(0, 30) : '';
  const preferredCurrency = typeof req.body?.preferredCurrency === 'string' ? req.body.preferredCurrency.trim().slice(0, 10) : 'PI';
  const preferredLanguage = typeof req.body?.preferredLanguage === 'string' ? req.body.preferredLanguage.trim().slice(0, 10) : 'en';
  const rawType = typeof req.body?.accountType === 'string' ? req.body.accountType.trim() : 'member';
  const accountType = ALLOWED_ACCOUNT_TYPES.has(rawType) ? rawType : 'member';
  const educationLevel = ALLOWED_EDU_LEVELS.has(req.body?.educationLevel) ? req.body.educationLevel : 'undergraduate';
  const ageGroup = ALLOWED_AGE_GROUPS.has(req.body?.ageGroup) ? req.body.ageGroup : 'adult';
  const guardianName = typeof req.body?.guardianName === 'string' ? req.body.guardianName.trim().slice(0, 120) : '';
  const guardianEmail = validateEmail(req.body?.guardianEmail) || '';

  if (!email) return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
  }
  if (ageGroup === 'under_13' && (!guardianName || !guardianEmail)) {
    return res.status(400).json({
      error: 'Child protection requirement: Learners under 13 must provide a parent or guardian name and verified email.',
    });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email is already registered.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const userId = db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO users (
        email, password_hash, full_name, phone_country_code, phone_number, phone_number_enc,
        country, timezone, preferred_currency, preferred_language, account_type,
        education_level, age_group, guardian_name, guardian_email, guardian_consent_verified
      ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      email,
      hash,
      fullName,
      phoneCountryCode,
      encryptSensitive(phoneNumber),
      country,
      timezone,
      preferredCurrency,
      preferredLanguage,
      accountType,
      educationLevel,
      ageGroup,
      guardianName,
      guardianEmail,
      ageGroup === 'adult' ? 1 : guardianEmail ? 1 : 0
    );
    const id = Number(ins.lastInsertRowid);
    assignRole(id, 'member', id);
    if (accountType !== 'member') {
      assignRole(id, accountType, id);
    }
    createNotification(
      id,
      'welcome',
      'Welcome to IFIOK-EN',
      'Your account is active. Complete your profile or explore IFIOK SCHOOL, Business Hub, Freelance, Opportunities, Market, and Community.',
      'profile'
    );
    recordAudit(id, 'user_registered', 'user', id, req.ip || '', { accountType, country });
    return id;
  })();

  const user = loadUserWithRoles(userId);
  const token = signSessionToken(userId);
  setSessionCookie(res, token);
  return res.status(201).json({ user });
});

router.post('/login', (req, res) => {
  const email = validateEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const row = db.prepare(`
    SELECT id, password_hash, status, mfa_enabled FROM users WHERE email = ?
  `).get(email) as { id: number; password_hash: string | null; status: string; mfa_enabled: number } | undefined;

  if (!row || !row.password_hash || !bcrypt.compareSync(password, row.password_hash)) {
    recordSecurityEvent('failed_login', 'warning', row?.id ?? null, req.ip || '', `Failed email login attempt for ${email}`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (row.status === 'suspended') {
    recordSecurityEvent('suspended_login_blocked', 'warning', row.id, req.ip || '', `Suspended user attempted login: ${email}`);
    return res.status(403).json({ error: 'Your account is currently suspended. Contact IFIOK-EN support.' });
  }

  if (row.mfa_enabled === 1) {
    const mfaToken = signMfaPendingToken(row.id);
    return res.json({ mfaRequired: true, mfaToken });
  }

  const user = loadUserWithRoles(row.id);
  const token = signSessionToken(row.id);
  setSessionCookie(res, token);
  recordAudit(row.id, 'user_login_email', 'user', row.id, req.ip || '', {});
  return res.json({ user });
});

router.post('/mfa/verify', (req, res) => {
  const mfaToken = typeof req.body?.mfaToken === 'string' ? req.body.mfaToken : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const userId = verifyMfaPendingToken(mfaToken);
  if (!userId) {
    return res.status(401).json({ error: 'MFA verification challenge expired. Please sign in again.' });
  }
  const row = db.prepare(`SELECT mfa_secret_enc, status FROM users WHERE id = ?`).get(userId) as
    | { mfa_secret_enc: string; status: string }
    | undefined;
  if (!row || row.status !== 'active') {
    return res.status(403).json({ error: 'Account unavailable.' });
  }
  const secret = decryptSensitive(row.mfa_secret_enc);
  if (!verifyTotpCode(secret, code)) {
    recordSecurityEvent('mfa_failed', 'warning', userId, req.ip || '', 'Invalid TOTP MFA code entered during login');
    return res.status(401).json({ error: 'Invalid 6-digit authenticator code.' });
  }

  const user = loadUserWithRoles(userId);
  const sessionToken = signSessionToken(userId);
  setSessionCookie(res, sessionToken);
  recordAudit(userId, 'user_login_mfa_verified', 'user', userId, req.ip || '', {});
  return res.json({ user });
});

router.post('/mfa/setup', requireAuth, (req, res) => {
  const secret = generateTotpSecret();
  const label = req.authUser!.email || req.authUser!.pi_username || `user-${req.authUser!.id}`;
  db.prepare(`UPDATE users SET mfa_secret_enc = ?, updated_at = datetime('now') WHERE id = ?`).run(
    encryptSensitive(secret),
    req.authUser!.id
  );
  recordAudit(req.authUser!.id, 'mfa_setup_initiated', 'user', req.authUser!.id, req.ip || '', {});
  return res.json({
    secret,
    otpauthUri: buildOtpAuthUri(label, secret),
  });
});

router.post('/mfa/enable', requireAuth, (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const row = db.prepare(`SELECT mfa_secret_enc FROM users WHERE id = ?`).get(req.authUser!.id) as
    | { mfa_secret_enc: string }
    | undefined;
  if (!row || !row.mfa_secret_enc) {
    return res.status(400).json({ error: 'Initialize MFA setup first.' });
  }
  const secret = decryptSensitive(row.mfa_secret_enc);
  if (!verifyTotpCode(secret, code)) {
    return res.status(400).json({ error: 'Invalid 6-digit authenticator code. Verify your authenticator app time.' });
  }
  db.prepare(`UPDATE users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?`).run(req.authUser!.id);
  recordAudit(req.authUser!.id, 'mfa_enabled', 'user', req.authUser!.id, req.ip || '', {});
  return res.json({ mfaEnabled: true });
});

router.post('/mfa/disable', requireAuth, (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const row = db.prepare(`SELECT mfa_secret_enc, mfa_enabled FROM users WHERE id = ?`).get(req.authUser!.id) as
    | { mfa_secret_enc: string; mfa_enabled: number }
    | undefined;
  if (!row || !row.mfa_enabled) {
    return res.status(400).json({ error: 'MFA is not active on this account.' });
  }
  const secret = decryptSensitive(row.mfa_secret_enc);
  if (!verifyTotpCode(secret, code)) {
    return res.status(401).json({ error: 'Valid 6-digit authenticator code required to disable MFA.' });
  }
  db.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret_enc = '', updated_at = datetime('now') WHERE id = ?`).run(
    req.authUser!.id
  );
  recordAudit(req.authUser!.id, 'mfa_disabled', 'user', req.authUser!.id, req.ip || '', {});
  return res.json({ mfaEnabled: false });
});

router.post('/pi', async (req, res) => {
  const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  if (!accessToken) {
    return res.status(400).json({ error: 'Official Pi Network accessToken is required.' });
  }

  try {
    // Exchange accessToken with App Studio; ignore any browser-supplied uid or username
    const appStudio = await exchangePiTokenWithAppStudio(accessToken);
    const piUser = appStudio.user;

    const existing = db.prepare(`SELECT id, status FROM users WHERE pi_uid = ?`).get(piUser.uid) as
      | { id: number; status: string }
      | undefined;

    if (existing && existing.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is currently suspended.' });
    }

    let userId: number;
    if (!existing) {
      userId = db.transaction(() => {
        const ins = db.prepare(`
          INSERT INTO users (pi_uid, pi_username, full_name, account_type)
          VALUES (?, ?, ?, 'member')
        `).run(piUser.uid, piUser.username, piUser.username);
        const id = Number(ins.lastInsertRowid);
        assignRole(id, 'member', id);
        createNotification(
          id,
          'welcome',
          'Pi Account Connected',
          `Verified Pi Network username @${piUser.username} connected.`,
          'profile'
        );
        recordAudit(id, 'user_registered_pi', 'user', id, req.ip || '', { pi_username: piUser.username });
        return id;
      })();
    } else {
      userId = existing.id;
      db.prepare(`UPDATE users SET pi_username = ?, updated_at = datetime('now') WHERE id = ?`).run(
        piUser.username,
        userId
      );
      recordAudit(userId, 'user_login_pi', 'user', userId, req.ip || '', { pi_username: piUser.username });
    }

    const user = loadUserWithRoles(userId);
    const token = signSessionToken(userId);
    setSessionCookie(res, token, req);
    return res.json({ user, sessionToken: token });
  } catch (err) {
    if (err instanceof AppStudioAuthError) {
      recordSecurityEvent('pi_auth_rejected', 'warning', null, req.ip || '', err.message.slice(0, 180));
      return res.status(err.statusCode).json({ error: err.message });
    }
    recordSecurityEvent('pi_auth_error', 'warning', null, req.ip || '', String(err));
    return res.status(502).json({ error: 'Unable to reach App Studio Pi authentication server.' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const full = db.prepare(`
    SELECT id, email, pi_uid, pi_username, full_name, bio, phone_country_code, phone_number, phone_number_enc,
           country, timezone, preferred_currency, preferred_language, account_type, status, email_verified, mfa_enabled,
           education_level, age_group, guardian_name, guardian_email, guardian_consent_verified, created_at
    FROM users WHERE id = ?
  `).get(req.authUser!.id) as Record<string, unknown>;
  const decryptedPhone = full.phone_number_enc ? decryptSensitive(String(full.phone_number_enc)) : String(full.phone_number || '');
  const { phone_number_enc: _omit, ...safe } = full;
  res.json({ user: { ...safe, phone_number: decryptedPhone, roles: req.authUser!.roles } });
});

router.patch('/profile', requireAuth, (req, res) => {
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : req.authUser!.full_name;
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim().slice(0, 600) : '';
  const phoneCountryCode = typeof req.body?.phoneCountryCode === 'string' ? req.body.phoneCountryCode.trim().slice(0, 10) : '+1';
  const phoneNumber = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim().slice(0, 30) : '';
  const country = typeof req.body?.country === 'string' && req.body.country.trim() ? req.body.country.trim().slice(0, 80) : req.authUser!.country;
  const timezone = typeof req.body?.timezone === 'string' && req.body.timezone.trim() ? req.body.timezone.trim().slice(0, 80) : req.authUser!.timezone;
  const preferredCurrency = typeof req.body?.preferredCurrency === 'string' ? req.body.preferredCurrency.trim().slice(0, 10) : req.authUser!.preferred_currency;
  const preferredLanguage = typeof req.body?.preferredLanguage === 'string' ? req.body.preferredLanguage.trim().slice(0, 10) : req.authUser!.preferred_language;
  const educationLevel = ALLOWED_EDU_LEVELS.has(req.body?.educationLevel)
    ? req.body.educationLevel
    : req.authUser!.education_level || 'undergraduate';
  const guardianName = typeof req.body?.guardianName === 'string' ? req.body.guardianName.trim().slice(0, 120) : '';
  const guardianEmail = validateEmail(req.body?.guardianEmail) || '';

  if (fullName.length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
  }

  db.prepare(`
    UPDATE users
    SET full_name = ?, bio = ?, phone_country_code = ?, phone_number = '', phone_number_enc = ?,
        country = ?, timezone = ?, preferred_currency = ?, preferred_language = ?,
        education_level = ?,
        guardian_name = CASE WHEN ? != '' THEN ? ELSE guardian_name END,
        guardian_email = CASE WHEN ? != '' THEN ? ELSE guardian_email END,
        guardian_consent_verified = CASE WHEN ? != '' THEN 1 ELSE guardian_consent_verified END,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    fullName,
    bio,
    phoneCountryCode,
    encryptSensitive(phoneNumber),
    country,
    timezone,
    preferredCurrency,
    preferredLanguage,
    educationLevel,
    guardianName,
    guardianName,
    guardianEmail,
    guardianEmail,
    guardianEmail,
    req.authUser!.id
  );

  recordAudit(req.authUser!.id, 'profile_updated', 'user', req.authUser!.id, req.ip || '', {
    country,
    timezone,
    preferredLanguage,
    educationLevel,
  });
  const updated = db.prepare(`
    SELECT id, email, pi_uid, pi_username, full_name, bio, phone_country_code,
           country, timezone, preferred_currency, preferred_language, account_type, status, email_verified, mfa_enabled,
           education_level, age_group, guardian_name, guardian_email, guardian_consent_verified, created_at
    FROM users WHERE id = ?
  `).get(req.authUser!.id) as Record<string, unknown>;
  return res.json({ user: { ...updated, phone_number: phoneNumber, roles: req.authUser!.roles } });
});

export default router;
