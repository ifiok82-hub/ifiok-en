import net from 'node:net';

export const MARKET_SUITE_IDS = [
  'software_productivity',
  'digital_learning_publishing',
  'creative_design_assets',
  'business_resources',
  'digital_collectibles',
  'gaming_web3',
  'physical_commerce',
] as const;

export type MarketSuiteId = (typeof MARKET_SUITE_IDS)[number];

export interface CourseCompletenessCheckItem {
  id: number;
  key: string;
  label: string;
  present: boolean;
}

export interface CourseCompletenessResult {
  score: number;
  total: 15;
  complete: boolean;
  missing: string[];
  checklist: CourseCompletenessCheckItem[];
}

function parseJsonArraySafe(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasText(val: unknown, minLen = 3): boolean {
  return typeof val === 'string' && val.trim().length >= minLen;
}

export function evaluateCourseCompleteness(
  course: Record<string, unknown>,
  instructor?: Record<string, unknown> | null
): CourseCompletenessResult {
  const syllabus = parseJsonArraySafe(course.syllabus_json).filter((x) => String(x || '').trim().length >= 3);
  const objectives = parseJsonArraySafe(course.learning_objectives_json).filter((x) => String(x || '').trim().length >= 3);
  const modulesNotes = parseJsonArraySafe(course.modules_notes_json);
  const slidesResources = parseJsonArraySafe(course.slides_resources_json).filter((x) => String(x || '').trim().length >= 3);
  const assignments = parseJsonArraySafe(course.assignments_json).filter((x) => String(x || '').trim().length >= 3);
  const quizzes = parseJsonArraySafe(course.quizzes_json).filter((x) => String(x || '').trim().length >= 3);

  const validModuleTopics = modulesNotes.filter((m) => {
    if (typeof m === 'string') return m.trim().length >= 4;
    if (m && typeof m === 'object') {
      const rec = m as Record<string, unknown>;
      return hasText(rec.topic || rec.title, 3);
    }
    return false;
  });

  const validLessonNotes = modulesNotes.filter((m) => {
    if (typeof m === 'string') return m.trim().length >= 20;
    if (m && typeof m === 'object') {
      const rec = m as Record<string, unknown>;
      return hasText(rec.notes || rec.lessonNotes || rec.content, 15);
    }
    return false;
  });

  const hasTeachingMediaOrLessonContent =
    hasText(course.media_lesson_url, 8) ||
    hasText(course.locked_materials_enc, 12) ||
    validLessonNotes.length >= 2;

  const instructorQual =
    hasText(course.instructor_qualifications_snapshot, 5) ||
    hasText(instructor?.credentials, 5);

  const checklist: CourseCompletenessCheckItem[] = [
    {
      id: 1,
      key: 'title_description',
      label: 'Course title and detailed description',
      present: hasText(course.title, 5) && hasText(course.description, 20),
    },
    {
      id: 2,
      key: 'syllabus',
      label: 'Course outline / syllabus',
      present: syllabus.length >= 2,
    },
    {
      id: 3,
      key: 'learning_objectives',
      label: 'Learning objectives',
      present: objectives.length >= 2,
    },
    {
      id: 4,
      key: 'module_topics',
      label: 'Modules and lesson topics',
      present: validModuleTopics.length >= 2,
    },
    {
      id: 5,
      key: 'lesson_notes',
      label: 'Prepared lesson notes',
      present: validLessonNotes.length >= 1,
    },
    {
      id: 6,
      key: 'teaching_content',
      label: 'Teaching videos or complete lesson content',
      present: hasTeachingMediaOrLessonContent,
    },
    {
      id: 7,
      key: 'slides_resources',
      label: 'Slides and downloadable resources',
      present: slidesResources.length >= 1,
    },
    {
      id: 8,
      key: 'assignments',
      label: 'Assignments and exercises',
      present: assignments.length >= 1,
    },
    {
      id: 9,
      key: 'quizzes',
      label: 'Quizzes and assessments',
      present: quizzes.length >= 1,
    },
    {
      id: 10,
      key: 'exam_marking_guide',
      label: 'Examination questions and marking guide',
      present: hasText(course.exam_marking_guide, 15),
    },
    {
      id: 11,
      key: 'instructor_qualifications',
      label: 'Verified instructor information & qualifications',
      present: instructorQual,
    },
    {
      id: 12,
      key: 'duration_level',
      label: 'Course duration and difficulty level',
      present: Number(course.duration_hours) >= 1 && hasText(course.level, 3),
    },
    {
      id: 13,
      key: 'language_prerequisites',
      label: 'Language and prerequisites',
      present: hasText(course.language_code, 2) && hasText(course.prerequisites, 3),
    },
    {
      id: 14,
      key: 'copyright_permission',
      label: 'Copyright or distribution permission',
      present: hasText(course.copyright_permission, 5),
    },
    {
      id: 15,
      key: 'certificate_criteria',
      label: 'Completion & certificate criteria',
      present: hasText(course.certificate_criteria, 8),
    },
  ];

  const missing = checklist.filter((item) => !item.present).map((item) => item.label);
  const score = checklist.length - missing.length;
  return {
    score,
    total: 15,
    complete: missing.length === 0,
    missing,
    checklist,
  };
}

export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  } else if (ipVersion === 6) {
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

export function validateSupplierFeedUrl(rawUrl: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, error: 'Feed URL is required.' };
  }
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'Feed URL must use HTTPS or HTTP.' };
    }
    if (isPrivateOrReservedHost(parsed.hostname)) {
      return { ok: false, error: 'Private, loopback, or metadata hostnames are blocked for security.' };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'Invalid feed URL format.' };
  }
}
