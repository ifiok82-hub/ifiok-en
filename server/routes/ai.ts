import path from 'node:path';
import { Router } from 'express';
import { db, getSettingsMap } from '../db.ts';
import {
  ACADEMIC_SUBJECTS,
  AiGuardError,
  explainUploadedDocument,
  generateStructuredPracticeQuiz,
  generateStudyRecommendations,
  getAiProviderStatus,
  markStudentAnswer,
  runProfessorCompletion,
  SUPPORTED_AI_LANGUAGES,
  testAiProviderConnection,
} from '../lib/aiProvider.ts';
import {
  containsMaliciousScriptSignature,
  decryptSensitive,
  detectSafeDigitalFile,
  extractReadableDocumentText,
} from '../lib/crypto.ts';
import {
  recordAudit,
  recordSecurityEvent,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';

const router = Router();

function getUserSafetyProfile(userId: number) {
  const row = db.prepare(`
    SELECT id, education_level, age_group, guardian_consent_verified, preferred_language
    FROM users WHERE id = ?
  `).get(userId) as
    | {
        id: number;
        education_level: string;
        age_group: string;
        guardian_consent_verified: number;
        preferred_language: string;
      }
    | undefined;
  return (
    row || {
      id: userId,
      education_level: 'undergraduate',
      age_group: 'adult',
      guardian_consent_verified: 1,
      preferred_language: 'en',
    }
  );
}

router.get('/status', (_req, res) => {
  const status = getAiProviderStatus();
  res.json({
    ...status,
    subjects: ACADEMIC_SUBJECTS,
    assistantIdentity: 'IFIOK Professor (AI Learning Assistant)',
    tagline: 'Your Personal Global Learning Assistant',
  });
});

router.get('/sessions', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, subject, language_code, mode, title, course_id, school_id, age_restricted, created_at, updated_at
    FROM ai_tutor_sessions
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 30
  `).all(req.authUser!.id);
  res.json({ sessions });
});

router.get('/sessions/:id', requireAuth, (req, res) => {
  const sessionId = Number(req.params.id);
  const session = db.prepare(`
    SELECT * FROM ai_tutor_sessions WHERE id = ? AND user_id = ?
  `).get(sessionId, req.authUser!.id);
  if (!session) return res.status(404).json({ error: 'Tutoring session not found.' });

  const messages = db.prepare(`
    SELECT id, role, content, tokens_estimated, created_at
    FROM ai_tutor_messages
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(sessionId);

  res.json({ session, messages });
});

router.post('/chat', requireAuth, async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim()
    ? req.body.subject.trim().slice(0, 80)
    : 'General Studies';
  const languageCode = typeof req.body?.languageCode === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.body.languageCode)
    ? req.body.languageCode
    : 'en';
  const allowedModes = new Set([
    'tutor',
    'lesson',
    'homework',
    'practice_quiz',
    'exam_prep',
    'study_plan',
    'code_stem',
    'teacher_prep',
  ]);
  const mode = allowedModes.has(req.body?.mode) ? req.body.mode : 'tutor';
  const sessionIdInput = Number(req.body?.sessionId) || 0;
  const courseId = Number(req.body?.courseId) || null;
  const schoolId = Number(req.body?.schoolId) || null;

  if (prompt.length < 2 || prompt.length > 4000) {
    return res.status(400).json({ error: 'Please enter a clear question or learning prompt (2–4000 characters).' });
  }

  // Only teacher/instructor/school_admin/super_admin can use teacher_prep
  if (mode === 'teacher_prep') {
    const canTeach = req.authUser!.roles.some((r) => ['teacher', 'instructor', 'school_admin', 'super_admin'].includes(r));
    if (!canTeach) {
      return res.status(403).json({ error: 'Teacher preparation mode requires verified teacher or instructor access.' });
    }
  }

  // Build verified course context ONLY if course is free or user holds unlocked entitlement
  let courseContext = '';
  if (courseId) {
    const course = db.prepare(`
      SELECT id, title, subject, level, price_pi, description, syllabus_json, locked_materials_enc
      FROM courses WHERE id = ? AND approval_status = 'approved'
    `).get(courseId) as
      | {
          id: number;
          title: string;
          subject: string;
          level: string;
          price_pi: number;
          description: string;
          syllabus_json: string;
          locked_materials_enc: string;
        }
      | undefined;
    if (course) {
      const unlocked =
        course.price_pi === 0 ||
        Boolean(
          db.prepare(`
            SELECT id FROM entitlements WHERE user_id = ? AND item_type = 'course' AND item_id = ? AND is_unlocked = 1
          `).get(req.authUser!.id, course.id)
        );
      courseContext = `Course: ${course.title} (${course.subject || 'IFIOK SCHOOL'}, ${course.level})\nSyllabus: ${course.syllabus_json}\nDescription: ${course.description}`;
      if (unlocked && course.locked_materials_enc) {
        courseContext += `\nMaterials:\n${decryptSensitive(course.locked_materials_enc).slice(0, 1500)}`;
      }
    }
  }

  const profile = getUserSafetyProfile(req.authUser!.id);
  const isMinor = profile.age_group === 'under_13' || profile.age_group === 'teen_13_17';

  let sessionId = sessionIdInput;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (sessionId > 0) {
    const existing = db.prepare(`SELECT id FROM ai_tutor_sessions WHERE id = ? AND user_id = ?`).get(sessionId, req.authUser!.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    history = db.prepare(`
      SELECT role, content FROM ai_tutor_messages WHERE session_id = ? ORDER BY id DESC LIMIT 8
    `).all(sessionId).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
  }

  try {
    const result = await runProfessorCompletion({
      userId: req.authUser!.id,
      userRoles: req.authUser!.roles,
      schoolId,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode,
      subject,
      mode,
      prompt,
      history,
      courseContext,
    });

    db.transaction(() => {
      if (!sessionId) {
        const ins = db.prepare(`
          INSERT INTO ai_tutor_sessions (user_id, school_id, course_id, subject, language_code, mode, title, age_restricted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.authUser!.id,
          schoolId,
          courseId,
          subject,
          languageCode,
          mode,
          `${subject}: ${prompt.slice(0, 56)}`,
          isMinor ? 1 : 0
        );
        sessionId = Number(ins.lastInsertRowid);
      } else {
        db.prepare(`UPDATE ai_tutor_sessions SET updated_at = datetime('now'), language_code = ? WHERE id = ?`).run(
          languageCode,
          sessionId
        );
      }

      db.prepare(`
        INSERT INTO ai_tutor_messages (session_id, role, content, tokens_estimated)
        VALUES (?, 'user', ?, ?)
      `).run(sessionId, prompt, result.promptTokens);

      db.prepare(`
        INSERT INTO ai_tutor_messages (session_id, role, content, tokens_estimated)
        VALUES (?, 'assistant', ?, ?)
      `).run(sessionId, result.reply, result.completionTokens);
    })();

    return res.json({
      sessionId,
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      ageRestricted: isMinor,
      assistantDisclaimer: 'IFIOK Professor is an AI educational assistant supporting your study alongside human educators.',
    });
  } catch (err) {
    if (err instanceof AiGuardError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'IFIOK Professor request failed.' });
  }
});

router.post('/translate', requireAuth, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const targetLanguage = typeof req.body?.targetLanguage === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.body.targetLanguage)
    ? req.body.targetLanguage
    : 'en';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : 'Academic Studies';

  if (text.length < 3 || text.length > 6000) {
    return res.status(400).json({ error: 'Provide educational text between 3 and 6000 characters to translate.' });
  }

  const profile = getUserSafetyProfile(req.authUser!.id);
  try {
    const out = await runProfessorCompletion({
      userId: req.authUser!.id,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode: targetLanguage,
      subject,
      mode: 'translate',
      prompt: `Translate the following educational lesson/material accurately, preserving technical and academic terminology:\n\n${text}`,
    });

    return res.json({
      translatedText: out.reply,
      targetLanguage,
      provider: out.provider,
      model: out.model,
    });
  } catch (err) {
    if (err instanceof AiGuardError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Translation failed.' });
  }
});

router.post('/practice-quiz', requireAuth, async (req, res) => {
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim() : 'Mathematics';
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
  const languageCode = typeof req.body?.languageCode === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.body.languageCode)
    ? req.body.languageCode
    : 'en';
  const questionCount = Number(req.body?.questionCount) || 5;

  if (topic.length < 3 || topic.length > 200) {
    return res.status(400).json({ error: 'Specify a topic (3–200 characters) for practice questions.' });
  }

  const profile = getUserSafetyProfile(req.authUser!.id);
  try {
    const quiz = await generateStructuredPracticeQuiz({
      userId: req.authUser!.id,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode,
      subject,
      topic,
      questionCount,
    });
    return res.json({ quiz });
  } catch (err) {
    if (err instanceof AiGuardError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Quiz generation failed.' });
  }
});

router.post('/mark-answer', requireAuth, async (req, res) => {
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim() : 'General Studies';
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const markingGuide = typeof req.body?.markingGuide === 'string' ? req.body.markingGuide.trim() : '';
  const studentAnswer = typeof req.body?.studentAnswer === 'string' ? req.body.studentAnswer.trim() : '';
  const maxScore = Number(req.body?.maxScore) || 10;
  const languageCode = typeof req.body?.languageCode === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.body.languageCode)
    ? req.body.languageCode
    : 'en';

  if (question.length < 5 || studentAnswer.length < 2) {
    return res.status(400).json({ error: 'Please provide both the question and the student answer to mark.' });
  }

  const profile = getUserSafetyProfile(req.authUser!.id);
  try {
    const out = await markStudentAnswer({
      userId: req.authUser!.id,
      userRoles: req.authUser!.roles,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode,
      subject,
      question,
      markingGuide,
      studentAnswer,
      maxScore,
    });
    return res.json({
      feedback: out.reply,
      provider: out.provider,
      model: out.model,
      latencyMs: out.latencyMs,
    });
  } catch (err) {
    if (err instanceof AiGuardError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Answer marking failed.' });
  }
});

router.post('/explain-document', requireAuth, async (req, res) => {
  const subject = typeof req.body?.subject === 'string' && req.body.subject.trim() ? req.body.subject.trim() : 'General Studies';
  const languageCode = typeof req.body?.languageCode === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.body.languageCode)
    ? req.body.languageCode
    : 'en';
  const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim().slice(0, 500) : '';
  const fileName = typeof req.body?.fileName === 'string' ? path.basename(req.body.fileName.trim()) : '';
  const rawBase64 = typeof req.body?.fileBase64 === 'string' ? req.body.fileBase64.trim() : '';
  let documentText = typeof req.body?.documentText === 'string' ? req.body.documentText.trim() : '';

  if (rawBase64) {
    const cleaned = rawBase64.replace(/^data:[^;]+;base64,/, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(cleaned, 'base64');
    } catch {
      return res.status(400).json({ error: 'Invalid base64 document payload.' });
    }
    if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Uploaded document must be under 5 MB.' });
    }
    const detected = detectSafeDigitalFile(buf, fileName || 'notes.txt');
    if (!detected || !['pdf', 'txt', 'md', 'csv'].includes(detected.ext)) {
      return res.status(400).json({ error: 'Supported document formats for instant AI analysis are .pdf, .txt, .md, and .csv.' });
    }
    if (containsMaliciousScriptSignature(buf)) {
      return res.status(400).json({ error: 'Document rejected due to embedded active script patterns.' });
    }
    const extracted = extractReadableDocumentText(buf, detected.ext);
    if (extracted.length < 20) {
      return res.status(400).json({
        error: 'Could not extract selectable text from this PDF (it may be a scanned image). Please paste the text notes directly.',
      });
    }
    documentText = extracted;
  }

  if (documentText.length < 20 || documentText.length > 15000) {
    return res.status(400).json({ error: 'Provide document text or upload a text-readable PDF/notes file (20–15,000 characters).' });
  }

  const profile = getUserSafetyProfile(req.authUser!.id);
  try {
    const out = await explainUploadedDocument({
      userId: req.authUser!.id,
      userRoles: req.authUser!.roles,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode,
      subject,
      fileName,
      documentText,
      instruction,
    });
    return res.json({
      explanation: out.reply,
      extractedCharacters: documentText.length,
      provider: out.provider,
      model: out.model,
      latencyMs: out.latencyMs,
    });
  } catch (err) {
    if (err instanceof AiGuardError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Document explanation failed.' });
  }
});

router.get('/recommendations', requireAuth, async (req, res) => {
  const uid = req.authUser!.id;
  const languageCode = typeof req.query.languageCode === 'string' && SUPPORTED_AI_LANGUAGES.some((l) => l.code === req.query.languageCode)
    ? req.query.languageCode
    : 'en';

  const enrolments = db.prepare(`
    SELECT c.title, c.subject, c.category, e.progress_percent, e.status
    FROM enrolments e JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ?
    ORDER BY e.enrolled_at DESC LIMIT 10
  `).all(uid) as Array<{ title: string; subject: string; category: string; progress_percent: number; status: string }>;

  const submissions = db.prepare(`
    SELECT a.title, a.subject, a.max_score, sub.score, sub.status
    FROM assignment_submissions sub
    JOIN school_assignments a ON a.id = sub.assignment_id
    WHERE sub.student_user_id = ?
    ORDER BY sub.submitted_at DESC LIMIT 12
  `).all(uid) as Array<{ title: string; subject: string; max_score: number; score: number | null; status: string }>;

  const recentTopics = db.prepare(`
    SELECT subject, title, mode, created_at
    FROM ai_tutor_sessions WHERE user_id = ?
    ORDER BY updated_at DESC LIMIT 6
  `).all(uid) as Array<{ subject: string; title: string; mode: string; created_at: string }>;

  const snapshot = {
    enrolledCoursesCount: enrolments.length,
    submissionsCount: submissions.length,
    recentSessionsCount: recentTopics.length,
    enrolments,
    submissions,
    recentTopics,
  };

  if (enrolments.length === 0 && submissions.length === 0 && recentTopics.length === 0) {
    return res.json({
      snapshot,
      recommendationsText:
        'No course enrolments, graded assignments, or AI study sessions recorded yet. Start by asking IFIOK Professor a question or enrolling in a course in IFIOK SCHOOL to receive tailored study recommendations.',
      aiGenerated: false,
    });
  }

  const profile = getUserSafetyProfile(uid);
  const summaryText = [
    `Course Enrolments: ${enrolments.map((e) => `${e.title} (${e.subject || e.category}, ${e.progress_percent}%, ${e.status})`).join('; ') || 'None'}`,
    `School Assignment Scores: ${submissions.map((s) => `${s.title} (${s.subject}: ${s.score ?? 'pending'}/${s.max_score})`).join('; ') || 'None'}`,
    `Recent Tutoring Sessions: ${recentTopics.map((t) => `${t.subject} - ${t.title}`).join('; ') || 'None'}`,
  ].join('\n');

  try {
    const out = await generateStudyRecommendations({
      userId: uid,
      userRoles: req.authUser!.roles,
      ageGroup: profile.age_group,
      educationLevel: profile.education_level,
      guardianConsentVerified: profile.guardian_consent_verified,
      languageCode,
      progressSummary: summaryText,
    });
    return res.json({
      snapshot,
      recommendationsText: out.reply,
      provider: out.provider,
      model: out.model,
      aiGenerated: true,
    });
  } catch (err) {
    return res.json({
      snapshot,
      recommendationsText: err instanceof AiGuardError ? err.message : 'AI provider is not configured for live study plan generation yet; see your real recorded progress metrics above.',
      aiGenerated: false,
    });
  }
});

router.post('/safety-report', requireAuth, (req, res) => {
  const contextType = ['ai_professor', 'classroom', 'lesson', 'peer'].includes(req.body?.contextType)
    ? req.body.contextType
    : 'ai_professor';
  const schoolId = Number(req.body?.schoolId) || null;
  const referenceId = Number(req.body?.referenceId) || 0;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';

  if (reason.length < 4 || details.length < 10) {
    return res.status(400).json({ error: 'Please include a clear reason and details for your safety report.' });
  }

  const ins = db.prepare(`
    INSERT INTO student_safety_reports (reporter_user_id, school_id, context_type, reference_id, reason, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.authUser!.id, schoolId, contextType, referenceId, reason, details);

  recordSecurityEvent(
    'child_safety_report_submitted',
    'warning',
    req.authUser!.id,
    req.ip || '',
    `Safety report (${contextType}): ${reason}`
  );
  recordAudit(req.authUser!.id, 'safety_report_submitted', 'student_safety_report', Number(ins.lastInsertRowid), req.ip || '', {
    contextType,
    schoolId,
  });

  return res.status(201).json({ id: Number(ins.lastInsertRowid) });
});

// ================= ADMIN AI GOVERNANCE & MONITORING =================
router.get('/admin/monitoring', requireAuth, requireRole('super_admin', 'moderator'), (_req, res) => {
  const status = getAiProviderStatus();
  const settings = getSettingsMap();

  const summary = db.prepare(`
    SELECT
      COUNT(*) as totalCalls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCalls,
      SUM(CASE WHEN status = 'blocked_safety' THEN 1 ELSE 0 END) as safetyBlocks,
      SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) as rateLimits,
      SUM(CASE WHEN status = 'provider_error' THEN 1 ELSE 0 END) as providerErrors,
      COALESCE(SUM(prompt_tokens), 0) as totalPromptTokens,
      COALESCE(SUM(completion_tokens), 0) as totalCompletionTokens,
      COALESCE(SUM(estimated_cost_usd), 0) as totalEstimatedCostUsd
    FROM ai_usage_logs
  `).get();

  const recentLogs = db.prepare(`
    SELECT l.*, u.full_name as user_name, u.age_group
    FROM ai_usage_logs l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC
    LIMIT 60
  `).all();

  const safetyReports = db.prepare(`
    SELECT r.*, u.full_name as reporter_name
    FROM student_safety_reports r
    JOIN users u ON u.id = r.reporter_user_id
    ORDER BY r.created_at DESC
    LIMIT 40
  `).all();

  res.json({
    status,
    config: {
      provider: settings.ai_provider || 'gemini',
      model: settings.ai_model || 'gemini-4-hydrogen',
      dailyUserLimit: Number(settings.ai_daily_user_limit || 40),
      monthlyCostCapUsd: Number(settings.ai_monthly_cost_cap_usd || 50),
      childSafetyMode: settings.ai_child_safety_mode || 'strict',
    },
    summary,
    recentLogs,
    safetyReports,
  });
});

router.patch('/admin/config', requireAuth, requireRole('super_admin'), (req, res) => {
  const provider = req.body?.provider === 'openai_compatible' ? 'openai_compatible' : 'gemini';
  const model = typeof req.body?.model === 'string' && req.body.model.trim()
    ? req.body.model.trim().slice(0, 80)
    : 'gemini-4-hydrogen';
  const dailyUserLimit = Math.max(1, Math.min(500, Number(req.body?.dailyUserLimit) || 40));
  const monthlyCostCapUsd = Math.max(1, Math.min(5000, Number(req.body?.monthlyCostCapUsd) || 50));
  const childSafetyMode = req.body?.childSafetyMode === 'standard' ? 'standard' : 'strict';

  const upsert = db.prepare(`
    INSERT INTO platform_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `);

  db.transaction(() => {
    upsert.run('ai_provider', provider, req.authUser!.id);
    upsert.run('ai_model', model, req.authUser!.id);
    upsert.run('ai_daily_user_limit', String(dailyUserLimit), req.authUser!.id);
    upsert.run('ai_monthly_cost_cap_usd', String(monthlyCostCapUsd), req.authUser!.id);
    upsert.run('ai_child_safety_mode', childSafetyMode, req.authUser!.id);
    upsert.run('ai_last_verified_status', 'untested', req.authUser!.id);
    recordAudit(req.authUser!.id, 'ai_governance_updated', 'platform_settings', 'ai', req.ip || '', {
      provider,
      model,
      dailyUserLimit,
      monthlyCostCapUsd,
      childSafetyMode,
    });
  })();

  res.json({ status: getAiProviderStatus() });
});

router.post('/admin/test', requireAuth, requireRole('super_admin', 'moderator'), async (req, res) => {
  const result = await testAiProviderConnection();
  recordAudit(req.authUser!.id, 'ai_provider_tested', 'ai_provider', result.provider, req.ip || '', {
    ok: result.ok,
    model: result.model,
    latencyMs: result.latencyMs,
  });
  res.status(result.ok ? 200 : 502).json({ result, status: getAiProviderStatus() });
});

router.patch('/admin/safety-reports/:id', requireAuth, requireRole('super_admin', 'moderator'), (req, res) => {
  const id = Number(req.params.id);
  const status = ['open', 'reviewed', 'resolved'].includes(req.body?.status) ? req.body.status : 'reviewed';
  db.prepare(`UPDATE student_safety_reports SET status = ? WHERE id = ?`).run(status, id);
  recordAudit(req.authUser!.id, 'safety_report_updated', 'student_safety_report', id, req.ip || '', { status });
  res.json({ ok: true });
});

export default router;
