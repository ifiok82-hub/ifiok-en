import { SEED_COURSES, SEED_MARKET_LISTINGS } from '../../../../src/lib/seed.ts';
import {
  applyPiCors,
  sendJson,
  verifyUnlockToken,
  type VercelReq,
  type VercelRes,
} from '../../../../server/lib/vercelPayments.ts';

function getPathParam(req: VercelReq, key: string, fallbackIdx: number): string {
  const fromQ = req.query?.[key];
  if (typeof fromQ === 'string') return fromQ;
  if (Array.isArray(fromQ) && typeof fromQ[0] === 'string') return fromQ[0];
  const parts = (req.url || '/').split('?')[0].split('/').filter(Boolean);
  return parts[parts.length - fallbackIdx] || '';
}

export default function handler(req: VercelReq, res: VercelRes) {
  applyPiCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const itemType = getPathParam(req, 'itemType', 2);
  const itemId = Number(getPathParam(req, 'itemId', 1));
  if (!['product', 'course'].includes(itemType) || !itemId) {
    return sendJson(res, 400, { error: 'Invalid entitlement query.' });
  }

  const rawToken =
    typeof req.headers['x-ifiok-unlock-token'] === 'string'
      ? req.headers['x-ifiok-unlock-token'].trim()
      : '';
  const verified = rawToken ? verifyUnlockToken(rawToken) : null;
  const hasValidUnlock = Boolean(verified && verified.itemType === itemType && verified.itemId === itemId);

  if (itemType === 'product') {
    const prod = SEED_MARKET_LISTINGS.find((p) => p.id === itemId);
    if (!prod) return sendJson(res, 404, { error: 'Digital product not found.' });
    if (!hasValidUnlock) {
      return sendJson(res, 402, {
        unlocked: false,
        error: 'Content is locked until server verifies Pi Network payment completion.',
      });
    }
    return sendJson(res, 200, {
      unlocked: true,
      unlockedAt: new Date().toISOString(),
      title: prod.title,
      content: `${prod.description}\n\nVerified IFIOK DIGITAL Package Ready for Download.\nSupport: ${prod.support_info || 'ifiok82@gmail.com'}`,
      hasFile: true,
      fileOriginalName: prod.file_original_name || `${prod.title.replace(/\s+/g, '_')}.pdf`,
      fileFormat: prod.file_format || 'PDF',
      fileSizeBytes: 0,
      version: prod.version || '1.0.0',
    });
  }

  const course = SEED_COURSES.find((c) => c.id === itemId);
  if (!course) return sendJson(res, 404, { error: 'Course not found.' });
  const isFree = Number(course.price_pi) === 0;
  if (!hasValidUnlock && !isFree) {
    return sendJson(res, 402, {
      unlocked: false,
      error: 'Content is locked until server verifies Pi Network payment completion.',
    });
  }

  let syllabus: string[] = [];
  try {
    const parsed = JSON.parse(course.syllabus_json || '[]');
    if (Array.isArray(parsed)) syllabus = parsed.map(String);
  } catch {
    syllabus = [];
  }

  return sendJson(res, 200, {
    unlocked: true,
    unlockedAt: new Date().toISOString(),
    title: course.title,
    content: `${course.description}\n\nSyllabus Modules:\n${syllabus.map((s) => `- ${s}`).join('\n')}`,
    courseFiles: [
      {
        storageKey: `${course.slug}.pdf`,
        originalName: `${course.slug}.pdf`,
        fileFormat: 'PDF',
        fileSizeBytes: 0,
      },
    ],
  });
}
