import { Router } from 'express';
import { db } from '../db.ts';
import { sanitizeHttpUrl } from '../lib/crypto.ts';
import {
  assignRole,
  createNotification,
  recordAudit,
  recordSecurityEvent,
  requireAuth,
} from '../middleware/auth.ts';

const router = Router();

function getSchoolMembership(schoolId: number, userId: number) {
  return db.prepare(`
    SELECT * FROM school_memberships
    WHERE school_id = ? AND user_id = ? AND status = 'active'
  `).all(schoolId, userId) as Array<{
    id: number;
    school_id: number;
    user_id: number;
    member_role: 'school_admin' | 'teacher' | 'student' | 'guardian';
    department_id: number | null;
    class_id: number | null;
    guardian_of_student_user_id: number | null;
  }>;
}

function assertSchoolMember(schoolId: number, userId: number, allowedRoles?: Array<'school_admin' | 'teacher' | 'student' | 'guardian'>) {
  const memberships = getSchoolMembership(schoolId, userId);
  if (memberships.length === 0) return null;
  if (!allowedRoles || allowedRoles.length === 0) return memberships;
  const matched = memberships.filter((m) => allowedRoles.includes(m.member_role));
  return matched.length > 0 ? memberships : null;
}

// Submit institutional school application with verification document URL
router.post('/apply', requireAuth, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const schoolType = typeof req.body?.schoolType === 'string' && req.body.schoolType.trim()
    ? req.body.schoolType.trim().slice(0, 80)
    : 'Secondary School';
  const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
  const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
  const website = sanitizeHttpUrl(req.body?.website);
  const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
  const verificationDocUrl =
    (typeof req.body?.verificationDocUrl === 'string' && req.body.verificationDocUrl.startsWith('/api/uploads/')
      ? req.body.verificationDocUrl
      : '') || sanitizeHttpUrl(req.body?.verificationDocUrl);
  const childSafetyOfficerEmail = typeof req.body?.childSafetyOfficerEmail === 'string'
    ? req.body.childSafetyOfficerEmail.trim().slice(0, 180)
    : '';

  if (name.length < 3 || country.length < 2 || summary.length < 15) {
    return res.status(400).json({ error: 'Institution name, country, and descriptive summary (min 15 chars) are required.' });
  }

  const isAdmin = req.authUser!.roles.includes('super_admin');
  const status = isAdmin ? 'verified' : 'pending';

  const schoolId = db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO schools (
        owner_user_id, name, school_type, country, city, website, summary,
        verification_doc_url, child_safety_officer_email, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.authUser!.id,
      name,
      schoolType,
      country,
      city,
      website,
      summary,
      verificationDocUrl,
      childSafetyOfficerEmail,
      status
    );
    const id = Number(ins.lastInsertRowid);
    db.prepare(`
      INSERT INTO school_memberships (school_id, user_id, member_role, status)
      VALUES (?, ?, 'school_admin', 'active')
    `).run(id, req.authUser!.id);
    assignRole(req.authUser!.id, 'school_admin', req.authUser!.id);
    recordAudit(req.authUser!.id, 'school_applied', 'school', id, req.ip || '', { name, country, status });
    return id;
  })();

  return res.status(201).json({ id: schoolId, verificationStatus: status });
});

// List schools ONLY where the authenticated user is a member (strict institutional isolation)
router.get('/my', requireAuth, (req, res) => {
  const schools = db.prepare(`
    SELECT s.id, s.name, s.school_type, s.country, s.city, s.website, s.summary,
           s.verification_status, s.accreditation_note, s.child_safety_officer_email, s.created_at,
           GROUP_CONCAT(sm.member_role) as my_roles
    FROM schools s
    JOIN school_memberships sm ON sm.school_id = s.id
    WHERE sm.user_id = ? AND sm.status = 'active'
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all(req.authUser!.id);

  res.json({ schools });
});

// Isolated Institutional Workspace for a single schoolId
router.get('/:schoolId/workspace', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const memberships = assertSchoolMember(schoolId, req.authUser!.id);
  if (!memberships) {
    recordSecurityEvent(
      'school_cross_tenant_denied',
      'warning',
      req.authUser!.id,
      req.ip || '',
      `User #${req.authUser!.id} attempted unauthorized access to school #${schoolId}`
    );
    return res.status(403).json({ error: 'Access denied: you are not an active member of this institution.' });
  }

  const school = db.prepare(`SELECT * FROM schools WHERE id = ?`).get(schoolId);
  if (!school) return res.status(404).json({ error: 'Institution not found.' });

  const myRoles = memberships.map((m) => m.member_role);
  const isStaff = myRoles.includes('school_admin') || myRoles.includes('teacher');
  const isSchoolAdmin = myRoles.includes('school_admin');
  const isGuardian = myRoles.includes('guardian');

  const departments = db.prepare(`
    SELECT d.*, u.full_name as head_teacher_name
    FROM school_departments d
    LEFT JOIN users u ON u.id = d.head_teacher_user_id
    WHERE d.school_id = ?
    ORDER BY d.name ASC
  `).all(schoolId);

  const classes = db.prepare(`
    SELECT c.*, d.name as department_name, u.full_name as teacher_name
    FROM school_classes c
    LEFT JOIN school_departments d ON d.id = c.department_id
    LEFT JOIN users u ON u.id = c.teacher_user_id
    WHERE c.school_id = ?
    ORDER BY c.created_at DESC
  `).all(schoolId);

  // Only school_admin & teachers see full roster; students/guardians never get other students' private records
  const roster = isStaff
    ? db.prepare(`
        SELECT sm.id, sm.user_id, sm.member_role, sm.department_id, sm.class_id, sm.guardian_of_student_user_id,
               sm.status, sm.created_at, u.full_name, u.email, u.education_level, u.age_group,
               c.name as class_name, wu.full_name as ward_name
        FROM school_memberships sm
        JOIN users u ON u.id = sm.user_id
        LEFT JOIN school_classes c ON c.id = sm.class_id
        LEFT JOIN users wu ON wu.id = sm.guardian_of_student_user_id
        WHERE sm.school_id = ?
        ORDER BY sm.member_role ASC, u.full_name ASC
      `).all(schoolId)
    : [];

  const assignedClassIds = memberships.map((m) => m.class_id).filter((id): id is number => Boolean(id));
  const guardianStudentIds = memberships
    .map((m) => m.guardian_of_student_user_id)
    .filter((id): id is number => Boolean(id));

  const lessons = db.prepare(`
    SELECT l.*, c.name as class_name, u.full_name as teacher_name
    FROM school_lessons l
    JOIN school_classes c ON c.id = l.class_id
    JOIN users u ON u.id = l.teacher_user_id
    WHERE l.school_id = ?
    ORDER BY l.created_at DESC
  `).all(schoolId) as Array<Record<string, unknown>>;

  const visibleLessons = isStaff
    ? lessons
    : lessons.filter((l) => assignedClassIds.length === 0 || assignedClassIds.includes(Number(l.class_id)));

  const assignments = db.prepare(`
    SELECT a.*, c.name as class_name, u.full_name as teacher_name
    FROM school_assignments a
    JOIN school_classes c ON c.id = a.class_id
    JOIN users u ON u.id = a.teacher_user_id
    WHERE a.school_id = ?
    ORDER BY a.due_date ASC, a.created_at DESC
  `).all(schoolId) as Array<Record<string, unknown>>;

  const submissions = isStaff
    ? db.prepare(`
        SELECT s.*, a.title as assignment_title, a.max_score, a.is_exam, u.full_name as student_name
        FROM assignment_submissions s
        JOIN school_assignments a ON a.id = s.assignment_id
        JOIN users u ON u.id = s.student_user_id
        WHERE s.school_id = ?
        ORDER BY s.submitted_at DESC
      `).all(schoolId)
    : db.prepare(`
        SELECT s.*, a.title as assignment_title, a.max_score, a.is_exam, u.full_name as student_name
        FROM assignment_submissions s
        JOIN school_assignments a ON a.id = s.assignment_id
        JOIN users u ON u.id = s.student_user_id
        WHERE s.school_id = ? AND (s.student_user_id = ? ${guardianStudentIds.length ? `OR s.student_user_id IN (${guardianStudentIds.map(() => '?').join(',')})` : ''})
        ORDER BY s.submitted_at DESC
      `).all(schoolId, req.authUser!.id, ...guardianStudentIds);

  const attendance = isStaff
    ? db.prepare(`
        SELECT att.*, c.name as class_name, u.full_name as student_name
        FROM school_attendance att
        JOIN school_classes c ON c.id = att.class_id
        JOIN users u ON u.id = att.student_user_id
        WHERE att.school_id = ?
        ORDER BY att.attendance_date DESC
        LIMIT 120
      `).all(schoolId)
    : db.prepare(`
        SELECT att.*, c.name as class_name, u.full_name as student_name
        FROM school_attendance att
        JOIN school_classes c ON c.id = att.class_id
        JOIN users u ON u.id = att.student_user_id
        WHERE att.school_id = ? AND (att.student_user_id = ? ${guardianStudentIds.length ? `OR att.student_user_id IN (${guardianStudentIds.map(() => '?').join(',')})` : ''})
        ORDER BY att.attendance_date DESC
        LIMIT 60
      `).all(schoolId, req.authUser!.id, ...guardianStudentIds);

  const communications = db.prepare(`
    SELECT sc.*, u.full_name as sender_name
    FROM school_communications sc
    JOIN users u ON u.id = sc.sender_user_id
    WHERE sc.school_id = ?
    ORDER BY sc.created_at DESC
    LIMIT 40
  `).all(schoolId);

  const sessions = db.prepare(`
    SELECT * FROM school_sessions WHERE school_id = ? ORDER BY is_active DESC, start_date DESC
  `).all(schoolId);

  const studentCount = (db.prepare(`SELECT COUNT(*) as c FROM school_memberships WHERE school_id = ? AND member_role = 'student' AND status = 'active'`).get(schoolId) as { c: number }).c;
  const teacherCount = (db.prepare(`SELECT COUNT(*) as c FROM school_memberships WHERE school_id = ? AND member_role = 'teacher' AND status = 'active'`).get(schoolId) as { c: number }).c;
  const avgScoreRow = db.prepare(`SELECT ROUND(AVG(score), 1) as avg FROM assignment_submissions WHERE school_id = ? AND status = 'graded'`).get(schoolId) as { avg: number | null };

  res.json({
    school,
    myRoles,
    isSchoolAdmin,
    isStaff,
    isGuardian,
    metrics: {
      students: studentCount,
      teachers: teacherCount,
      departments: departments.length,
      classes: classes.length,
      lessons: visibleLessons.length,
      assignments: assignments.length,
      averageGradedScore: avgScoreRow.avg,
    },
    sessions,
    departments,
    classes,
    roster,
    lessons: visibleLessons,
    assignments,
    submissions,
    attendance,
    communications,
  });
});

router.post('/:schoolId/departments', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin'])) {
    return res.status(403).json({ error: 'Only school administrators can create departments.' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (name.length < 2) return res.status(400).json({ error: 'Department name is required.' });

  const ins = db.prepare(`
    INSERT INTO school_departments (school_id, name, description)
    VALUES (?, ?, ?)
  `).run(schoolId, name, description);
  recordAudit(req.authUser!.id, 'school_department_created', 'school_department', Number(ins.lastInsertRowid), req.ip || '', { schoolId, name });
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/:schoolId/sessions', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin'])) {
    return res.status(403).json({ error: 'Only school administrators can configure academic sessions.' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const termLabel = typeof req.body?.termLabel === 'string' && req.body.termLabel.trim() ? req.body.termLabel.trim() : 'Term 1';
  const startDate = typeof req.body?.startDate === 'string' ? req.body.startDate.trim() : '';
  const endDate = typeof req.body?.endDate === 'string' ? req.body.endDate.trim() : '';
  const isActive = req.body?.isActive !== false ? 1 : 0;

  if (name.length < 3 || !startDate || !endDate) {
    return res.status(400).json({ error: 'Session name, start date, and end date are required.' });
  }

  const id = db.transaction(() => {
    if (isActive === 1) {
      db.prepare(`UPDATE school_sessions SET is_active = 0 WHERE school_id = ?`).run(schoolId);
    }
    const ins = db.prepare(`
      INSERT INTO school_sessions (school_id, name, term_label, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(schoolId, name, termLabel, startDate, endDate, isActive);
    return Number(ins.lastInsertRowid);
  })();

  recordAudit(req.authUser!.id, 'school_session_created', 'school_session', id, req.ip || '', { schoolId, name, termLabel });
  return res.status(201).json({ id });
});

router.get('/:schoolId/report-card/:studentUserId', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const studentUserId = Number(req.params.studentUserId);
  const memberships = assertSchoolMember(schoolId, req.authUser!.id);

  if (!memberships) {
    recordSecurityEvent(
      'school_cross_tenant_denied',
      'warning',
      req.authUser!.id,
      req.ip || '',
      `Unauthorized report card request for school #${schoolId}`
    );
    return res.status(403).json({ error: 'Access denied: not an active member of this school.' });
  }

  const isStaff = memberships.some((m) => m.member_role === 'school_admin' || m.member_role === 'teacher');
  const isSelf = req.authUser!.id === studentUserId;
  const isLinkedGuardian = memberships.some(
    (m) => m.member_role === 'guardian' && m.guardian_of_student_user_id === studentUserId
  );

  if (!isStaff && !isSelf && !isLinkedGuardian) {
    recordSecurityEvent(
      'school_report_card_unauthorized',
      'warning',
      req.authUser!.id,
      req.ip || '',
      `User #${req.authUser!.id} blocked from reading student #${studentUserId} report card in school #${schoolId}`
    );
    return res.status(403).json({ error: 'You may only view your own report card, linked ward report cards, or students in your school.' });
  }

  const school = db.prepare(`SELECT id, name, school_type, country, city FROM schools WHERE id = ?`).get(schoolId);
  const student = db.prepare(`
    SELECT u.id, u.full_name, u.education_level, sm.class_id, c.name as class_name
    FROM school_memberships sm
    JOIN users u ON u.id = sm.user_id
    LEFT JOIN school_classes c ON c.id = sm.class_id
    WHERE sm.school_id = ? AND sm.user_id = ? AND sm.member_role = 'student' AND sm.status = 'active'
  `).get(schoolId, studentUserId);

  if (!school || !student) {
    return res.status(404).json({ error: 'Enrolled student record not found in this school.' });
  }

  const activeSession = db.prepare(`
    SELECT id, name, term_label, start_date, end_date FROM school_sessions
    WHERE school_id = ? ORDER BY is_active DESC, start_date DESC LIMIT 1
  `).get(schoolId) || null;

  const subjectGrades = db.prepare(`
    SELECT a.subject,
           COUNT(sub.id) as assessments_count,
           ROUND(AVG(CASE WHEN sub.status = 'graded' THEN (sub.score * 100.0 / NULLIF(a.max_score, 0)) END), 1) as avg_percent,
           SUM(CASE WHEN sub.status = 'graded' THEN sub.score ELSE 0 END) as total_score,
           SUM(CASE WHEN sub.status = 'graded' THEN a.max_score ELSE 0 END) as total_max
    FROM assignment_submissions sub
    JOIN school_assignments a ON a.id = sub.assignment_id
    WHERE sub.school_id = ? AND sub.student_user_id = ?
    GROUP BY a.subject
    ORDER BY a.subject ASC
  `).all(schoolId, studentUserId) as Array<{
    subject: string;
    assessments_count: number;
    avg_percent: number | null;
    total_score: number;
    total_max: number;
  }>;

  const attendanceSummary = db.prepare(`
    SELECT
      COUNT(*) as total_days,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_days
    FROM school_attendance
    WHERE school_id = ? AND student_user_id = ?
  `).get(schoolId, studentUserId);

  const gradedSubjects = subjectGrades.filter((g) => g.avg_percent !== null);
  const overallAverage = gradedSubjects.length
    ? Number((gradedSubjects.reduce((acc, g) => acc + Number(g.avg_percent || 0), 0) / gradedSubjects.length).toFixed(1))
    : null;

  return res.json({
    school,
    student,
    activeSession,
    overallAverage,
    subjectGrades,
    attendanceSummary,
    generatedAt: new Date().toISOString(),
  });
});

router.post('/:schoolId/classes', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Insufficient permissions in this institution.' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const gradeLevel = typeof req.body?.gradeLevel === 'string' && req.body.gradeLevel.trim() ? req.body.gradeLevel.trim() : 'General';
  const scheduleSummary = typeof req.body?.scheduleSummary === 'string' ? req.body.scheduleSummary.trim() : '';
  const departmentId = Number(req.body?.departmentId) || null;
  const teacherUserId = Number(req.body?.teacherUserId) || req.authUser!.id;

  if (name.length < 2 || subject.length < 2) {
    return res.status(400).json({ error: 'Class name and subject are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO school_classes (school_id, department_id, name, subject, grade_level, teacher_user_id, schedule_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(schoolId, departmentId, name, subject, gradeLevel, teacherUserId, scheduleSummary);

  recordAudit(req.authUser!.id, 'school_class_created', 'school_class', Number(ins.lastInsertRowid), req.ip || '', { schoolId, name, subject });
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/:schoolId/members', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin'])) {
    return res.status(403).json({ error: 'Only school administrators can add teachers, students, or guardians.' });
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const memberRole = ['teacher', 'student', 'guardian', 'school_admin'].includes(req.body?.memberRole)
    ? req.body.memberRole
    : 'student';
  const classId = Number(req.body?.classId) || null;
  const departmentId = Number(req.body?.departmentId) || null;
  const wardEmail = typeof req.body?.wardEmail === 'string' ? req.body.wardEmail.trim().toLowerCase() : '';

  const targetUser = db.prepare(`SELECT id, full_name FROM users WHERE email = ? AND status = 'active'`).get(email) as
    | { id: number; full_name: string }
    | undefined;
  if (!targetUser) {
    return res.status(404).json({ error: 'No active IFIOK-EN account matches that email. Ask the user to register first.' });
  }

  let guardianOfId: number | null = null;
  if (memberRole === 'guardian' && wardEmail) {
    const ward = db.prepare(`SELECT id FROM users WHERE email = ?`).get(wardEmail) as { id: number } | undefined;
    guardianOfId = ward?.id ?? null;
  }

  db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO school_memberships (
        school_id, user_id, member_role, department_id, class_id, guardian_of_student_user_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(schoolId, targetUser.id, memberRole, departmentId, classId, guardianOfId);

    assignRole(targetUser.id, memberRole, req.authUser!.id);
    if (memberRole === 'guardian' && guardianOfId) {
      db.prepare(`UPDATE users SET guardian_consent_verified = 1 WHERE id = ?`).run(guardianOfId);
    }

    const school = db.prepare(`SELECT name FROM schools WHERE id = ?`).get(schoolId) as { name: string } | undefined;
    createNotification(
      targetUser.id,
      'academy',
      `Added to ${school?.name || 'School Portal'}`,
      `Your account has been assigned the "${memberRole.replace('_', ' ')}" role inside ${school?.name || 'an institution'}.`,
      'academy'
    );
    recordAudit(req.authUser!.id, 'school_member_added', 'school_membership', `${schoolId}:${targetUser.id}`, req.ip || '', {
      memberRole,
      classId,
    });
  })();

  return res.status(201).json({ ok: true, userId: targetUser.id, memberRole });
});

router.post('/:schoolId/lessons', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Only authorized teachers or school admins can publish lessons.' });
  }
  const classId = Number(req.body?.classId);
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim() : 'General';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const contentMarkdown = typeof req.body?.contentMarkdown === 'string' ? req.body.contentMarkdown.trim() : '';
  const materialUrl =
    (typeof req.body?.materialUrl === 'string' && req.body.materialUrl.startsWith('/api/uploads/') ? req.body.materialUrl : '') ||
    sanitizeHttpUrl(req.body?.materialUrl);
  const scheduledAt = typeof req.body?.scheduledAt === 'string' ? req.body.scheduledAt.trim() : '';
  const languageCode = typeof req.body?.languageCode === 'string' ? req.body.languageCode.trim().slice(0, 8) : 'en';

  const cls = db.prepare(`SELECT id FROM school_classes WHERE id = ? AND school_id = ?`).get(classId, schoolId);
  if (!cls) return res.status(404).json({ error: 'Class does not belong to this institution.' });
  if (title.length < 3 || contentMarkdown.length < 15) {
    return res.status(400).json({ error: 'Lesson title and structured lesson content (min 15 chars) are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO school_lessons (school_id, class_id, teacher_user_id, subject, title, content_markdown, material_url, scheduled_at, language_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(schoolId, classId, req.authUser!.id, subject, title, contentMarkdown, materialUrl, scheduledAt, languageCode);

  recordAudit(req.authUser!.id, 'school_lesson_created', 'school_lesson', Number(ins.lastInsertRowid), req.ip || '', { schoolId, classId });
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/:schoolId/assignments', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Only teachers or school admins can create assignments and examinations.' });
  }
  const classId = Number(req.body?.classId);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim() : 'General';
  const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
  const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate.trim() : '2026-12-31';
  const maxScore = Math.max(10, Math.min(1000, Number(req.body?.maxScore) || 100));
  const isExam = req.body?.isExam ? 1 : 0;
  const timeLimitMinutes = Math.max(0, Math.min(300, Number(req.body?.timeLimitMinutes) || 0));
  const questions = Array.isArray(req.body?.questions) ? req.body.questions.slice(0, 50) : [];

  const cls = db.prepare(`SELECT id FROM school_classes WHERE id = ? AND school_id = ?`).get(classId, schoolId);
  if (!cls) return res.status(404).json({ error: 'Class not found in this school.' });
  if (title.length < 3 || instructions.length < 10) {
    return res.status(400).json({ error: 'Title and clear instructions are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO school_assignments (
      school_id, class_id, teacher_user_id, title, subject, instructions, due_date,
      max_score, is_exam, time_limit_minutes, questions_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(schoolId, classId, req.authUser!.id, title, subject, instructions, dueDate, maxScore, isExam, timeLimitMinutes, JSON.stringify(questions));

  recordAudit(req.authUser!.id, 'school_assignment_created', 'school_assignment', Number(ins.lastInsertRowid), req.ip || '', {
    schoolId,
    isExam,
  });
  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

router.post('/:schoolId/assignments/:assignmentId/submit', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const assignmentId = Number(req.params.assignmentId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['student', 'school_admin'])) {
    return res.status(403).json({ error: 'Only enrolled students of this institution can submit work.' });
  }

  const assignment = db.prepare(`
    SELECT * FROM school_assignments WHERE id = ? AND school_id = ?
  `).get(assignmentId, schoolId) as
    | { id: number; max_score: number; questions_json: string; title: string; teacher_user_id: number }
    | undefined;
  if (!assignment) return res.status(404).json({ error: 'Assignment not found in this institution.' });

  const submissionText = typeof req.body?.submissionText === 'string' ? req.body.submissionText.trim() : '';
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

  const questions = JSON.parse(assignment.questions_json || '[]') as Array<{
    question: string;
    options?: string[];
    correctIndex?: number;
  }>;

  // Objective auto-grading when MCQ questions exist
  let autoScore: number | null = null;
  let status: 'submitted' | 'graded' = 'submitted';
  let feedback = '';

  if (questions.length > 0 && questions.every((q) => typeof q.correctIndex === 'number')) {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (Number(answers[idx]) === q.correctIndex) correct += 1;
    });
    autoScore = Math.round((correct / questions.length) * assignment.max_score);
    status = 'graded';
    feedback = `Auto-graded objective assessment: ${correct}/${questions.length} correct.`;
  } else if (submissionText.length < 5 && answers.length === 0) {
    return res.status(400).json({ error: 'Provide written answers or quiz responses before submitting.' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO assignment_submissions (
      assignment_id, school_id, student_user_id, submission_text, answers_json, score, feedback, status, submitted_at, graded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), CASE WHEN ? = 'graded' THEN datetime('now') ELSE NULL END)
  `).run(
    assignmentId,
    schoolId,
    req.authUser!.id,
    submissionText,
    JSON.stringify(answers),
    autoScore,
    feedback,
    status,
    status
  );

  createNotification(
    assignment.teacher_user_id,
    'academy',
    'Student Submission Received',
    `${req.authUser!.full_name} submitted "${assignment.title}".`,
    'academy'
  );

  return res.status(201).json({ status, score: autoScore, feedback });
});

router.post('/:schoolId/submissions/:submissionId/grade', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const submissionId = Number(req.params.submissionId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Only authorized teachers or school admins can grade submissions.' });
  }

  const sub = db.prepare(`
    SELECT s.id, s.student_user_id, a.title, a.max_score
    FROM assignment_submissions s
    JOIN school_assignments a ON a.id = s.assignment_id
    WHERE s.id = ? AND s.school_id = ?
  `).get(submissionId, schoolId) as
    | { id: number; student_user_id: number; title: string; max_score: number }
    | undefined;
  if (!sub) return res.status(404).json({ error: 'Submission not found in this institution.' });

  const score = Number(req.body?.score);
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';
  if (!Number.isFinite(score) || score < 0 || score > sub.max_score) {
    return res.status(400).json({ error: `Score must be between 0 and ${sub.max_score}.` });
  }

  db.prepare(`
    UPDATE assignment_submissions
    SET score = ?, feedback = ?, graded_by_user_id = ?, status = 'graded', graded_at = datetime('now')
    WHERE id = ? AND school_id = ?
  `).run(score, feedback, req.authUser!.id, submissionId, schoolId);

  createNotification(
    sub.student_user_id,
    'academy',
    'Assignment Graded',
    `Your submission for "${sub.title}" received ${score}/${sub.max_score}.`,
    'academy'
  );

  return res.json({ ok: true, score, feedback });
});

router.post('/:schoolId/attendance', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Only teachers or school admins can record attendance.' });
  }
  const classId = Number(req.body?.classId);
  const studentUserId = Number(req.body?.studentUserId);
  const attendanceDate = typeof req.body?.attendanceDate === 'string' && req.body.attendanceDate.trim()
    ? req.body.attendanceDate.trim().slice(0, 20)
    : new Date().toISOString().slice(0, 10);
  const status = ['present', 'absent', 'late', 'excused'].includes(req.body?.status) ? req.body.status : 'present';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

  const cls = db.prepare(`SELECT id FROM school_classes WHERE id = ? AND school_id = ?`).get(classId, schoolId);
  const studentMember = db.prepare(`
    SELECT id FROM school_memberships WHERE school_id = ? AND user_id = ? AND member_role = 'student' AND status = 'active'
  `).get(schoolId, studentUserId);
  if (!cls || !studentMember) {
    return res.status(404).json({ error: 'Student or class not found in this school.' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO school_attendance (school_id, class_id, student_user_id, attendance_date, status, recorded_by_user_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(schoolId, classId, studentUserId, attendanceDate, status, req.authUser!.id, notes);

  return res.status(201).json({ ok: true });
});

router.post('/:schoolId/communications', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!assertSchoolMember(schoolId, req.authUser!.id, ['school_admin', 'teacher'])) {
    return res.status(403).json({ error: 'Only teachers or school admins can publish school notices.' });
  }
  const targetRole = ['all', 'teachers', 'students', 'guardians'].includes(req.body?.targetRole) ? req.body.targetRole : 'all';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const classId = Number(req.body?.classId) || null;

  if (title.length < 3 || message.length < 8) {
    return res.status(400).json({ error: 'Notice title and message are required.' });
  }

  const ins = db.prepare(`
    INSERT INTO school_communications (school_id, sender_user_id, target_role, class_id, title, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(schoolId, req.authUser!.id, targetRole, classId, title, message);

  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

export default router;
