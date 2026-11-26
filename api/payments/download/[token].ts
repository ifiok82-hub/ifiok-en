import {
  applyPiCors,
  buildUnlockedCourseOrProductPdf,
  sendJson,
  verifyUnlockToken,
  type VercelReq,
  type VercelRes,
} from '../../../server/lib/vercelPayments.ts';

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

  const rawFromQuery = req.query?.token;
  const tokenFromQuery = Array.isArray(rawFromQuery) ? rawFromQuery[0] : rawFromQuery;
  const pathParts = (req.url || '/').split('?')[0].split('/').filter(Boolean);
  const token = decodeURIComponent(tokenFromQuery || pathParts[pathParts.length - 1] || '');

  const verified = verifyUnlockToken(token);
  if (!verified || (verified.itemType !== 'course' && verified.itemType !== 'product')) {
    return sendJson(res, 403, { error: 'Invalid or expired download token.' });
  }

  const asset = buildUnlockedCourseOrProductPdf(verified.itemType, verified.itemId);
  if (!asset) {
    return sendJson(res, 404, { error: 'Digital asset not found.' });
  }

  const cleanFileName = asset.fileName.replace(/["\r\n]/g, '_');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
  res.end(asset.buffer);
}
