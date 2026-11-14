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
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function loadUserWithRoles(userId: number): AuthUser | null {
  const user = db.prepare(`
    SELECT id, email, pi_uid, pi_username, full_name, country, timezone,
           preferred_currency, preferred_language, account_type, status
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
      const payload = jwt.verify(token, JWT_SECRET) as { uid: number };
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
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number };
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
