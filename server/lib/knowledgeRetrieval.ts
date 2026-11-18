import { db } from '../db.ts';

export interface AiCitation {
  sourceType: 'course' | 'teacher_submission' | 'school_lesson';
  sourceId: number;
  title: string;
  section: string;
  author: string;
  version: string;
}

export interface GroundedRetrievalResult {
  citations: AiCitation[];
  contextText: string;
  sourcedFromLibrary: boolean;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'how', 'why', 'when',
  'where', 'who', 'which', 'about', 'into', 'your', 'you', 'are', 'can', 'could',
  'please', 'explain', 'help', 'understand', 'lesson', 'topic', 'study', 'tell',
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 14);
}

function scoreMatch(haystack: string, keywords: string[], subjectBoost: boolean): number {
  const lower = haystack.toLowerCase();
  let score = subjectBoost ? 2 : 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 3;
  }
  return score;
}

export function retrieveGroundedEducationalContext(params: {
  userId: number;
  userRoles?: string[];
  query: string;
  subject?: string;
  courseId?: number | null;
  schoolId?: number | null;
}): GroundedRetrievalResult {
  const keywords = extractKeywords(`${params.query} ${params.subject || ''}`);
  const subjectLower = (params.subject || '').trim().toLowerCase();
  const isAdmin = Boolean(params.userRoles?.some((r) => ['super_admin', 'moderator'].includes(r)));

  const candidates: Array<{
    score: number;
    citation: AiCitation;
    snippet: string;
  }> = [];

  // 1. Approved public IFIOK SCHOOL courses (strictly respecting paid locked materials)
  const unlockedCourseIds = new Set<number>(
    (
      db.prepare(`
        SELECT e.item_id FROM entitlements e
        JOIN orders o ON o.id = e.order_id
        WHERE e.user_id = ? AND e.item_type = 'course' AND e.is_unlocked = 1 AND o.status IN ('paid', 'fulfilled')
      `).all(params.userId) as Array<{ item_id: number }>
    ).map((r) => r.item_id)
  );

  const courseRows = db.prepare(`
    SELECT c.id, c.title, c.subject, c.category, c.level, c.price_pi, c.description,
           c.syllabus_json, c.learning_objectives_json, c.modules_notes_json,
           c.author_name, c.version, i.user_id as instructor_user_id
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    WHERE c.approval_status = 'approved'
      AND COALESCE(c.moderation_action, '') NOT IN ('suspended', 'correction_requested', 'rejected')
  `).all() as Array<{
    id: number;
    title: string;
    subject: string;
    category: string;
    level: string;
    price_pi: number;
    description: string;
    syllabus_json: string;
    learning_objectives_json: string;
    modules_notes_json: string;
    author_name: string;
    version: string;
    instructor_user_id: number;
  }>;

  for (const c of courseRows) {
    const canReadLockedNotes =
      c.price_pi === 0 || isAdmin || c.instructor_user_id === params.userId || unlockedCourseIds.has(c.id);
    const subjectMatch =
      Boolean(subjectLower) &&
      (String(c.subject || '').toLowerCase().includes(subjectLower) ||
        String(c.category || '').toLowerCase().includes(subjectLower) ||
        subjectLower.includes(String(c.subject || '').toLowerCase()));

    const publicHay = `${c.title} ${c.subject} ${c.category} ${c.description} ${c.syllabus_json} ${c.learning_objectives_json}`;
    const fullHay = canReadLockedNotes ? `${publicHay} ${c.modules_notes_json}` : publicHay;

    let score = scoreMatch(fullHay, keywords, subjectMatch);
    if (params.courseId && c.id === params.courseId) {
      score += 20;
    }
    if (score < 3 && (!params.courseId || c.id !== params.courseId)) continue;

    let snippet = `Title: ${c.title} (${c.subject || c.category}, ${c.level})\nOverview: ${c.description}`;
    if (canReadLockedNotes) {
      try {
        const modules = JSON.parse(c.modules_notes_json || '[]') as Array<{ topic?: string; notes?: string } | string>;
        const notesText = modules
          .slice(0, 3)
          .map((m) => (typeof m === 'string' ? m : `${m.topic || ''}: ${m.notes || ''}`))
          .join(' | ');
        if (notesText) snippet += `\nVerified Module Notes: ${notesText.slice(0, 700)}`;
      } catch {
        // Ignore malformed JSON
      }
    } else {
      snippet += `\nPublic Syllabus: ${c.syllabus_json.slice(0, 350)}`;
    }

    candidates.push({
      score,
      citation: {
        sourceType: 'course',
        sourceId: c.id,
        title: c.title,
        section: canReadLockedNotes ? 'Approved Curriculum & Module Notes' : 'Public Syllabus Overview',
        author: c.author_name || 'IFIOK-EN Editorial Faculty',
        version: c.version || '1.0.0',
      },
      snippet,
    });
  }

  // 2. Approved / Published Teacher Contributions ONLY (never drafts, pending, rejected, or suspended)
  const submissionRows = db.prepare(`
    SELECT ts.id, ts.title, ts.subject, ts.level, ts.category, ts.description, ts.extracted_text,
           ts.current_version, u.full_name as author_name
    FROM teacher_submissions ts
    JOIN users u ON u.id = ts.author_user_id
    WHERE ts.status IN ('Approved', 'Published')
  `).all() as Array<{
    id: number;
    title: string;
    subject: string;
    level: string;
    category: string;
    description: string;
    extracted_text: string;
    current_version: string;
    author_name: string;
  }>;

  for (const ts of submissionRows) {
    const subjectMatch =
      Boolean(subjectLower) &&
      (ts.subject.toLowerCase().includes(subjectLower) || subjectLower.includes(ts.subject.toLowerCase()));
    const hay = `${ts.title} ${ts.subject} ${ts.category} ${ts.description} ${ts.extracted_text}`;
    const score = scoreMatch(hay, keywords, subjectMatch);
    if (score < 3) continue;

    const excerpt = ts.extracted_text ? ts.extracted_text.slice(0, 650) : ts.description;
    candidates.push({
      score,
      citation: {
        sourceType: 'teacher_submission',
        sourceId: ts.id,
        title: ts.title,
        section: `${ts.category} (${ts.subject})`,
        author: ts.author_name,
        version: ts.current_version || '1.0.0',
      },
      snippet: `Teacher Contribution: ${ts.title} by ${ts.author_name} (v${ts.current_version})\nSummary: ${ts.description}\nContent Excerpt: ${excerpt}`,
    });
  }

  // 3. Institutional school_lessons ONLY for schools where this user is an active member
  const activeMemberships = db.prepare(`
    SELECT DISTINCT school_id FROM school_memberships WHERE user_id = ? AND status = 'active'
  `).all(params.userId) as Array<{ school_id: number }>;
  const memberSchoolIds = activeMemberships
    .map((m) => m.school_id)
    .filter((sid) => !params.schoolId || sid === params.schoolId);

  if (memberSchoolIds.length > 0) {
    const placeholders = memberSchoolIds.map(() => '?').join(',');
    const lessonRows = db.prepare(`
      SELECT l.id, l.title, l.subject, l.content_markdown, s.name as school_name, u.full_name as teacher_name
      FROM school_lessons l
      JOIN schools s ON s.id = l.school_id
      JOIN users u ON u.id = l.teacher_user_id
      WHERE l.school_id IN (${placeholders})
      ORDER BY l.created_at DESC
      LIMIT 40
    `).all(...memberSchoolIds) as Array<{
      id: number;
      title: string;
      subject: string;
      content_markdown: string;
      school_name: string;
      teacher_name: string;
    }>;

    for (const les of lessonRows) {
      const subjectMatch = Boolean(subjectLower) && les.subject.toLowerCase().includes(subjectLower);
      const hay = `${les.title} ${les.subject} ${les.content_markdown}`;
      const score = scoreMatch(hay, keywords, subjectMatch) + (params.schoolId ? 2 : 0);
      if (score < 3) continue;

      candidates.push({
        score,
        citation: {
          sourceType: 'school_lesson',
          sourceId: les.id,
          title: les.title,
          section: `${les.school_name} · ${les.subject}`,
          author: les.teacher_name,
          version: '1.0',
        },
        snippet: `Enrolled School Lesson (${les.school_name}): ${les.title}\nTeacher: ${les.teacher_name}\nNotes: ${les.content_markdown.slice(0, 650)}`,
      });
    }
  }

  const top = candidates.sort((a, b) => b.score - a.score).slice(0, 4);
  if (top.length === 0) {
    return { citations: [], contextText: '', sourcedFromLibrary: false };
  }

  return {
    citations: top.map((t) => t.citation),
    contextText: top
      .map((t, idx) => `[SOURCE ${idx + 1}: ${t.citation.title} (${t.citation.sourceType} #${t.citation.sourceId})]\n${t.snippet}`)
      .join('\n\n'),
    sourcedFromLibrary: true,
  };
}
