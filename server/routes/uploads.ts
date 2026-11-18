import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { db, PRIVATE_ASSETS_DIR, UPLOADS_DIR } from '../db.ts';
import {
  containsExecutableSignature,
  containsMaliciousScriptSignature,
  detectSafeDigitalFile,
  detectSafeImageMime,
} from '../lib/crypto.ts';
import { recordAudit, recordSecurityEvent, requireAuth } from '../middleware/auth.ts';

const router = Router();

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB for public images
const MAX_DIGITAL_ASSET_BYTES = 15 * 1024 * 1024; // 15 MB for private digital vault assets

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

function handlePrivateAssetUpload(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
  prefix: 'asset' | 'course_mat'
) {
  const rawBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
  const rawFileName = typeof req.body?.fileName === 'string' ? path.basename(req.body.fileName.trim()) : '';

  if (!rawBase64 || !rawFileName) {
    return res.status(400).json({ error: 'File name and base64 file content are required.' });
  }

  const cleaned = rawBase64.replace(/^data:[^;]+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleaned, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 file payload.' });
  }

  if (buffer.length === 0 || buffer.length > MAX_DIGITAL_ASSET_BYTES) {
    return res.status(400).json({ error: 'Digital asset must be between 1 byte and 15 MB.' });
  }

  if (containsExecutableSignature(buffer) || containsMaliciousScriptSignature(buffer)) {
    recordSecurityEvent(
      'private_asset_malware_blocked',
      'critical',
      req.authUser!.id,
      req.ip || '',
      `Blocked dangerous executable or script file upload (${rawFileName})`
    );
    return res.status(400).json({
      error: 'Security scan failed: executable binaries and active script payloads (.exe, .sh, <script, <?php, <svg) are strictly prohibited.',
    });
  }

  const detected = detectSafeDigitalFile(buffer, rawFileName);
  if (!detected) {
    recordSecurityEvent(
      'private_asset_invalid_signature',
      'warning',
      req.authUser!.id,
      req.ip || '',
      `Rejected unsupported or spoofed digital asset upload (${rawFileName})`
    );
    return res.status(400).json({
      error:
        'Unsupported or spoofed file signature. Accepted formats: PDF, ZIP, DOCX, XLSX, PPTX, MP3, MP4, PNG, JPEG, WEBP, TXT, MD, CSV.',
    });
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storageKey = `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  const targetPath = path.join(PRIVATE_ASSETS_DIR, storageKey);
  fs.writeFileSync(targetPath, buffer, { mode: 0o600 });

  recordAudit(req.authUser!.id, 'private_asset_uploaded', 'private_asset', storageKey, req.ip || '', {
    originalName: rawFileName,
    format: detected.formatLabel,
    bytes: buffer.length,
    sha256,
  });

  return res.status(201).json({
    storageKey,
    originalName: rawFileName.slice(0, 140),
    fileFormat: detected.formatLabel,
    mime: detected.mime,
    fileSizeBytes: buffer.length,
    fileSizeLabel: formatByteSize(buffer.length),
    sha256,
    malwareScanStatus: 'passed',
  });
}

// Private non-public storage upload for IFIOK DIGITAL products
router.post('/digital-asset', requireAuth, (req, res) => {
  const isAdmin = req.authUser!.roles.includes('super_admin');
  const seller = db.prepare(`SELECT id, verification_status FROM sellers WHERE user_id = ?`).get(req.authUser!.id) as
    | { id: number; verification_status: string }
    | undefined;
  if (!isAdmin && (!seller || seller.verification_status !== 'verified')) {
    return res.status(403).json({ error: 'Only verified sellers or administrators can upload IFIOK DIGITAL assets.' });
  }
  return handlePrivateAssetUpload(req, res, 'asset');
});

// Private non-public storage upload for IFIOK SCHOOL courses & school lessons
router.post('/course-material', requireAuth, (req, res) => {
  const allowed = req.authUser!.roles.some((r) => ['super_admin', 'instructor', 'teacher', 'school_admin'].includes(r));
  if (!allowed) {
    return res.status(403).json({ error: 'Only verified instructors, school teachers, or administrators can upload educational materials.' });
  }
  return handlePrivateAssetUpload(req, res, 'course_mat');
});

// Authenticated access for school-portal lesson attachments referenced by school_lessons.material_url
router.get('/school-material/:storageKey', requireAuth, (req, res) => {
  const safeKey = path.basename(String(req.params.storageKey || ''));
  if (!/^(asset|course_mat)_\d+_[a-f0-9]+\.[a-z0-9]+$/i.test(safeKey)) {
    return res.status(400).json({ error: 'Invalid material key.' });
  }
  const refPath = `/api/uploads/school-material/${safeKey}`;
  const lesson = db.prepare(`
    SELECT l.school_id, l.teacher_user_id FROM school_lessons l WHERE l.material_url = ?
  `).get(refPath) as { school_id: number; teacher_user_id: number } | undefined;

  if (!lesson) {
    return res.status(404).json({ error: 'School lesson material not found.' });
  }

  const isMember = db.prepare(`
    SELECT id FROM school_memberships WHERE school_id = ? AND user_id = ? AND status = 'active'
  `).get(lesson.school_id, req.authUser!.id);
  const isAdmin = req.authUser!.roles.includes('super_admin');

  if (!isMember && !isAdmin && lesson.teacher_user_id !== req.authUser!.id) {
    return res.status(403).json({ error: 'Access denied: active school membership required.' });
  }

  const targetPath = path.join(PRIVATE_ASSETS_DIR, safeKey);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Material file missing from vault.' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${safeKey}"`);
  return res.sendFile(targetPath);
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

