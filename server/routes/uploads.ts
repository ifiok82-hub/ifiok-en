import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { UPLOADS_DIR } from '../db.ts';
import { containsMaliciousScriptSignature, detectSafeImageMime } from '../lib/crypto.ts';
import { recordAudit, recordSecurityEvent, requireAuth } from '../middleware/auth.ts';

const router = Router();

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

router.post('/image', requireAuth, (req, res) => {
  const rawBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
  if (!rawBase64) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const cleaned = rawBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleaned, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 image payload.' });
  }

  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    return res.status(400).json({ error: 'Image must be between 1 byte and 2 MB.' });
  }

  const detected = detectSafeImageMime(buffer);
  if (!detected) {
    recordSecurityEvent(
      'upload_invalid_signature',
      'warning',
      req.authUser!.id,
      req.ip || '',
      'Rejected file upload with unsupported or spoofed magic bytes'
    );
    return res.status(400).json({ error: 'Only verified PNG, JPEG, or WEBP image signatures are accepted.' });
  }

  if (containsMaliciousScriptSignature(buffer)) {
    recordSecurityEvent(
      'upload_malware_signature_blocked',
      'critical',
      req.authUser!.id,
      req.ip || '',
      'Blocked upload containing embedded script or PHP signature'
    );
    return res.status(400).json({ error: 'Security scan rejected this file due to embedded active script patterns.' });
  }

  const fileName = `ifiok_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${detected.ext}`;
  const targetPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(targetPath, buffer, { mode: 0o644 });

  recordAudit(req.authUser!.id, 'image_uploaded', 'upload', fileName, req.ip || '', {
    mime: detected.mime,
    bytes: buffer.length,
  });

  return res.status(201).json({
    url: `/api/uploads/${fileName}`,
    mime: detected.mime,
    bytes: buffer.length,
  });
});

router.get('/:fileName', (req, res) => {
  const safeName = path.basename(String(req.params.fileName || ''));
  if (!/^ifiok_\d+_[a-f0-9]+\.(jpg|png|webp)$/i.test(safeName)) {
    return res.status(400).json({ error: 'Invalid image path.' });
  }
  const targetPath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Image not found.' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(targetPath);
});

export default router;
