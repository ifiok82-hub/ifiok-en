import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
export const COOKIE_NAME = 'ifiok_session';

export interface AuthUser {
  id: number;
  email: string | null;
  pi_uid: string | null;
  pi_username: string | null;
  full_name: string;
  country: string;
  timezone: string;
  preferred_currency: string;
  preferred_language: string;
  account_type: string;
  status: string;
  mfa_enabled: number;
  education_level?: string;
  age_group?: string;
  guardian_consent_verified?: number;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function signSessionToken(userId: number): string {
  return jwt.sign({ uid: userId, scope: 'session' }, JWT_SECRET, { expiresIn: '7d' });
}

export function signMfaPendingToken(userId: number): string {
  return jwt.sign({ uid: userId, scope: 'mfa_pending' }, JWT_SECRET, { expiresIn: '5m' });
}

export function verifyMfaPendingToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number; scope?: string };
    if (payload.scope !== 'mfa_pending') return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string, req?: Request) {
  const isHttps =
    process.env.NODE_ENV === 'production' ||
    Boolean(req?.secure) ||
    req?.headers['x-forwarded-proto'] === 'https';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, req?: Request) {
  const isHttps =
    process.env.NODE_ENV === 'production' ||
    Boolean(req?.secure) ||
    req?.headers['x-forwarded-proto'] === 'https';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

export function loadUserWithRoles(userId: number): AuthUser | null {
  const user = db.prepare(`
    SELECT id, email, pi_uid, pi_username, full_name, country, timezone,
           preferred_currency, preferred_language, account_type, status, mfa_enabled,
           education_level, age_group, guardian_consent_verified
    FROM users WHERE id = ?
  `).get(userId) as Omit<AuthUser, 'roles'> | undefined;

  if (!user) return null;

  const roleRows = db.prepare(`
    SELECT r.slug FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
  `).all(userId) as Array<{ slug: string }>;

  return {
    ...user,
    roles: roleRows.map((r) => r.slug),
  };
}

export function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { uid: number; scope?: string };
      if (payload.scope && payload.scope !== 'session') return next();
      const user = loadUserWithRoles(payload.uid);
      if (user && user.status === 'active') {
        req.authUser = user;
      }
    } catch {
      // Invalid token ignored in optionalAuth
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number; scope?: string };
    if (payload.scope && payload.scope !== 'session') {
      return res.status(401).json({ error: 'Multi-factor verification required to complete login.' });
    }
    const user = loadUserWithRoles(payload.uid);
    if (!user) {
      return res.status(401).json({ error: 'Session account no longer exists.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Contact support for review.' });
    }
    req.authUser = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const host = req.headers.host;
  const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'].split(',')[0].trim() : '';
  if (origin && (host || forwardedHost)) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host && (!forwardedHost || originHost !== forwardedHost)) {
        recordSecurityEvent('csrf_origin_mismatch', 'warning', null, req.ip || '', `Origin ${originHost} != Host ${host}`);
        return res.status(403).json({ error: 'Cross-origin state mutation blocked by CSRF policy.' });
      }
    } catch {
      return res.status(403).json({ error: 'Malformed request origin.' });
    }
  }
  return next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const hasRole = req.authUser.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      recordSecurityEvent(
        'rbac_denied',
        'warning',
        req.authUser.id,
        req.ip || '',
        `Access denied to ${req.method} ${req.originalUrl}; required one of [${allowedRoles.join(', ')}]`
      );
      return res.status(403).json({ error: 'Insufficient role permissions for this action.' });
    }
    return next();
  };
}

export function assignRole(userId: number, roleSlug: string, assignedBy?: number) {
  const role = db.prepare(`SELECT id FROM roles WHERE slug = ?`).get(roleSlug) as { id: number } | undefined;
  if (!role) return;
  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by)
    VALUES (?, ?, ?)
  `).run(userId, role.id, assignedBy ?? null);
}

export function recordAudit(
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: string | number,
  ipAddress: string,
  details: Record<string, unknown> = {}
) {
  db.prepare(`
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, ip_address, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorUserId, action, entityType, String(entityId), ipAddress, JSON.stringify(details));
}

export function createSecurityAlert(
  alertType: string,
  severity: 'info' | 'warning' | 'critical',
  userId: number | null,
  ipAddress: string,
  summary: string
) {
  db.prepare(`
    INSERT INTO security_alerts (alert_type, severity, user_id, ip_address, summary)
    VALUES (?, ?, ?, ?, ?)
  `).run(alertType, severity, userId, ipAddress, summary);
}

export function recordSecurityEvent(
  eventType: string,
  severity: 'info' | 'warning' | 'critical',
  userId: number | null,
  ipAddress: string,
  details: string
) {
  db.prepare(`
    INSERT INTO security_events (event_type, severity, user_id, ip_address, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventType, severity, userId, ipAddress, details);
  if (severity === 'critical') {
    createSecurityAlert(eventType, severity, userId, ipAddress, details);
  }
}

export function createNotification(
  userId: number,
  category: string,
  title: string,
  message: string,
  linkTab = 'overview'
) {
  db.prepare(`
    INSERT INTO notifications (user_id, category, title, message, link_tab)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, category, title, message, linkTab);
}
