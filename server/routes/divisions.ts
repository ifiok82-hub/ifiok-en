import crypto from 'node:crypto';
import { Router } from 'express';
import { db, getSettingsMap } from '../db.ts';
import { encryptSensitive, sanitizeHttpUrl } from '../lib/crypto.ts';
import {
  evaluateCourseCompleteness,
  MARKET_SUITE_IDS,
} from '../lib/courseCompleteness.ts';
import {
  assignRole,
  createNotification,
  optionalAuth,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
} from '../middleware/auth.ts';

const router = Router();

router.get('/public-summary', (_req, res) => {
  const settings = getSettingsMap();

  const courses = db.prepare(`
    SELECT c.id, c.instructor_id, c.title, c.slug, c.category, c.subject, c.language_code, c.issuing_organization,
           c.level, c.duration_hours, c.price_pi, c.syllabus_json, c.description, c.image_url,
           c.approval_status, c.is_featured, c.completeness_score,
           c.source_origin, c.source_url, c.availability_status, c.last_verified_at, c.created_at,
           c.author_name, c.publication_date, c.version, c.review_status, c.rights_info, c.curriculum_mapping,
           u.full_name as instructor_name, i.headline as instructor_headline
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    WHERE c.approval_status = 'approved' AND COALESCE(c.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY c.is_featured DESC, c.created_at DESC
    LIMIT 6
  `).all();

  const businesses = db.prepare(`
    SELECT b.id, b.owner_user_id, b.business_name, b.sector, b.hub_category, b.country, b.website, b.summary, b.services_offered,
           b.verification_status, b.is_featured, b.source_origin, b.source_url, b.availability_status, b.last_verified_at, b.created_at,
           u.full_name as owner_name
    FROM business_profiles b
    JOIN users u ON u.id = b.owner_user_id
    WHERE b.verification_status = 'verified' AND COALESCE(b.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY b.is_featured DESC, b.created_at DESC
    LIMIT 6
  `).all();

  const opportunities = db.prepare(`
    SELECT o.*, u.full_name as poster_name
    FROM opportunities o
    JOIN users u ON u.id = o.poster_user_id
    WHERE o.approval_status = 'approved' AND COALESCE(o.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY o.created_at DESC
    LIMIT 6
  `).all();

  const products = db.prepare(`
    SELECT p.id, p.seller_id, p.title, p.category, p.market_suite, p.product_type, p.description, p.price_pi, p.stock_qty,
           p.image_url, p.approval_status, p.lifecycle_status, p.file_original_name, p.file_format, p.file_size_bytes,
           p.malware_scan_status, p.version, p.preview_images_json, p.support_info, p.creator_ownership_attested, p.download_count,
           p.source_origin, p.source_url, p.distribution_permission,
           p.delivery_method, p.refund_support_terms, p.availability_status, p.last_verified_at, p.created_at,
           (CASE WHEN length(COALESCE(p.file_storage_key, '')) > 0 THEN 1 ELSE 0 END) as has_file,
           s.store_name, s.country as seller_country, s.verification_status as seller_verified
    FROM products p
    JOIN sellers s ON s.id = p.seller_id
    WHERE p.approval_status = 'approved'
      AND COALESCE(p.lifecycle_status, 'published') IN ('approved', 'published')
      AND s.verification_status = 'verified'
      AND COALESCE(p.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY p.created_at DESC
    LIMIT 6
  `).all();

  const services = db.prepare(`
    SELECT fs.*, u.full_name as freelancer_name, u.country as freelancer_country
    FROM freelance_services fs
    JOIN users u ON u.id = fs.freelancer_user_id
    WHERE fs.approval_status = 'approved' AND COALESCE(fs.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY fs.created_at DESC
    LIMIT 6
  `).all();

  const communityPosts = db.prepare(`
    SELECT cp.*, u.full_name as author_name, u.country as author_country
    FROM community_posts cp
    JOIN users u ON u.id = cp.author_user_id
    WHERE cp.moderation_status = 'active' AND COALESCE(cp.moderation_action, '') NOT IN ('suspended', 'rejected')
    ORDER BY cp.created_at DESC
    LIMIT 6
  `).all();

  const stats = {
    members: (db.prepare(`SELECT COUNT(*) as c FROM users WHERE status = 'active'`).get() as { c: number }).c,
    verifiedBusinesses: (db.prepare(`SELECT COUNT(*) as c FROM business_profiles WHERE verification_status = 'verified'`).get() as { c: number }).c,
    approvedCourses: (db.prepare(`SELECT COUNT(*) as c FROM courses WHERE approval_status = 'approved'`).get() as { c: number }).c,
    approvedOpportunities: (db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE approval_status = 'approved'`).get() as { c: number }).c,
    approvedProducts: (db.prepare(`SELECT COUNT(*) as c FROM products WHERE approval_status = 'approved'`).get() as { c: number }).c,
    approvedServices: (db.prepare(`SELECT COUNT(*) as c FROM freelance_services WHERE approval_status = 'approved'`).get() as { c: number }).c,
  };

  res.json({
    settings: {
      heroHeadline: settings.hero_headline,
      heroSubheadline: settings.hero_subheadline,
      announcementBanner: settings.announcement_banner,
      supportEmail: settings.support_email,
      freelanceCommissionPct: Number(settings.freelance_commission_pct || 8),
      marketplaceCommissionPct: Number(settings.marketplace_commission_pct || 5),
      subscriptionProPi: Number(settings.subscription_pro_pi || 12),
      subscriptionBusinessPi: Number(settings.subscription_business_pi || 35),
      subscriptionEnterprisePi: Number(settings.subscription_enterprise_pi || 90),
      informationalUsdPerPi: Number(settings.informational_usd_per_pi || 1.0),
      piEnvironment: 'testnet',
      mainnetEnabled: false,
    },
    stats,
    courses,
    businesses,
    opportunities,
    products,
    services,
    communityPosts,
  });
});

// Global cross-division search endpoint
router.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (!q || q.length < 2) {
    return res.json({ query: q, results: [] });
  }
  const like = `%${q}%`;

  const products = db.prepare(`
    SELECT p.id, p.title, p.category as subtitle, p.price_pi as pricePi, p.source_origin, 'market' as division
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.approval_status = 'approved'
      AND COALESCE(p.lifecycle_status, 'published') IN ('approved', 'published')
      AND s.verification_status = 'verified'
      AND (LOWER(p.title) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.category) LIKE ?)
    LIMIT 8
  `).all(like, like, like) as Array<Record<string, unknown>>;

  const courses = db.prepare(`
    SELECT id, title, category as subtitle, price_pi as pricePi, source_origin, 'academy' as division
    FROM courses WHERE approval_status = 'approved'
      AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)
    LIMIT 8
  `).all(like, like, like) as Array<Record<string, unknown>>;

  const businesses = db.prepare(`
    SELECT id, business_name as title, sector || ' · ' || country as subtitle, NULL as pricePi, source_origin, 'business' as division
    FROM business_profiles WHERE verification_status = 'verified'
      AND (LOWER(business_name) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(sector) LIKE ?)
    LIMIT 8
  `).all(like, like, like) as Array<Record<string, unknown>>;

  const services = db.prepare(`
    SELECT id, title, category as subtitle, price_pi as pricePi, source_origin, 'freelance' as division
    FROM freelance_services WHERE approval_status = 'approved'
      AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)
    LIMIT 8
  `).all(like, like, like) as Array<Record<string, unknown>>;

  const opportunities = db.prepare(`
    SELECT id, title, opportunity_type || ' · ' || organization_name as subtitle, NULL as pricePi, source_origin, 'opportunities' as division
    FROM opportunities WHERE approval_status = 'approved'
      AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(organization_name) LIKE ?)
    LIMIT 8
  `).all(like, like, like) as Array<Record<string, unknown>>;

  res.json({
    query: q,
    results: [...products, ...courses, ...businesses, ...services, ...opportunities],
  });
});

// ================= ACADEMY =================
router.get('/courses', optionalAuth, (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const subject = typeof req.query.subject === 'string' ? req.query.subject.trim() : '';
  const language = typeof req.query.language === 'string' ? req.query.language.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const rows = db.prepare(`
    SELECT c.id, c.instructor_id, c.title, c.slug, c.category, c.subject, c.language_code, c.issuing_organization, c.school_id,
           c.level, c.duration_hours, c.price_pi, c.syllabus_json, c.description, c.image_url, c.approval_status, c.is_featured,
           c.learning_objectives_json, c.prerequisites, c.target_audience, c.copyright_permission, c.certificate_criteria,
           c.instructor_qualifications_snapshot, c.completeness_score, c.moderation_action, c.review_notes,
           c.assignments_json, c.quizzes_json, c.slides_resources_json, c.modules_notes_json, c.media_lesson_url, c.exam_marking_guide,
           c.workbooks_exercises_json, c.exam_questions_json, c.answer_keys_text, c.course_files_json,
           c.locked_materials_enc,
           c.source_origin, c.source_url, c.availability_status, c.last_verified_at, c.created_at,
           c.author_name, c.publication_date, c.version, c.review_status, c.rights_info, c.curriculum_mapping,
           (CASE WHEN length(COALESCE(c.locked_materials_enc, '')) > 0 OR c.price_pi > 0 THEN 1 ELSE 0 END) as has_locked_content,
           u.full_name as instructor_name, i.headline as instructor_headline, i.credentials as instructor_credentials, i.user_id as instructor_user_id,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.target_type = 'course' AND r.target_id = c.id AND r.moderation_status = 'approved') as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.target_type = 'course' AND r.target_id = c.id AND r.moderation_status = 'approved') as review_count
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    WHERE (c.approval_status = 'approved' AND COALESCE(c.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected'))
       OR (? IS NOT NULL AND i.user_id = ?)
    ORDER BY c.is_featured DESC, c.created_at DESC
  `).all(req.authUser?.id ?? null, req.authUser?.id ?? null) as Array<Record<string, unknown>>;

  const filtered = rows
    .filter((row) => {
      if (category && category !== 'All' && row.category !== category) return false;
      if (subject && subject !== 'All' && row.subject !== subject && row.category !== subject) return false;
      if (language && language !== 'all' && row.language_code !== language) return false;
      if (q) {
        const hay = `${row.title} ${row.description} ${row.category} ${row.subject || ''} ${row.instructor_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((row) => {
      const completeness = evaluateCourseCompleteness(row, { credentials: row.instructor_credentials });
      const {
        locked_materials_enc: _lm,
        modules_notes_json: _mn,
        slides_resources_json: _sr,
        assignments_json: _as,
        quizzes_json: _qz,
        workbooks_exercises_json: _wb,
        exam_questions_json: _eq,
        answer_keys_text: _ak,
        course_files_json: _cf,
        exam_marking_guide: _ex,
        media_lesson_url: _mu,
        ...publicSafe
      } = row;
      return {
        ...publicSafe,
        completeness_score: completeness.score,
        completeness_total: completeness.total,
        completeness_complete: completeness.complete,
        module_topics_count: (() => {
          try {
            const parsed = JSON.parse(String(row.modules_notes_json || '[]'));
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })(),
        assignments_count: (() => {
          try {
            const parsed = JSON.parse(String(row.assignments_json || '[]'));
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })(),
        quizzes_count: (() => {
          try {
            const parsed = JSON.parse(String(row.quizzes_json || '[]'));
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })(),
        course_files_count: (() => {
          try {
            const parsed = JSON.parse(String(row.course_files_json || '[]'));
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })(),
      };
    });

  res.json({ courses: filtered });
});

router.post('/instructors/apply', requireAuth, (req, res) => {
  const headline = typeof req.body?.headline === 'string' ? req.body.headline.trim() : '';
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : '';
  const expertise = typeof req.body?.expertise === 'string' ? req.body.expertise.trim() : '';
  const credentials = typeof req.body?.credentials === 'string' ? req.body.credentials.trim() : '';

  if (headline.length < 5 || bio.length < 20 || expertise.length < 3) {
    return res.status(400).json({ error: 'Headline, detailed bio, and expertise areas are required.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'approved' : 'pending';

  const existing = db.prepare(`SELECT id FROM instructors WHERE user_id = ?`).get(req.authUser!.id);
  if (existing) {
    return res.status(409).json({ error: 'Instructor profile already submitted for this account.' });
  }

  const ins = db.prepare(`
    INSERT INTO instructors (user_id, headline, bio, expertise, credentials, approval_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.authUser!.id, headline, bio, expertise, credentials, status);

  assignRole(req.authUser!.id, 'instructor', req.authUser!.id);
  recordAudit(req.authUser!.id, 'instructor_applied', 'instructor', Number(ins.lastInsertRowid), req.ip || '', { status });

  return res.status(201).json({
    instructorId: Number(ins.lastInsertRowid),
    approvalStatus: status,
  });
});

router.post('/courses', requireAuth, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Digital Skills';
  const level = typeof req.body?.level === 'string' ? req.body.level.trim() : 'Beginner';
  const durationHours = Math.max(1, Math.min(200, Number(req.body?.durationHours) || 6));
  const pricePi = Math.max(0, Number(req.body?.pricePi) || 0);
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const syllabus = Array.isArray(req.body?.syllabus)
    ? req.body.syllabus.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
    : [];
  const learningObjectives = Array.isArray(req.body?.learningObjectives)
    ? req.body.learningObjectives.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
    : [];
  const modulesNotes = Array.isArray(req.body?.modulesNotes)
    ? req.body.modulesNotes.slice(0, 30)
    : [];
  const slidesResources = Array.isArray(req.body?.slidesResources)
    ? req.body.slidesResources.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
    : [];
  const workbooksExercises = Array.isArray(req.body?.workbooksExercises)
    ? req.body.workbooksExercises.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
    : [];
  const assignments = Array.isArray(req.body?.assignments)
    ? req.body.assignments.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
    : [];
  const quizzes = Array.isArray(req.body?.quizzes)
    ? req.body.quizzes.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
    : [];
  const examQuestions = Array.isArray(req.body?.examQuestions)
    ? req.body.examQuestions.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
    : [];
  const answerKeysText = typeof req.body?.answerKeysText === 'string' ? req.body.answerKeysText.trim() : '';
  const examMarkingGuide = typeof req.body?.examMarkingGuide === 'string' ? req.body.examMarkingGuide.trim() : '';
  const mediaLessonUrl = sanitizeHttpUrl(req.body?.mediaLessonUrl);
  const instructorQualSnapshot = typeof req.body?.instructorQualifications === 'string' ? req.body.instructorQualifications.trim() : '';
  const prerequisites = typeof req.body?.prerequisites === 'string' ? req.body.prerequisites.trim() : '';
  const targetAudience = typeof req.body?.targetAudience === 'string' ? req.body.targetAudience.trim() : '';
  const copyrightPermission = typeof req.body?.copyrightPermission === 'string' ? req.body.copyrightPermission.trim() : '';
  const certificateCriteria = typeof req.body?.certificateCriteria === 'string' ? req.body.certificateCriteria.trim() : '';
  const courseFiles = Array.isArray(req.body?.courseFiles)
    ? req.body.courseFiles
        .filter((f: unknown) => f && typeof f === 'object' && typeof (f as { storageKey?: unknown }).storageKey === 'string')
        .slice(0, 12)
        .map((f: { storageKey: string; originalName?: string; fileFormat?: string; fileSizeBytes?: number; fileSha256?: string }) => ({
          storageKey: String(f.storageKey).replace(/[^a-zA-Z0-9._-]/g, ''),
          originalName: String(f.originalName || 'course-material').slice(0, 180),
          fileFormat: String(f.fileFormat || '').slice(0, 20),
          fileSizeBytes: Math.max(0, Number(f.fileSizeBytes) || 0),
          fileSha256: String(f.fileSha256 || '').slice(0, 80),
        }))
    : [];

  if (title.length < 5 || description.length < 20) {
    return res.status(400).json({ error: 'Course title and detailed description are required.' });
  }

  let instructor = db.prepare(`SELECT id, approval_status, credentials FROM instructors WHERE user_id = ?`).get(req.authUser!.id) as
    | { id: number; approval_status: string; credentials: string }
    | undefined;

  const isAdmin = req.authUser!.roles.includes('super_admin');
  if (!instructor && isAdmin) {
    const insRes = db.prepare(`
      INSERT INTO instructors (user_id, headline, bio, expertise, credentials, approval_status)
      VALUES (?, 'IFIOK-EN Curriculum Lead', 'Official platform curriculum administrator.', ?, 'Verified Platform Curriculum Authority', 'approved')
    `).run(req.authUser!.id, category);
    instructor = { id: Number(insRes.lastInsertRowid), approval_status: 'approved', credentials: 'Verified Platform Curriculum Authority' };
  }

  if (!instructor) {
    return res.status(403).json({ error: 'Please submit and verify your Instructor profile before publishing a course.' });
  }
  if (instructor.approval_status !== 'approved' && !isAdmin) {
    return res.status(403).json({ error: 'Your Instructor profile is pending administrator approval.' });
  }

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`;
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' && req.body.sourceOrigin.trim()
    ? req.body.sourceOrigin.trim().slice(0, 120)
    : 'Authorized Educational Material';
  const sourceUrl = sanitizeHttpUrl(req.body?.sourceUrl);
  const imageUrl = sanitizeHttpUrl(req.body?.imageUrl) || (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.startsWith('/api/uploads/') ? req.body.imageUrl : '');
  const lockedMaterials = typeof req.body?.lockedMaterials === 'string' ? req.body.lockedMaterials.trim() : '';
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim().slice(0, 80) : category;
  const languageCode = typeof req.body?.languageCode === 'string' && req.body.languageCode.trim() ? req.body.languageCode.trim().slice(0, 10) : 'en';
  const issuingOrganization = typeof req.body?.issuingOrganization === 'string' && req.body.issuingOrganization.trim()
    ? req.body.issuingOrganization.trim().slice(0, 120)
    : 'IFIOK SCHOOL';

  const encryptedMaterials = encryptSensitive(lockedMaterials);
  const completeness = evaluateCourseCompleteness(
    {
      title,
      description,
      subject,
      category,
      syllabus_json: syllabus,
      learning_objectives_json: learningObjectives,
      modules_notes_json: modulesNotes,
      media_lesson_url: mediaLessonUrl,
      locked_materials_enc: encryptedMaterials,
      slides_resources_json: slidesResources,
      course_files_json: courseFiles,
      workbooks_exercises_json: workbooksExercises,
      assignments_json: assignments,
      quizzes_json: quizzes,
      exam_questions_json: examQuestions,
      answer_keys_text: answerKeysText,
      exam_marking_guide: examMarkingGuide,
      instructor_qualifications_snapshot: instructorQualSnapshot || instructor.credentials,
      duration_hours: durationHours,
      level,
      language_code: languageCode,
      prerequisites,
      target_audience: targetAudience,
      copyright_permission: copyrightPermission,
      certificate_criteria: certificateCriteria,
    },
    instructor
  );

  // Enforce 22-point curriculum completeness before approving any paid course
  if (isAdmin && pricePi > 0 && !completeness.complete) {
    return res.status(400).json({
      error: `Paid course cannot be auto-approved until all ${completeness.total} curriculum requirements are complete (${completeness.score}/${completeness.total}).`,
      completeness,
    });
  }

  const approvalStatus = isAdmin ? 'approved' : 'pending';

  const resIns = db.prepare(`
    INSERT INTO courses (
      instructor_id, title, slug, category, subject, language_code, issuing_organization,
      level, duration_hours, price_pi, syllabus_json, description,
      learning_objectives_json, modules_notes_json, media_lesson_url, slides_resources_json,
      workbooks_exercises_json, assignments_json, quizzes_json, exam_questions_json, answer_keys_text,
      exam_marking_guide, instructor_qualifications_snapshot,
      prerequisites, target_audience, copyright_permission, certificate_criteria, course_files_json, completeness_score,
      image_url, approval_status, source_origin, source_url, availability_status, last_verified_at, locked_materials_enc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)
  `).run(
    instructor.id,
    title,
    slug,
    category,
    subject,
    languageCode,
    issuingOrganization,
    level,
    durationHours,
    pricePi,
    JSON.stringify(syllabus),
    description,
    JSON.stringify(learningObjectives),
    JSON.stringify(modulesNotes),
    mediaLessonUrl,
    JSON.stringify(slidesResources),
    JSON.stringify(workbooksExercises),
    JSON.stringify(assignments),
    JSON.stringify(quizzes),
    JSON.stringify(examQuestions),
    answerKeysText,
    examMarkingGuide,
    instructorQualSnapshot || instructor.credentials || '',
    prerequisites,
    targetAudience,
    copyrightPermission,
    certificateCriteria,
    JSON.stringify(courseFiles),
    completeness.score,
    imageUrl,
    approvalStatus,
    sourceOrigin,
    sourceUrl,
    isAdmin ? new Date().toISOString() : null,
    encryptedMaterials
  );

  recordAudit(req.authUser!.id, 'course_created', 'course', Number(resIns.lastInsertRowid), req.ip || '', {
    approvalStatus,
    sourceOrigin,
    completenessScore: completeness.score,
  });
  return res.status(201).json({
    id: Number(resIns.lastInsertRowid),
    approvalStatus,
    completeness,
  });
});

router.get('/courses/:id/classroom', requireAuth, async (req, res) => {
  const courseId = Number(req.params.id);
  const course = db.prepare(`
    SELECT c.id, c.title, c.category, c.subject, c.language_code, c.issuing_organization, c.level, c.duration_hours,
           c.price_pi, c.syllabus_json, c.description, c.image_url, c.approval_status, c.locked_materials_enc,
           c.learning_objectives_json, c.modules_notes_json, c.media_lesson_url, c.slides_resources_json,
           c.workbooks_exercises_json, c.assignments_json, c.quizzes_json, c.exam_questions_json, c.answer_keys_text,
           c.exam_marking_guide, c.instructor_qualifications_snapshot, c.course_files_json,
           c.prerequisites, c.target_audience, c.copyright_permission, c.certificate_criteria, c.completeness_score,
           c.moderation_action, c.review_notes,
           c.author_name, c.publication_date, c.version, c.review_status, c.rights_info, c.curriculum_mapping,
           u.full_name as instructor_name, i.credentials as instructor_credentials, i.user_id as instructor_user_id
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    WHERE c.id = ?
  `).get(courseId) as Record<string, unknown> | undefined;

  if (
    !course ||
    ((course.approval_status !== 'approved' || ['suspended', 'correction_requested', 'rejected'].includes(String(course.moderation_action || ''))) &&
      course.instructor_user_id !== req.authUser!.id &&
      !req.authUser!.roles.includes('super_admin'))
  ) {
    return res.status(404).json({ error: 'Approved course not found.' });
  }

  const enrolment = db.prepare(`
    SELECT id, progress_percent, completed_lessons_json, certificate_code, status, enrolled_at, completed_at
    FROM enrolments WHERE user_id = ? AND course_id = ?
  `).get(req.authUser!.id, courseId) as
    | { id: number; progress_percent: number; completed_lessons_json: string; certificate_code: string | null; status: string; enrolled_at: string; completed_at: string | null }
    | undefined;

  const isFree = Number(course.price_pi) === 0;
  const isOwnerOrAdmin = course.instructor_user_id === req.authUser!.id || req.authUser!.roles.includes('super_admin');
  const ent = db.prepare(`
    SELECT e.is_unlocked FROM entitlements e
    JOIN orders o ON o.id = e.order_id
    WHERE e.user_id = ? AND e.item_type = 'course' AND e.item_id = ? AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
  `).get(req.authUser!.id, courseId) as { is_unlocked: number } | undefined;

  const unlocked = Boolean(isFree || isOwnerOrAdmin || ent?.is_unlocked === 1);
  const { decryptSensitive } = await import('../lib/crypto.ts');
  const materials = unlocked && course.locked_materials_enc ? decryptSensitive(String(course.locked_materials_enc)) : null;
  const completeness = evaluateCourseCompleteness(course, { credentials: course.instructor_credentials });

  const {
    locked_materials_enc: _omit,
    modules_notes_json,
    slides_resources_json,
    workbooks_exercises_json,
    assignments_json,
    quizzes_json,
    exam_questions_json,
    answer_keys_text,
    exam_marking_guide,
    media_lesson_url,
    course_files_json,
    ...publicCourse
  } = course;

  return res.json({
    course: unlocked
      ? {
          ...publicCourse,
          modules_notes_json,
          slides_resources_json,
          workbooks_exercises_json,
          assignments_json,
          quizzes_json,
          exam_questions_json,
          answer_keys_text,
          exam_marking_guide,
          media_lesson_url,
          course_files_json,
        }
      : {
          ...publicCourse,
          modules_notes_json: '[]',
          slides_resources_json: '[]',
          workbooks_exercises_json: '[]',
          assignments_json: '[]',
          quizzes_json: '[]',
          exam_questions_json: '[]',
          answer_keys_text: '',
          exam_marking_guide: '',
          media_lesson_url: '',
          course_files_json: '[]',
        },
    completeness,
    enrolment: enrolment || null,
    unlocked,
    materials,
  });
});

router.post('/enrolments/:courseId/progress', requireAuth, (req, res) => {
  const courseId = Number(req.params.courseId);
  const completedLessons = Array.isArray(req.body?.completedLessons)
    ? req.body.completedLessons.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n >= 0)
    : [];

  const enrolment = db.prepare(`
    SELECT e.id, e.status, e.certificate_code, c.syllabus_json, c.title
    FROM enrolments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ? AND e.course_id = ?
  `).get(req.authUser!.id, courseId) as
    | { id: number; status: string; certificate_code: string | null; syllabus_json: string; title: string }
    | undefined;

  if (!enrolment || enrolment.status === 'pending_payment') {
    return res.status(404).json({ error: 'Active course enrolment not found.' });
  }

  const syllabus = JSON.parse(enrolment.syllabus_json || '[]') as string[];
  const total = Math.max(1, syllabus.length);
  const uniqueCompleted = Array.from(new Set<number>(completedLessons)).filter((i: number) => i < total);
  const progressPercent = Math.min(100, Math.round((uniqueCompleted.length / total) * 100));

  let certCode = enrolment.certificate_code;
  let newStatus = enrolment.status;
  let completedAt: string | null = null;

  if (progressPercent === 100) {
    newStatus = 'completed';
    if (!certCode) {
      certCode = `IFIOK-CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }
    completedAt = new Date().toISOString();
    createNotification(
      req.authUser!.id,
      'academy',
      'Certificate Issued',
      `You completed "${enrolment.title}". Verifiable Certificate ID: ${certCode}`,
      'academy'
    );
  }

  db.prepare(`
    UPDATE enrolments
    SET progress_percent = ?, completed_lessons_json = ?, certificate_code = ?, status = ?,
        completed_at = COALESCE(completed_at, ?)
    WHERE id = ?
  `).run(progressPercent, JSON.stringify(uniqueCompleted), certCode, newStatus, completedAt, enrolment.id);

  return res.json({ progressPercent, status: newStatus, certificateCode: certCode });
});

router.get('/certificates/verify/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Certificate code is required.' });

  const row = db.prepare(`
    SELECT e.certificate_code, e.progress_percent, e.status, e.completed_at,
           u.full_name as student_name, c.title as course_title, c.category, c.subject,
           c.issuing_organization, c.duration_hours,
           iu.full_name as instructor_name
    FROM enrolments e
    JOIN users u ON u.id = e.user_id
    JOIN courses c ON c.id = e.course_id
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users iu ON iu.id = i.user_id
    WHERE e.certificate_code = ? AND e.status = 'completed'
  `).get(code) as Record<string, unknown> | undefined;

  if (!row) {
    return res.status(404).json({ valid: false, error: 'No verified completed certificate matches that code.' });
  }

  return res.json({
    valid: true,
    certificate: {
      ...row,
      issuing_organization: row.issuing_organization || 'IFIOK SCHOOL',
      accreditation_note:
        'Verified IFIOK SCHOOL course completion record. This record documents coursework completed on IFIOK SCHOOL and does not imply unverified government or university accreditation.',
    },
  });
});

// ================= BUSINESS HUB =================
router.get('/businesses', (req, res) => {
  const sector = typeof req.query.sector === 'string' ? req.query.sector.trim() : '';
  const hubCategory = typeof req.query.hubCategory === 'string' ? req.query.hubCategory.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const rows = db.prepare(`
    SELECT b.id, b.owner_user_id, b.business_name, b.registration_number, b.sector, b.hub_category, b.country, b.website,
           b.summary, b.services_offered, b.verification_status, b.is_featured,
           b.source_origin, b.source_url, b.availability_status, b.last_verified_at, b.created_at,
           u.full_name as owner_name
    FROM business_profiles b
    JOIN users u ON u.id = b.owner_user_id
    WHERE b.verification_status = 'verified' AND COALESCE(b.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY b.is_featured DESC, b.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const filtered = rows.filter((b) => {
    if (sector && sector !== 'All' && b.sector !== sector) return false;
    if (hubCategory && hubCategory !== 'All' && b.hub_category !== hubCategory) return false;
    if (q) {
      const hay = `${b.business_name} ${b.sector} ${b.hub_category || ''} ${b.country} ${b.summary} ${b.services_offered}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  res.json({ businesses: filtered });
});

router.post('/businesses', requireAuth, (req, res) => {
  const businessName = typeof req.body?.businessName === 'string' ? req.body.businessName.trim() : '';
  const registrationNumber = typeof req.body?.registrationNumber === 'string' ? req.body.registrationNumber.trim() : '';
  const sector = typeof req.body?.sector === 'string' ? req.body.sector.trim() : '';
  const hubCategory = typeof req.body?.hubCategory === 'string' && req.body.hubCategory.trim() ? req.body.hubCategory.trim() : 'Verified SMEs';
  const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
  const website = sanitizeHttpUrl(req.body?.website);
  const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
  const servicesOffered = typeof req.body?.servicesOffered === 'string' ? req.body.servicesOffered.trim() : '';
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' && req.body.sourceOrigin.trim()
    ? req.body.sourceOrigin.trim().slice(0, 120)
    : 'Verified Business Submission';
  const sourceUrl = sanitizeHttpUrl(req.body?.sourceUrl || req.body?.website);

  if (businessName.length < 2 || sector.length < 2 || country.length < 2 || summary.length < 15) {
    return res.status(400).json({ error: 'Business name, sector, country, and descriptive summary are required.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'verified' : 'pending';
  const maskedReg = registrationNumber.length > 4 ? `***${registrationNumber.slice(-4)}` : registrationNumber;

  const ins = db.prepare(`
    INSERT INTO business_profiles (
      owner_user_id, business_name, registration_number, registration_number_enc, sector, hub_category, country, website,
      summary, services_offered, verification_status, source_origin, source_url, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)
  `).run(
    req.authUser!.id,
    businessName,
    maskedReg,
    encryptSensitive(registrationNumber),
    sector,
    hubCategory,
    country,
    website,
    summary,
    servicesOffered,
    status,
    sourceOrigin,
    sourceUrl,
    isAdmin ? new Date().toISOString() : null
  );

  assignRole(req.authUser!.id, 'organisation', req.authUser!.id);
  recordAudit(req.authUser!.id, 'business_submitted', 'business_profile', Number(ins.lastInsertRowid), req.ip || '', { status, sourceOrigin, hubCategory });

  return res.status(201).json({ id: Number(ins.lastInsertRowid), verificationStatus: status });
});

// ================= FREELANCE =================
router.get('/services', optionalAuth, (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const rows = db.prepare(`
    SELECT fs.*, u.full_name as freelancer_name, u.country as freelancer_country
    FROM freelance_services fs
    JOIN users u ON u.id = fs.freelancer_user_id
    WHERE (fs.approval_status = 'approved' AND COALESCE(fs.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected'))
       OR (? IS NOT NULL AND fs.freelancer_user_id = ?)
    ORDER BY fs.created_at DESC
  `).all(req.authUser?.id ?? null, req.authUser?.id ?? null) as Array<Record<string, unknown>>;

  const filtered = rows.filter((s) => {
    if (category && category !== 'All') {
      const cat = String(s.category || '');
      const matchesExact = cat === category;
      const matchesLegacy =
        (category === 'Programming' && cat === 'Software Development') ||
        ((category === 'Writing' || category === 'Translation') && cat === 'Writing & Translation');
      if (!matchesExact && !matchesLegacy) return false;
    }
    if (q) {
      const hay = `${s.title} ${s.category} ${s.description} ${s.deliverables || ''} ${s.freelancer_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  res.json({ services: filtered });
});

router.post('/services', requireAuth, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const category = typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim() : 'Programming';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const deliverables = typeof req.body?.deliverables === 'string' ? req.body.deliverables.trim() : '';
  const credentialsSummary = typeof req.body?.credentialsSummary === 'string' ? req.body.credentialsSummary.trim() : '';
  const deliveryDays = Math.max(1, Math.min(180, Number(req.body?.deliveryDays) || 7));
  const pricePi = Math.max(1, Number(req.body?.pricePi) || 0);

  if (title.length < 5 || description.length < 20 || pricePi <= 0) {
    return res.status(400).json({ error: 'Service title, description (>=20 chars), and valid Pi price (>0) are required.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'approved' : 'pending';
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' && req.body.sourceOrigin.trim()
    ? req.body.sourceOrigin.trim().slice(0, 120)
    : 'Verified Freelancer Listing';

  const ins = db.prepare(`
    INSERT INTO freelance_services (
      freelancer_user_id, title, category, description, deliverables, credentials_summary,
      delivery_days, price_pi, approval_status, source_origin, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)
  `).run(
    req.authUser!.id,
    title,
    category,
    description,
    deliverables,
    credentialsSummary,
    deliveryDays,
    pricePi,
    status,
    sourceOrigin,
    isAdmin ? new Date().toISOString() : null
  );

  assignRole(req.authUser!.id, 'freelancer', req.authUser!.id);
  recordAudit(req.authUser!.id, 'freelance_service_created', 'freelance_service', Number(ins.lastInsertRowid), req.ip || '', { status, sourceOrigin });

  return res.status(201).json({ id: Number(ins.lastInsertRowid), approvalStatus: status });
});

router.patch('/projects/:id/status', requireAuth, (req, res) => {
  const projectId = Number(req.params.id);
  const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as
    | { id: number; client_user_id: number; freelancer_user_id: number; status: string; title: string }
    | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const uid = req.authUser!.id;

  if (nextStatus === 'delivered' && uid === project.freelancer_user_id && project.status === 'in_progress') {
    db.prepare(`UPDATE projects SET status = 'delivered', updated_at = datetime('now') WHERE id = ?`).run(projectId);
    createNotification(project.client_user_id, 'freelance', 'Project Delivered', `"${project.title}" has been marked delivered for your review.`, 'freelance');
    return res.json({ status: 'delivered' });
  }
  if (nextStatus === 'completed' && uid === project.client_user_id && project.status === 'delivered') {
    db.prepare(`UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(projectId);
    createNotification(project.freelancer_user_id, 'freelance', 'Project Completed', `Client approved completion of "${project.title}".`, 'freelance');
    return res.json({ status: 'completed' });
  }
  if (nextStatus === 'disputed' && (uid === project.client_user_id || uid === project.freelancer_user_id)) {
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'Freelance project dispute';
    db.transaction(() => {
      db.prepare(`UPDATE projects SET status = 'disputed', updated_at = datetime('now') WHERE id = ?`).run(projectId);
      db.prepare(`
        INSERT INTO disputes (opened_by_user_id, target_type, target_id, reason, details)
        VALUES (?, 'project', ?, ?, ?)
      `).run(uid, projectId, reason, `Dispute opened on project "${project.title}".`);
    })();
    return res.json({ status: 'disputed' });
  }

  return res.status(400).json({ error: 'Invalid project status transition or unauthorized user.' });
});

// ================= OPPORTUNITIES =================
router.get('/opportunities', (req, res) => {
  const oppType = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const rows = db.prepare(`
    SELECT o.*, u.full_name as poster_name
    FROM opportunities o
    JOIN users u ON u.id = o.poster_user_id
    WHERE o.approval_status = 'approved' AND COALESCE(o.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
    ORDER BY o.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const filtered = rows.filter((o) => {
    if (oppType && oppType !== 'all' && o.opportunity_type !== oppType) return false;
    if (q) {
      const hay = `${o.title} ${o.organization_name} ${o.location} ${o.description} ${o.eligibility || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  res.json({ opportunities: filtered });
});

router.post('/opportunities', requireAuth, (req, res) => {
  const allowedOppTypes = ['job', 'internship', 'scholarship', 'grant', 'fellowship', 'competition', 'partnership'];
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const opportunityType = allowedOppTypes.includes(req.body?.opportunityType) ? req.body.opportunityType : 'job';
  const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';
  const location = typeof req.body?.location === 'string' ? req.body.location.trim() : 'Remote';
  const isRemote = req.body?.isRemote ? 1 : 0;
  const compensationOrAward = typeof req.body?.compensationOrAward === 'string' ? req.body.compensationOrAward.trim() : '';
  const deadline = typeof req.body?.deadline === 'string' ? req.body.deadline.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const requirements = typeof req.body?.requirements === 'string' ? req.body.requirements.trim() : '';
  const eligibility = typeof req.body?.eligibility === 'string' ? req.body.eligibility.trim() : '';
  const externalUrl = typeof req.body?.externalUrl === 'string' ? req.body.externalUrl.trim() : '';

  if (title.length < 5 || organizationName.length < 2 || description.length < 20 || !deadline) {
    return res.status(400).json({ error: 'Title, organization name, deadline, and full description are required.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'approved' : 'pending';
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' && req.body.sourceOrigin.trim()
    ? req.body.sourceOrigin.trim().slice(0, 120)
    : 'Issuing Organization Confirmed';
  const sourceUrl = sanitizeHttpUrl(req.body?.sourceUrl || externalUrl);

  const ins = db.prepare(`
    INSERT INTO opportunities (
      poster_user_id, title, opportunity_type, organization_name, location, is_remote,
      compensation_or_award, deadline, description, requirements, eligibility, external_url, approval_status,
      source_origin, source_url, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)
  `).run(
    req.authUser!.id,
    title,
    opportunityType,
    organizationName,
    location,
    isRemote,
    compensationOrAward,
    deadline,
    description,
    requirements,
    eligibility,
    sanitizeHttpUrl(externalUrl),
    status,
    sourceOrigin,
    sourceUrl,
    isAdmin ? new Date().toISOString() : null
  );

  recordAudit(req.authUser!.id, 'opportunity_submitted', 'opportunity', Number(ins.lastInsertRowid), req.ip || '', { status, opportunityType, sourceOrigin });
  return res.status(201).json({ id: Number(ins.lastInsertRowid), approvalStatus: status });
});

router.post('/opportunities/:id/apply', requireAuth, (req, res) => {
  const oppId = Number(req.params.id);
  const coverNote = typeof req.body?.coverNote === 'string' ? req.body.coverNote.trim() : '';
  const portfolioUrl = typeof req.body?.portfolioUrl === 'string' ? req.body.portfolioUrl.trim() : '';

  const opp = db.prepare(`SELECT id, title, poster_user_id, approval_status FROM opportunities WHERE id = ?`).get(oppId) as
    | { id: number; title: string; poster_user_id: number; approval_status: string }
    | undefined;

  if (!opp || opp.approval_status !== 'approved') {
    return res.status(404).json({ error: 'Verified opportunity not found.' });
  }
  if (coverNote.length < 20) {
    return res.status(400).json({ error: 'Please provide an application note of at least 20 characters.' });
  }

  try {
    db.prepare(`
      INSERT INTO applications (opportunity_id, applicant_user_id, cover_note, portfolio_url)
      VALUES (?, ?, ?, ?)
    `).run(oppId, req.authUser!.id, coverNote, portfolioUrl);

    createNotification(
      opp.poster_user_id,
      'opportunities',
      'New Opportunity Application',
      `${req.authUser!.full_name} applied to "${opp.title}".`,
      'opportunities'
    );
    recordAudit(req.authUser!.id, 'opportunity_applied', 'opportunity', oppId, req.ip || '', {});
    return res.status(201).json({ applied: true });
  } catch {
    return res.status(409).json({ error: 'You have already submitted an application for this opportunity.' });
  }
});

// ================= MARKET =================
router.get('/products', optionalAuth, (req, res) => {
  const productType = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const marketSuite = typeof req.query.suite === 'string' ? req.query.suite.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const rows = db.prepare(`
    SELECT p.id, p.seller_id, p.title, p.category, p.market_suite, p.product_type, p.description, p.price_pi, p.stock_qty,
           p.image_url, p.approval_status, p.lifecycle_status, p.file_original_name, p.file_format, p.file_size_bytes,
           p.malware_scan_status, p.version, p.preview_images_json, p.support_info, p.creator_ownership_attested,
           p.license_verified_at, p.file_verified_at, p.download_count,
           p.source_origin, p.source_url, p.distribution_permission,
           p.delivery_method, p.refund_support_terms, p.availability_status, p.last_verified_at,
           p.moderation_action, p.review_notes, p.created_at,
           (CASE WHEN length(COALESCE(p.file_storage_key, '')) > 0 THEN 1 ELSE 0 END) as has_file,
           (CASE WHEN length(COALESCE(p.locked_content_enc, '')) > 0 OR length(COALESCE(p.file_storage_key, '')) > 0 OR p.product_type != 'physical' THEN 1 ELSE 0 END) as has_locked_content,
           s.store_name, s.country as seller_country, s.user_id as seller_user_id,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.target_type = 'product' AND r.target_id = p.id AND r.moderation_status = 'approved') as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.target_type = 'product' AND r.target_id = p.id AND r.moderation_status = 'approved') as review_count
    FROM products p
    JOIN sellers s ON s.id = p.seller_id
    WHERE (p.approval_status = 'approved'
           AND COALESCE(p.lifecycle_status, 'published') IN ('approved', 'published')
           AND s.verification_status = 'verified'
           AND COALESCE(p.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected'))
       OR (? IS NOT NULL AND s.user_id = ?)
    ORDER BY p.created_at DESC
  `).all(req.authUser?.id ?? null, req.authUser?.id ?? null) as Array<Record<string, unknown>>;

  const filtered = rows.filter((p) => {
    if (productType && productType !== 'all' && p.product_type !== productType) return false;
    if (marketSuite && marketSuite !== 'all' && p.market_suite !== marketSuite) return false;
    if (category && category !== 'All' && p.category !== category) return false;
    if (q) {
      const hay = `${p.title} ${p.description} ${p.category} ${p.market_suite || ''} ${p.store_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  res.json({ products: filtered });
});

router.post('/sellers/apply', requireAuth, (req, res) => {
  const storeName = typeof req.body?.storeName === 'string' ? req.body.storeName.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const country = typeof req.body?.country === 'string' ? req.body.country.trim() : req.authUser!.country;

  if (storeName.length < 2 || description.length < 15) {
    return res.status(400).json({ error: 'Store name and storefront description are required.' });
  }

  const existing = db.prepare(`SELECT id FROM sellers WHERE user_id = ?`).get(req.authUser!.id);
  if (existing) {
    return res.status(409).json({ error: 'Seller storefront already exists for this account.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'verified' : 'pending';

  const ins = db.prepare(`
    INSERT INTO sellers (user_id, store_name, description, country, verification_status)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.authUser!.id, storeName, description, country, status);

  assignRole(req.authUser!.id, 'seller', req.authUser!.id);
  recordAudit(req.authUser!.id, 'seller_applied', 'seller', Number(ins.lastInsertRowid), req.ip || '', { status });

  return res.status(201).json({ sellerId: Number(ins.lastInsertRowid), verificationStatus: status });
});

router.post('/products', requireAuth, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Software & Licenses';
  const marketSuite = typeof req.body?.marketSuite === 'string' && (MARKET_SUITE_IDS as readonly string[]).includes(req.body.marketSuite)
    ? req.body.marketSuite
    : req.body?.productType === 'physical'
      ? 'physical_commerce'
      : 'software_productivity';
  const productType = ['physical', 'digital', 'service', 'web3', 'pi_app', 'gaming_asset'].includes(req.body?.productType)
    ? req.body.productType
    : 'digital';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const pricePi = Number(req.body?.pricePi);
  const stockQty = Math.max(0, Number(req.body?.stockQty) || 1);
  const sourceOrigin = typeof req.body?.sourceOrigin === 'string' && req.body.sourceOrigin.trim()
    ? req.body.sourceOrigin.trim().slice(0, 120)
    : 'Seller Submission';
  const sourceUrl = sanitizeHttpUrl(req.body?.sourceUrl);
  const distributionPermission = typeof req.body?.distributionPermission === 'string' ? req.body.distributionPermission.trim().slice(0, 240) : '';
  const deliveryMethod = typeof req.body?.deliveryMethod === 'string' && req.body.deliveryMethod.trim()
    ? req.body.deliveryMethod.trim().slice(0, 80)
    : productType === 'physical'
      ? 'physical_shipping'
      : 'instant_digital_download';
  const refundSupportTerms = typeof req.body?.refundSupportTerms === 'string' ? req.body.refundSupportTerms.trim().slice(0, 300) : '';
  const imageUrl = sanitizeHttpUrl(req.body?.imageUrl) || (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.startsWith('/api/uploads/') ? req.body.imageUrl : '');
  const lockedContent = typeof req.body?.lockedContent === 'string' ? req.body.lockedContent.trim() : '';
  const version = typeof req.body?.version === 'string' && req.body.version.trim() ? req.body.version.trim().slice(0, 40) : '1.0.0';
  const supportInfo = typeof req.body?.supportInfo === 'string' ? req.body.supportInfo.trim().slice(0, 300) : '';
  const previewImages = Array.isArray(req.body?.previewImages)
    ? req.body.previewImages
        .map((u: unknown) => {
          const str = String(u || '').trim();
          return str.startsWith('/api/uploads/') ? str : sanitizeHttpUrl(str);
        })
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const fileStorageKey = typeof req.body?.fileStorageKey === 'string' ? req.body.fileStorageKey.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 120) : '';
  const fileOriginalName = typeof req.body?.fileOriginalName === 'string' ? req.body.fileOriginalName.trim().slice(0, 180) : '';
  const fileFormat = typeof req.body?.fileFormat === 'string' ? req.body.fileFormat.trim().slice(0, 20) : '';
  const fileSizeBytes = Math.max(0, Number(req.body?.fileSizeBytes) || 0);
  const fileSha256 = typeof req.body?.fileSha256 === 'string' ? req.body.fileSha256.trim().slice(0, 80) : '';
  const malwareScanStatus = fileStorageKey ? 'clean_verified' : 'not_uploaded';
  const creatorOwnershipAttested = req.body?.creatorOwnershipAttested === false ? 0 : 1;
  const saveAsDraft = req.body?.lifecycleStatus === 'draft';

  if (title.length < 3 || description.length < 15 || !Number.isFinite(pricePi) || pricePi <= 0) {
    return res.status(400).json({ error: 'Valid product title, description, and price (> 0 PI) are required.' });
  }
  if (distributionPermission.length < 5 || refundSupportTerms.length < 8) {
    return res.status(400).json({ error: 'Ownership/distribution permission and explicit refund/support terms are required for every marketplace listing.' });
  }
  if (!saveAsDraft && !creatorOwnershipAttested) {
    return res.status(400).json({ error: 'Creator ownership / licensed resale attestation is required before submitting.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  let seller = db.prepare(`SELECT id, verification_status FROM sellers WHERE user_id = ?`).get(req.authUser!.id) as
    | { id: number; verification_status: string }
    | undefined;

  if (!seller && isAdmin) {
    const sRes = db.prepare(`
      INSERT INTO sellers (user_id, store_name, description, country, verification_status)
      VALUES (?, 'IFIOK-EN Official Storefront', 'Verified platform commerce storefront.', 'Global', 'verified')
    `).run(req.authUser!.id);
    seller = { id: Number(sRes.lastInsertRowid), verification_status: 'verified' };
  }

  if (!seller) {
    return res.status(403).json({ error: 'Please register your Seller storefront first.' });
  }
  if (seller.verification_status !== 'verified' && !isAdmin) {
    return res.status(403).json({ error: 'Your Seller storefront is awaiting administrator verification.' });
  }

  const status = isAdmin && !saveAsDraft ? 'approved' : 'pending';
  const lifecycleStatus = saveAsDraft ? 'draft' : isAdmin ? 'published' : 'submitted';
  const availability = stockQty > 0 ? 'available' : 'out_of_stock';
  const nowIso = isAdmin && !saveAsDraft ? new Date().toISOString() : null;

  const ins = db.prepare(`
    INSERT INTO products (
      seller_id, title, category, market_suite, product_type, description, price_pi, stock_qty,
      image_url, approval_status, lifecycle_status,
      file_storage_key, file_original_name, file_format, file_size_bytes, file_sha256, malware_scan_status,
      version, preview_images_json, support_info, creator_ownership_attested, license_verified_at, file_verified_at,
      source_origin, source_url, distribution_permission,
      delivery_method, refund_support_terms, availability_status, last_verified_at, locked_content_enc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    seller.id,
    title,
    category,
    marketSuite,
    productType,
    description,
    pricePi,
    stockQty,
    imageUrl,
    status,
    lifecycleStatus,
    fileStorageKey,
    fileOriginalName,
    fileFormat,
    fileSizeBytes,
    fileSha256,
    malwareScanStatus,
    version,
    JSON.stringify(previewImages),
    supportInfo || refundSupportTerms,
    creatorOwnershipAttested,
    nowIso,
    nowIso,
    sourceOrigin,
    sourceUrl,
    distributionPermission,
    deliveryMethod,
    refundSupportTerms,
    availability,
    nowIso,
    encryptSensitive(lockedContent)
  );

  recordAudit(req.authUser!.id, 'product_created', 'product', Number(ins.lastInsertRowid), req.ip || '', {
    status,
    lifecycleStatus,
    sourceOrigin,
    marketSuite,
    hasFile: Boolean(fileStorageKey),
  });
  return res.status(201).json({
    id: Number(ins.lastInsertRowid),
    approvalStatus: status,
    lifecycleStatus,
  });
});

router.post('/products/:id/submit', requireAuth, (req, res) => {
  const productId = Number(req.params.id);
  const row = db.prepare(`
    SELECT p.id, p.lifecycle_status, p.title, p.creator_ownership_attested, s.user_id as seller_user_id
    FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?
  `).get(productId) as
    | { id: number; lifecycle_status: string; title: string; creator_ownership_attested: number; seller_user_id: number }
    | undefined;

  if (!row) return res.status(404).json({ error: 'Product not found.' });
  if (row.seller_user_id !== req.authUser!.id && !req.authUser!.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'You can only submit your own product listings.' });
  }
  if (!['draft', 'submitted', 'awaiting_license_verification'].includes(row.lifecycle_status)) {
    return res.status(400).json({ error: `Listing in "${row.lifecycle_status}" state cannot be re-submitted from draft.` });
  }

  db.prepare(`
    UPDATE products
    SET lifecycle_status = 'submitted', approval_status = 'pending', creator_ownership_attested = 1
    WHERE id = ?
  `).run(productId);
  recordAudit(req.authUser!.id, 'product_submitted_for_review', 'product', productId, req.ip || '', {});
  return res.json({ id: productId, lifecycleStatus: 'submitted', approvalStatus: 'pending' });
});

router.post('/reviews', requireAuth, (req, res) => {
  const targetType = req.body?.targetType;
  const targetId = Number(req.body?.targetId);
  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

  if (!['course', 'product', 'service', 'business'].includes(targetType) || !targetId || rating < 1 || rating > 5 || comment.length < 8) {
    return res.status(400).json({ error: 'Valid target, rating (1-5), and review comment are required.' });
  }

  // Enforce genuine verified interaction before reviewing commercial items
  if (targetType === 'course') {
    const enrolled = db.prepare(`SELECT id FROM enrolments WHERE user_id = ? AND course_id = ? AND status != 'pending_payment'`).get(req.authUser!.id, targetId);
    if (!enrolled) return res.status(403).json({ error: 'Only enrolled students can review a course.' });
  } else if (targetType === 'product') {
    const bought = db.prepare(`SELECT id FROM orders WHERE buyer_user_id = ? AND order_type = 'product' AND reference_id = ? AND status IN ('paid', 'fulfilled')`).get(req.authUser!.id, targetId);
    if (!bought) return res.status(403).json({ error: 'Only verified purchasers can review a marketplace product.' });
  }

  const ins = db.prepare(`
    INSERT INTO reviews (author_user_id, target_type, target_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.authUser!.id, targetType, targetId, Math.round(rating), comment);

  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

// ================= COMMUNITY & MESSAGING =================
router.get('/community', (req, res) => {
  const group = typeof req.query.group === 'string' ? req.query.group.trim() : '';

  const posts = db.prepare(`
    SELECT cp.*, u.full_name as author_name, u.country as author_country, u.account_type as author_type
    FROM community_posts cp
    JOIN users u ON u.id = cp.author_user_id
    WHERE cp.moderation_status = 'active'
    ORDER BY cp.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const filteredPosts = group && group !== 'All' ? posts.filter((p) => p.group_name === group) : posts;

  // Privacy-first member directory: never exposes email, phone, or pi_uid
  const members = db.prepare(`
    SELECT id, full_name, bio, country, account_type, created_at
    FROM users
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 40
  `).all();

  res.json({ posts: filteredPosts, members });
});

router.post('/community/posts', requireAuth, (req, res) => {
  const groupName = typeof req.body?.groupName === 'string' && req.body.groupName.trim() ? req.body.groupName.trim() : 'Professional Networking';
  const postType = ['discussion', 'announcement', 'collaboration'].includes(req.body?.postType) ? req.body.postType : 'discussion';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const eventDate = typeof req.body?.eventDate === 'string' ? req.body.eventDate.trim().slice(0, 60) : '';
  const eventLocation = typeof req.body?.eventLocation === 'string' ? req.body.eventLocation.trim().slice(0, 120) : '';

  if (title.length < 4 || body.length < 15) {
    return res.status(400).json({ error: 'Post title and meaningful message body are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO community_posts (author_user_id, group_name, post_type, title, body, event_date, event_location)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.authUser!.id, groupName, postType, title, body, eventDate, eventLocation);

  recordAudit(req.authUser!.id, 'community_post_created', 'community_post', Number(ins.lastInsertRowid), req.ip || '', { groupName, postType });
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/community/posts/:id/report', requireAuth, (req, res) => {
  const postId = Number(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Community guideline concern';

  const post = db.prepare(`SELECT id, reports_count, title FROM community_posts WHERE id = ?`).get(postId) as
    | { id: number; reports_count: number; title: string }
    | undefined;
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const nextCount = post.reports_count + 1;
  const nextStatus = nextCount >= 3 ? 'flagged' : 'active';

  db.transaction(() => {
    db.prepare(`UPDATE community_posts SET reports_count = ?, moderation_status = ? WHERE id = ?`).run(nextCount, nextStatus, postId);
    db.prepare(`
      INSERT INTO disputes (opened_by_user_id, target_type, target_id, reason, details)
      VALUES (?, 'post', ?, ?, ?)
    `).run(req.authUser!.id, postId, reason, `Reported post "${post.title}"`);
    recordSecurityEvent('community_post_reported', 'info', req.authUser!.id, req.ip || '', `Post #${postId} reported: ${reason}`);
  })();

  return res.json({ reported: true, moderationStatus: nextStatus });
});

router.post('/messages', requireAuth, (req, res) => {
  const recipientUserId = Number(req.body?.recipientUserId);
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

  if (!recipientUserId || recipientUserId === req.authUser!.id) {
    return res.status(400).json({ error: 'Valid recipient user is required.' });
  }
  if (subject.length < 2 || body.length < 3) {
    return res.status(400).json({ error: 'Message subject and body are required.' });
  }

  const recipient = db.prepare(`SELECT id, status FROM users WHERE id = ?`).get(recipientUserId) as { id: number; status: string } | undefined;
  if (!recipient || recipient.status !== 'active') {
    return res.status(404).json({ error: 'Recipient account not found or unavailable.' });
  }

  // Anti-abuse burst check: max 15 messages per hour per sender
  const recentCount = db.prepare(`
    SELECT COUNT(*) as c FROM messages
    WHERE sender_user_id = ? AND created_at > datetime('now', '-1 hour')
  `).get(req.authUser!.id) as { c: number };
  if (recentCount.c >= 15) {
    recordSecurityEvent('message_rate_limit', 'warning', req.authUser!.id, req.ip || '', 'Exceeded 15 direct messages/hour limit');
    return res.status(429).json({ error: 'Messaging rate limit reached. Please wait before sending additional messages.' });
  }

  const ins = db.prepare(`
    INSERT INTO messages (sender_user_id, recipient_user_id, subject, body)
    VALUES (?, ?, ?, ?)
  `).run(req.authUser!.id, recipientUserId, subject, body);

  createNotification(recipientUserId, 'message', 'New Direct Message', `${req.authUser!.full_name}: ${subject}`, 'messages');
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/messages/:id/report', requireAuth, (req, res) => {
  const msgId = Number(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Abusive or unsolicited message';

  const msg = db.prepare(`SELECT id, sender_user_id, recipient_user_id FROM messages WHERE id = ?`).get(msgId) as
    | { id: number; sender_user_id: number; recipient_user_id: number }
    | undefined;
  if (!msg || msg.recipient_user_id !== req.authUser!.id) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  db.transaction(() => {
    db.prepare(`UPDATE messages SET is_reported = 1, report_reason = ? WHERE id = ?`).run(reason, msgId);
    db.prepare(`
      INSERT INTO disputes (opened_by_user_id, target_type, target_id, reason, details)
      VALUES (?, 'message', ?, ?, ?)
    `).run(req.authUser!.id, msgId, reason, `Reported direct message #${msgId} from user #${msg.sender_user_id}`);
    recordSecurityEvent('message_abuse_reported', 'warning', req.authUser!.id, req.ip || '', `Message #${msgId} reported: ${reason}`);
  })();

  return res.json({ reported: true });
});

// ================= COPYRIGHT & IP TAKEDOWN REPORTING =================
router.post('/copyright-reports', requireAuth, (req, res) => {
  const targetType = typeof req.body?.targetType === 'string' ? req.body.targetType.trim() : '';
  const targetId = Number(req.body?.targetId);
  const claimantName = typeof req.body?.claimantName === 'string' ? req.body.claimantName.trim().slice(0, 120) : req.authUser!.full_name;
  const claimantEmail = typeof req.body?.claimantEmail === 'string' ? req.body.claimantEmail.trim().slice(0, 160) : (req.authUser!.email || '');
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 180) : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim().slice(0, 2000) : '';
  const evidenceUrl = sanitizeHttpUrl(req.body?.evidenceUrl);

  if (!['course', 'teacher_submission', 'product'].includes(targetType) || !Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Valid targetType (course, teacher_submission, or product) and targetId are required.' });
  }
  if (reason.length < 4 || details.length < 15) {
    return res.status(400).json({ error: 'Please provide a clear copyright/IP reason and detailed explanation (at least 15 characters).' });
  }

  let targetExists: { id: number; title?: string } | undefined;
  if (targetType === 'course') {
    targetExists = db.prepare(`SELECT id, title FROM courses WHERE id = ?`).get(targetId) as { id: number; title?: string } | undefined;
  } else if (targetType === 'teacher_submission') {
    targetExists = db.prepare(`SELECT id, title FROM teacher_submissions WHERE id = ?`).get(targetId) as { id: number; title?: string } | undefined;
  } else {
    targetExists = db.prepare(`SELECT id, title FROM products WHERE id = ?`).get(targetId) as { id: number; title?: string } | undefined;
  }

  if (!targetExists) {
    return res.status(404).json({ error: 'Referenced item not found.' });
  }

  const ins = db.prepare(`
    INSERT INTO copyright_reports (
      reporter_user_id, target_type, target_id, claimant_name, claimant_email, reason, details, evidence_url, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(req.authUser!.id, targetType, targetId, claimantName, claimantEmail, reason, details, evidenceUrl);

  const reportId = Number(ins.lastInsertRowid);
  recordAudit(req.authUser!.id, 'copyright_report_filed', 'copyright_report', reportId, req.ip || '', {
    targetType,
    targetId,
    reason,
  });
  recordSecurityEvent('copyright_report_filed', 'warning', req.authUser!.id, req.ip || '', `IP report #${reportId} on ${targetType} #${targetId}: ${reason}`);

  const admins = db.prepare(`
    SELECT DISTINCT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE r.slug IN ('super_admin', 'moderator')
  `).all() as Array<{ user_id: number }>;
  for (const a of admins) {
    createNotification(
      a.user_id,
      'moderation',
      'New Copyright / IP Notice',
      `Copyright notice #${reportId} filed on ${targetType} "${targetExists.title || `#${targetId}`}".`,
      'admin'
    );
  }

  return res.status(201).json({
    id: reportId,
    status: 'open',
    message: 'Copyright & IP notice logged for Governance review.',
  });
});

export default router;
