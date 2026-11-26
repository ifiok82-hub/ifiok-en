import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DEFAULT_PLATFORM_SETTINGS,
  SEED_COURSES,
  SEED_FREELANCE_SERVICES,
  SEED_MARKET_LISTINGS,
} from '../../src/lib/seed.ts';
import { buildValidPdf } from './documentBuilder.ts';

export const PI_TESTNET_API_BASE = 'https://api.testnet.minepi.com/v2';

const ALLOWED_ORIGINS = new Set([
  'https://ifiok-en.vercel.app',
  'https://ifiokenu4714.pinet.com',
]);

export type VercelReq = IncomingMessage & {
  body?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
};
export type VercelRes = ServerResponse;

export interface PiPaymentRecord {
  identifier?: string;
  user_uid?: string;
  amount?: number;
  direction?: string;
  network?: string;
  memo?: string;
  metadata?: {
    app?: string;
    type?: string;
    orderId?: number | string;
    orderType?: string;
    referenceId?: number | string;
    quantity?: number | string;
    planSlug?: string;
    [key: string]: unknown;
  } | null;
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

export function applyPiCors(req: VercelReq, res: VercelRes) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (
    ALLOWED_ORIGINS.has(origin) ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.pinet.com') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://ifiok-en.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-pi-access-token, x-ifiok-unlock-token'
  );
}

export async function readJsonBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function sendJson(res: VercelRes, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function getPiApiKey(): string {
  return process.env.PI_API_KEY?.trim() || process.env.PI_NETWORK_API_KEY?.trim() || '';
}

function getHmacSecret(): string | null {
  const raw =
    process.env.JWT_SECRET?.trim() ||
    process.env.DOWNLOAD_TOKEN_SECRET?.trim() ||
    getPiApiKey();
  if (!raw || raw.length < 10) return null;
  return crypto.createHash('sha256').update(`ifiok-unlock-v1:${raw}`).digest('hex');
}

export interface UnlockTokenPayload {
  itemType: 'course' | 'product' | 'service' | 'subscription';
  itemId: number;
  planSlug?: string;
  paymentId: string;
  txid: string;
  exp: number;
}

export function signUnlockToken(
  payload: Omit<UnlockTokenPayload, 'exp'>,
  ttlSeconds = 30 * 24 * 60 * 60
): string | null {
  const secret = getHmacSecret();
  if (!secret) return null;
  const full: UnlockTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyUnlockToken(token: string): UnlockTokenPayload | null {
  const secret = getHmacSecret();
  if (!secret || !token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const body = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UnlockTokenPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export type CatalogIntentResult =
  | {
      ok: true;
      freeEnrolled?: boolean;
      orderId: number;
      orderType: 'course' | 'product' | 'service' | 'subscription';
      referenceId: number;
      quantity: number;
      planSlug?: string;
      itemTitle: string;
      subtotalPi: number;
      platformFeePi: number;
      amountPi: number;
      memo: string;
      unlockToken?: string | null;
      message?: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

export function resolveCatalogIntent(body: Record<string, unknown>): CatalogIntentResult {
  const orderType = typeof body.orderType === 'string' ? body.orderType.trim() : '';
  const referenceId = Number(body.referenceId || 0);
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(body.quantity) || 1)));
  const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
  const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : '';
  const orderId = Math.max(1000, Math.floor(Date.now() % 1_000_000_000));

  if (orderType === 'course') {
    const course = SEED_COURSES.find((c) => c.id === referenceId);
    if (!course) {
      return { ok: false, statusCode: 404, error: 'Approved course not found.' };
    }
    const pricePi = Number(course.price_pi || 0);
    const itemTitle = `Course Enrolment: ${course.title}`;
    if (pricePi === 0) {
      const unlockToken = signUnlockToken({
        itemType: 'course',
        itemId: course.id,
        paymentId: `free-course-${course.id}`,
        txid: 'free-enrolment',
      });
      return {
        ok: true,
        freeEnrolled: true,
        orderId,
        orderType: 'course',
        referenceId: course.id,
        quantity: 1,
        itemTitle,
        subtotalPi: 0,
        platformFeePi: 0,
        amountPi: 0,
        memo: itemTitle.slice(0, 120),
        unlockToken,
        message: `Enrolled in free course "${course.title}".`,
      };
    }
    return {
      ok: true,
      orderId,
      orderType: 'course',
      referenceId: course.id,
      quantity: 1,
      itemTitle,
      subtotalPi: pricePi,
      platformFeePi: 0,
      amountPi: Number(pricePi.toFixed(4)),
      memo: itemTitle.slice(0, 120),
    };
  }

  if (orderType === 'product') {
    const product = SEED_MARKET_LISTINGS.find((p) => p.id === referenceId);
    if (!product) {
      return { ok: false, statusCode: 404, error: 'Approved marketplace product not found.' };
    }
    if (product.stock_qty < quantity || product.availability_status === 'out_of_stock') {
      return { ok: false, statusCode: 400, error: 'Requested product quantity is unavailable.' };
    }
    const subtotalPi = Number((Number(product.price_pi) * quantity).toFixed(4));
    const commPct = Number(DEFAULT_PLATFORM_SETTINGS.marketplaceCommissionPct || 5);
    const platformFeePi = Number(((subtotalPi * commPct) / 100).toFixed(4));
    const totalPi = Number((subtotalPi + platformFeePi).toFixed(4));
    const itemTitle = `${product.title} (x${quantity})`;
    return {
      ok: true,
      orderId,
      orderType: 'product',
      referenceId: product.id,
      quantity,
      itemTitle,
      subtotalPi,
      platformFeePi,
      amountPi: totalPi,
      memo: itemTitle.slice(0, 120),
    };
  }

  if (orderType === 'service') {
    const service = SEED_FREELANCE_SERVICES.find((s) => s.id === referenceId);
    if (!service) {
      return { ok: false, statusCode: 404, error: 'Approved freelance service not found.' };
    }
    if (brief.length < 5) {
      return { ok: false, statusCode: 400, error: 'Please include a short project brief (at least 5 characters).' };
    }
    const subtotalPi = Number(service.price_pi);
    const commPct = Number(DEFAULT_PLATFORM_SETTINGS.freelanceCommissionPct || 8);
    const platformFeePi = Number(((subtotalPi * commPct) / 100).toFixed(4));
    const totalPi = Number((subtotalPi + platformFeePi).toFixed(4));
    const itemTitle = `Freelance Service: ${service.title}`;
    return {
      ok: true,
      orderId,
      orderType: 'service',
      referenceId: service.id,
      quantity: 1,
      itemTitle,
      subtotalPi,
      platformFeePi,
      amountPi: totalPi,
      memo: itemTitle.slice(0, 120),
    };
  }

  if (orderType === 'subscription') {
    const prices: Record<string, number> = {
      pro_creator: Number(DEFAULT_PLATFORM_SETTINGS.subscriptionProPi || 12),
      verified_business: Number(DEFAULT_PLATFORM_SETTINGS.subscriptionBusinessPi || 35),
      enterprise: Number(DEFAULT_PLATFORM_SETTINGS.subscriptionEnterprisePi || 90),
    };
    const price = prices[planSlug];
    if (!price) {
      return { ok: false, statusCode: 400, error: 'Invalid subscription plan selected.' };
    }
    const itemTitle = `IFIOK-EN Subscription (${planSlug.replace('_', ' ')})`;
    return {
      ok: true,
      orderId,
      orderType: 'subscription',
      referenceId: 0,
      quantity: 1,
      planSlug,
      itemTitle,
      subtotalPi: price,
      platformFeePi: 0,
      amountPi: Number(price.toFixed(4)),
      memo: itemTitle.slice(0, 120),
    };
  }

  return { ok: false, statusCode: 400, error: 'Unsupported order type.' };
}

export function validateU2ATestnetPayment(
  payment: PiPaymentRecord,
  expectedPaymentId: string,
  expectedAmountPi?: number
): { valid: true } | { valid: false; statusCode: number; error: string } {
  if (payment.identifier && payment.identifier !== expectedPaymentId) {
    return { valid: false, statusCode: 400, error: 'Payment identifier mismatch.' };
  }
  if (payment.direction && payment.direction !== 'user_to_app') {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid payment direction (${payment.direction}). Expected user_to_app.`,
    };
  }
  if (payment.network && !payment.network.toLowerCase().includes('testnet')) {
    return {
      valid: false,
      statusCode: 403,
      error: `Only Pi Testnet payments are permitted (received ${payment.network}).`,
    };
  }
  if (typeof payment.amount !== 'number' || payment.amount <= 0) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid Pi payment amount (${payment.amount ?? 'unknown'}).`,
    };
  }
  if (typeof expectedAmountPi === 'number' && expectedAmountPi > 0) {
    if (Math.abs(payment.amount - expectedAmountPi) > 0.0001) {
      return {
        valid: false,
        statusCode: 400,
        error: `Payment amount mismatch (expected ${expectedAmountPi} Pi, got ${payment.amount} Pi).`,
      };
    }
  }
  if (payment.metadata?.app && payment.metadata.app !== 'ifiok-en') {
    return { valid: false, statusCode: 403, error: 'Payment metadata does not belong to IFIOK-EN.' };
  }
  return { valid: true };
}

export function buildUnlockedCourseOrProductPdf(
  itemType: 'course' | 'product',
  itemId: number
): { fileName: string; buffer: Buffer } | null {
  if (itemType === 'course') {
    const course = SEED_COURSES.find((c) => c.id === itemId);
    if (!course) return null;
    let syllabus: string[] = [];
    try {
      const parsed = JSON.parse(course.syllabus_json || '[]');
      if (Array.isArray(parsed)) syllabus = parsed.map(String);
    } catch {
      syllabus = [];
    }
    let objectives: string[] = [];
    try {
      const parsed = JSON.parse(course.learning_objectives_json || '[]');
      if (Array.isArray(parsed)) objectives = parsed.map(String);
    } catch {
      objectives = [];
    }
    const buf = buildValidPdf({
      title: course.title,
      subtitle: `${course.subject || course.category} · ${course.level} · ${course.duration_hours} hours`,
      author: course.author_name || 'IFIOK-EN Editorial Faculty',
      date: course.publication_date || '2026-11-18',
      rights: course.rights_info || course.copyright_permission || 'Original IFIOK-EN Curriculum Work',
      sections: [
        {
          heading: 'Course Description & Audience',
          lines: [
            course.description,
            `Prerequisites: ${course.prerequisites || 'None'}`,
            `Target Audience: ${course.target_audience || 'Global Learners'}`,
          ],
        },
        {
          heading: 'Learning Objectives',
          lines: objectives.length > 0 ? objectives : ['Master foundational concepts and practical problem solving.'],
        },
        {
          heading: 'Course Syllabus & Study Modules',
          lines: syllabus.length > 0 ? syllabus : ['Modules 1-4 Study Guide'],
        },
      ],
    });
    return {
      fileName: `${course.slug || `ifiok-course-${course.id}`}.pdf`,
      buffer: buf,
    };
  }

  const product = SEED_MARKET_LISTINGS.find((p) => p.id === itemId);
  if (!product) return null;
  let highlights: string[] = [];
  try {
    const parsed = JSON.parse(product.preview_images_json || '[]');
    if (Array.isArray(parsed)) highlights = parsed.map(String);
  } catch {
    highlights = [];
  }
  const buf = buildValidPdf({
    title: product.title,
    subtitle: `${product.category} · Version ${product.version || '1.0.0'}`,
    author: product.store_name || 'IFIOK DIGITAL Official Publishing',
    date: '2026-11-18',
    rights: product.distribution_permission || 'IFIOK-EN Single-Buyer License',
    sections: [
      {
        heading: 'Package Overview',
        lines: [product.description, `Support: ${product.support_info || 'ifiok82@gmail.com'}`],
      },
      {
        heading: 'Included Deliverables & Templates',
        lines: highlights.length > 0 ? highlights : ['Complete verified digital package'],
      },
    ],
  });
  const safeBase = product.title.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return {
    fileName: `${safeBase}_v${product.version || '1.0.0'}.pdf`,
    buffer: buf,
  };
}
