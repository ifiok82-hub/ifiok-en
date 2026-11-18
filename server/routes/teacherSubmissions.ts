import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { db, PRIVATE_ASSETS_DIR } from '../db.ts';
import {
  containsMaliciousScriptSignature,
  detectSafeDigitalFile,
  extractReadableDocumentText,
} from '../lib/crypto.ts';
import {
  createNotification,
  optionalAuth,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
} from '../middleware/auth.ts';

const router = Router();

export const TEACHER_SUBMISSION_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Revision Required',
  'Approved',
  'Published',
  'Rejected',
  'Suspended',
  'Archived',
] as const;

function hasEducatorAuthority(userId: number, roles: string[]): boolean {
  if (roles.some((r) => ['teacher', 'instructor', 'school_admin', 'super_admin'].includes(r))) {
    return true;
  }
  const inst = db.prepare(`SELECT id FROM instructors WHERE user_id = ? AND approval_status = 'approved'`).get(userId);
  if (inst) return true;
  const schoolStaff = db
    .prepare(`SELECT id FROM school_memberships WHERE user_id = ? AND member_role IN ('teacher', 'school_admin') AND status = 'active'`)
    .get(userId);
  return Boolean(schoolStaff);
}

router.get('/', optionalAuth, (req, res) => {
  const subject = typeof req.query.subject === 'string' ? req.query.subject.trim() : '';
  const level = typeof req.query.level === 'string' ? req.query.level.trim() : '';
  const languageCode = typeof req.query.languageCode === 'string' ? req.query.languageCode.trim() : '';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const mineOnly = req.query.mine === '1';

  const uid = req.authUser?.id ?? null;
  const isModerator = Boolean(req.authUser?.roles.some((r) => ['super_admin', 'moderator'].includes(r)));

  const rows = db.prepare(`
    SELECT ts.id, ts.author_user_id, ts.school_id, ts.title, ts.description, ts.subject, ts.level,
           ts.country, ts.language_code, ts.category, ts.accessibility_notes, ts.copyright_declared,
           ts.license_terms, ts.current_version, ts.file_storage_key, ts.file_original_name, ts.file_format,
           ts.file_size_bytes, ts.file_sha256, ts.status, ts.review_notes, ts.published_at,
           ts.created_at, ts.updated_at,
           u.full_name as author_name, s.name as school_name
    FROM teacher_submissions ts
    JOIN users u ON u.id = ts.author_user_id
    LEFT JOIN schools s ON s.id = ts.school_id
    WHERE ts.status IN ('Approved', 'Published')
       OR (? IS NOT NULL AND ts.author_user_id = ?)
       OR ? = 1
    ORDER BY ts.updated_at DESC, ts.created_at DESC
  `).all(uid, uid, isModerator ? 1 : 0) as Array<Record<string, unknown>>;

  const versionsStmt = db.prepare(`
    SELECT v.id, v.submission_id, v.version, v.file_original_name, v.file_format, v.file_size_bytes,
           v.file_sha256, v.change_notes, v.created_at, u.full_name as actor_name
    FROM teacher_submission_versions v
    JOIN users u ON u.id = v.actor_user_id
    WHERE v.submission_id = ?
    ORDER BY v.id DESC
  `);

  const filtered = rows
    .filter((row) => {
      if (mineOnly && (!uid || row.author_user_id !== uid)) return false;
      if (subject && subject !== 'All' && row.subject !== subject) return false;
      if (level && level !== 'All' && row.level !== level) return false;
      if (languageCode && languageCode !== 'all' && row.language_code !== languageCode) return false;
      if (statusFilter && statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (q) {
        const hay = `${row.title} ${row.description} ${row.subject} ${row.category} ${row.author_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((row) => ({
      ...row,
      versions: versionsStmt.all(Number(row.id)),
    }));

  res.json({ submissions: filtered });
});

router.get('/:id/versions', optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const sub = db.prepare(`SELECT id, author_user_id, status FROM teacher_submissions WHERE id = ?`).get(id) as
    | { id: number; author_user_id: number; status: string }
    | undefined;
  if (!sub) return res.status(404).json({ error: 'Teacher submission not found.' });

  const isPublic = sub.status === 'Approved' || sub.status === 'Published';
  const isOwner = req.authUser?.id === sub.author_user_id;
  const isMod = Boolean(req.authUser?.roles.some((r) => ['super_admin', 'moderator'].includes(r)));
  if (!isPublic && !isOwner && !isMod) {
    return res.status(403).json({ error: 'Access denied for unpublished teacher resource.' });
  }

  const versions = db.prepare(`
    SELECT v.id, v.submission_id, v.version, v.file_original_name, v.file_format, v.file_size_bytes,
           v.file_sha256, v.change_notes, v.created_at, u.full_name as actor_name
    FROM teacher_submission_versions v
    JOIN users u ON u.id = v.actor_user_id
    WHERE v.submission_id = ?
    ORDER BY v.id DESC
  `).all(id);

  return res.json({ versions });
});

router.get('/:id/download', optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const sub = db.prepare(`
    SELECT id, author_user_id, status, file_storage_key, file_original_name, file_mime
    FROM teacher_submissions WHERE id = ?
  `).get(id) as
    | {
        id: number;
        author_user_id: number;
        status: string;
        file_storage_key: string;
        file_original_name: string;
        file_mime: string;
      }
    | undefined;

  if (!sub || !sub.file_storage_key) {
    return res.status(404).json({ error: 'Teacher resource file not found.' });
  }

  const isPublic = sub.status === 'Approved' || sub.status === 'Published';
  const isOwner = req.authUser?.id === sub.author_user_id;
  const isMod = Boolean(req.authUser?.roles.some((r) => ['super_admin', 'moderator'].includes(r)));

  if (!isPublic && !isOwner && !isMod) {
    recordSecurityEvent(
      'teacher_submission_unauthorized_download',
      'warning',
      req.authUser?.id ?? null,
      req.ip || '',
      `Blocked download for non-public teacher submission #${id} (status: ${sub.status})`
    );
    return res.status(403).json({ error: 'This resource is not published and can only be downloaded by its author or moderators.' });
  }

  const safeKey = path.basename(sub.file_storage_key);
  const targetPath = path.resolve(PRIVATE_ASSETS_DIR, safeKey);
  if (!targetPath.startsWith(path.resolve(PRIVATE_ASSETS_DIR) + path.sep) || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Stored educational asset file not found on server.' });
  }

  recordAudit(req.authUser?.id ?? null, 'teacher_submission_downloaded', 'teacher_submission', id, req.ip || '', {
    storageKey: safeKey,
  });

  const cleanFileName = (sub.file_original_name || safeKey).replace(/["\r\n]/g, '_');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
  return res.sendFile(targetPath);
});

router.post('/', requireAuth, (req, res) => {
  if (!hasEducatorAuthority(req.authUser!.id, req.authUser!.roles)) {
    return res.status(403).json({
      error: 'Uploading teaching contributions requires an Educator/Teacher, Instructor, or School Administrator role.',
    });
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim().slice(0, 80) : 'Mathematics';
  const level = typeof req.body?.level === 'string' && req.body.level.trim() ? req.body.level.trim().slice(0, 60) : 'All Levels';
  const country = typeof req.body?.country === 'string' && req.body.country.trim() ? req.body.country.trim().slice(0, 80) : 'Global';
  const languageCode = typeof req.body?.languageCode === 'string' && req.body.languageCode.trim() ? req.body.languageCode.trim().slice(0, 12) : 'en';
  const category = typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim().slice(0, 80) : 'Lesson Plan';
  const accessibilityNotes = typeof req.body?.accessibilityNotes === 'string' ? req.body.accessibilityNotes.trim().slice(0, 400) : '';
  const copyrightDeclared = Boolean(req.body?.copyrightDeclared);
  const licenseTerms = typeof req.body?.licenseTerms === 'string' && req.body.licenseTerms.trim()
    ? req.body.licenseTerms.trim().slice(0, 240)
    : 'CC BY-NC-SA 4.0 / IFIOK SCHOOL Educational License';
  const version = typeof req.body?.version === 'string' && req.body.version.trim() ? req.body.version.trim().slice(0, 30) : '1.0.0';
  const changeNotes = typeof req.body?.changeNotes === 'string' && req.body.changeNotes.trim()
    ? req.body.changeNotes.trim().slice(0, 300)
    : 'Initial upload';
  const submitForReview = Boolean(req.body?.submitForReview);
  const schoolId = Number(req.body?.schoolId) || null;

  const rawName = typeof req.body?.fileName === 'string' ? path.basename(req.body.fileName.trim()) : '';
  const rawBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64.trim() : '';

  if (title.length < 4 || description.length < 20) {
    return res.status(400).json({ error: 'Provide a descriptive resource title (>= 4 chars) and pedagogical description (>= 20 chars).' });
  }
  if (submitForReview && !copyrightDeclared) {
    return res.status(400).json({ error: 'You must confirm copyright ownership or valid licensing permission before submitting for moderation.' });
  }
  if (!rawBase64) {
    return res.status(400).json({ error: 'Please attach an educational file (PDF, DOCX, PPTX, image, audio, or video).' });
  }

  const cleaned = rawBase64.replace(/^data:[^;]+;base64,/, '');
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, 'base64');
  } catch {
    return res.status(400).json({ error: 'Malformed base64 file encoding.' });
  }

  if (buf.length === 0 || buf.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'Uploaded educational resource must be between 1 byte and 15 MB.' });
  }
  if (containsMaliciousScriptSignature(buf)) {
    return res.status(400).json({ error: 'Resource rejected due to embedded script signatures.' });
  }

  const detected = detectSafeDigitalFile(buf, rawName || 'resource.pdf');
  if (!detected) {
    return res.status(400).json({
      error: 'Unsupported or mismatched file format. Allowed: PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, PNG, JPG, WEBP, MP3, MP4.',
    });
  }

  if (schoolId) {
    const member = db.prepare(`SELECT id FROM school_memberships WHERE school_id = ? AND user_id = ? AND status = 'active'`).get(schoolId, req.authUser!.id);
    if (!member) {
      return res.status(403).json({ error: 'Cannot tag a school where you are not an active staff member.' });
    }
  }

  const storageKey = `ts-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  const diskPath = path.join(PRIVATE_ASSETS_DIR, storageKey);
  fs.writeFileSync(diskPath, buf, { mode: 0o600 });

  const fileSha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const extractedText = extractReadableDocumentText(buf, detected.ext).slice(0, 12000);
  const initialStatus = submitForReview ? 'Submitted' : 'Draft';

  let newId = 0;
  db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO teacher_submissions (
        author_user_id, school_id, title, description, subject, level, country, language_code, category,
        accessibility_notes, copyright_declared, license_terms, current_version,
        file_storage_key, file_original_name, file_format, file_mime, file_size_bytes, file_sha256,
        extracted_text, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.authUser!.id,
      schoolId,
      title,
      description,
      subject,
      level,
      country,
      languageCode,
      category,
      accessibilityNotes,
      copyrightDeclared ? 1 : 0,
      licenseTerms,
      version,
      storageKey,
      rawName || `resource.${detected.ext}`,
      detected.formatLabel,
      detected.mime,
      buf.length,
      fileSha256,
      extractedText,
      initialStatus
    );
    newId = Number(ins.lastInsertRowid);

    db.prepare(`
      INSERT INTO teacher_submission_versions (
        submission_id, version, file_storage_key, file_original_name, file_format, file_size_bytes, file_sha256, change_notes, actor_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(newId, version, storageKey, rawName || `resource.${detected.ext}`, detected.formatLabel, buf.length, fileSha256, changeNotes, req.authUser!.id);
  })();

  recordAudit(req.authUser!.id, 'teacher_submission_created', 'teacher_submission', newId, req.ip || '', {
    status: initialStatus,
    version,
    fileFormat: detected.formatLabel,
  });

  if (initialStatus === 'Submitted') {
    const mods = db.prepare(`
      SELECT DISTINCT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug IN ('super_admin', 'moderator')
    `).all() as Array<{ id: number }>;
    for (const m of mods) {
      createNotification(m.id, 'moderation', 'New Teacher Resource Submitted', `${req.authUser!.full_name} submitted "${title}" (${subject}) for review.`, 'admin');
    }
  }

  return res.status(201).json({
    id: newId,
    status: initialStatus,
    version,
    fileFormat: detected.formatLabel,
    fileSizeBytes: buf.length,
    fileSha256,
  });
});

router.post('/:id/versions', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const sub = db.prepare(`SELECT id, author_user_id, current_version, status, copyright_declared FROM teacher_submissions WHERE id = ?`).get(id) as
    | { id: number; author_user_id: number; current_version: string; status: string; copyright_declared: number }
    | undefined;
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (sub.author_user_id !== req.authUser!.id && !req.authUser!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Only the resource author can upload a new revision.' });
  }
  if (sub.status === 'Suspended') {
    return res.status(403).json({ error: 'Suspended submissions cannot be updated directly. Contact moderation.' });
  }

  const version = typeof req.body?.version === 'string' && req.body.version.trim() ? req.body.version.trim().slice(0, 30) : `${sub.current_version}-rev`;
  const changeNotes = typeof req.body?.changeNotes === 'string' && req.body.changeNotes.trim()
    ? req.body.changeNotes.trim().slice(0, 300)
    : 'Updated teaching material';
  const submitForReview = Boolean(req.body?.submitForReview);
  const rawName = typeof req.body?.fileName === 'string' ? path.basename(req.body.fileName.trim()) : '';
  const rawBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64.trim() : '';

  if (!rawBase64) return res.status(400).json({ error: 'Attach the revised file before creating a version.' });
  const cleaned = rawBase64.replace(/^data:[^;]+;base64,/, '');
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, 'base64');
  } catch {
    return res.status(400).json({ error: 'Malformed base64 payload.' });
  }
  if (buf.length === 0 || buf.length > 15 * 1024 * 1024 || containsMaliciousScriptSignature(buf)) {
    return res.status(400).json({ error: 'Invalid or unsafe revision file.' });
  }
  const detected = detectSafeDigitalFile(buf, rawName || 'revision.pdf');
  if (!detected) {
    return res.status(400).json({ error: 'Unsupported or mismatched revision file type.' });
  }

  const storageKey = `ts-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  fs.writeFileSync(path.join(PRIVATE_ASSETS_DIR, storageKey), buf, { mode: 0o600 });
  const fileSha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const extractedText = extractReadableDocumentText(buf, detected.ext).slice(0, 12000);

  const nextStatus = submitForReview ? 'Submitted' : sub.status === 'Revision Required' ? 'Draft' : sub.status;

  db.transaction(() => {
    db.prepare(`
      UPDATE teacher_submissions
      SET current_version = ?, file_storage_key = ?, file_original_name = ?, file_format = ?,
          file_mime = ?, file_size_bytes = ?, file_sha256 = ?, extracted_text = ?,
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      version,
      storageKey,
      rawName || `revision.${detected.ext}`,
      detected.formatLabel,
      detected.mime,
      buf.length,
      fileSha256,
      extractedText,
      nextStatus,
      id
    );

    db.prepare(`
      INSERT INTO teacher_submission_versions (
        submission_id, version, file_storage_key, file_original_name, file_format, file_size_bytes, file_sha256, change_notes, actor_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, version, storageKey, rawName || `revision.${detected.ext}`, detected.formatLabel, buf.length, fileSha256, changeNotes, req.authUser!.id);
  })();

  recordAudit(req.authUser!.id, 'teacher_submission_version_added', 'teacher_submission', id, req.ip || '', { version, nextStatus });
  return res.status(201).json({ id, version, status: nextStatus, fileSha256 });
});

router.patch('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const sub = db.prepare(`SELECT id, author_user_id, status, copyright_declared FROM teacher_submissions WHERE id = ?`).get(id) as
    | { id: number; author_user_id: number; status: string; copyright_declared: number }
    | undefined;
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (sub.author_user_id !== req.authUser!.id && !req.authUser!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'You may only update your own teaching contributions.' });
  }

  const requestedStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  if (requestedStatus && !['Draft', 'Submitted', 'Archived'].includes(requestedStatus)) {
    return res.status(403).json({ error: 'Authors can only set Draft, Submitted, or Archived status. Publication approval is moderator-only.' });
  }

  const copyrightDeclared = req.body?.copyrightDeclared !== undefined ? (req.body.copyrightDeclared ? 1 : 0) : sub.copyright_declared;
  if (requestedStatus === 'Submitted' && !copyrightDeclared) {
    return res.status(400).json({ error: 'Copyright declaration must be confirmed before submitting for review.' });
  }

  const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined;
  const description = typeof req.body?.description === 'string' && req.body.description.trim() ? req.body.description.trim() : undefined;
  const accessibilityNotes = typeof req.body?.accessibilityNotes === 'string' ? req.body.accessibilityNotes.trim().slice(0, 400) : undefined;
  const nextStatus = requestedStatus || sub.status;

  db.prepare(`
    UPDATE teacher_submissions
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        accessibility_notes = COALESCE(?, accessibility_notes),
        copyright_declared = ?,
        status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(title ?? null, description ?? null, accessibilityNotes ?? null, copyrightDeclared, nextStatus, id);

  recordAudit(req.authUser!.id, 'teacher_submission_updated', 'teacher_submission', id, req.ip || '', { nextStatus });
  return res.json({ id, status: nextStatus });
});

export default router;
