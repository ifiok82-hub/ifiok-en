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

export const PRODUCT_LIFECYCLE_STATES = [
  'draft',
  'submitted',
  'awaiting_license_verification',
  'awaiting_file_verification',
  'approved',
  'published',
  'suspended',
  'out_of_stock',
  'archived',
] as const;

export type ProductLifecycleState = (typeof PRODUCT_LIFECYCLE_STATES)[number];

export interface CourseCompletenessCheckItem {
  id: number;
  key: string;
  label: string;
  present: boolean;
}

export interface CourseCompletenessResult {
  score: number;
  total: 22;
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
  const courseFiles = parseJsonArraySafe(course.course_files_json);
  const workbooks = parseJsonArraySafe(course.workbooks_exercises_json).filter((x) => String(x || '').trim().length >= 3);
  const assignments = parseJsonArraySafe(course.assignments_json).filter((x) => String(x || '').trim().length >= 3);
  const quizzes = parseJsonArraySafe(course.quizzes_json).filter((x) => String(x || '').trim().length >= 3);
  const examQuestions = parseJsonArraySafe(course.exam_questions_json).filter((x) => String(x || '').trim().length >= 3);

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
      key: 'course_title',
      label: 'Course title',
      present: hasText(course.title, 5),
    },
    {
      id: 2,
      key: 'course_description',
      label: 'Detailed course description (min 30 chars)',
      present: hasText(course.description, 30),
    },
    {
      id: 3,
      key: 'subject_classification',
      label: 'Academic subject / category classification',
      present: hasText(course.subject, 2) || hasText(course.category, 2),
    },
    {
      id: 4,
      key: 'syllabus',
      label: 'Course outline / syllabus (2+ modules)',
      present: syllabus.length >= 2,
    },
    {
      id: 5,
      key: 'learning_objectives',
      label: 'Clear learning objectives (2+ items)',
      present: objectives.length >= 2,
    },
    {
      id: 6,
      key: 'module_topics',
      label: 'Structured modules and lesson topics (2+ topics)',
      present: validModuleTopics.length >= 2,
    },
    {
      id: 7,
      key: 'lesson_notes',
      label: 'Prepared lesson notes',
      present: validLessonNotes.length >= 1,
    },
    {
      id: 8,
      key: 'teaching_media',
      label: 'Teaching videos or structured lesson media',
      present: hasTeachingMediaOrLessonContent,
    },
    {
      id: 9,
      key: 'downloadable_resources',
      label: 'Downloadable PDFs, documents, or presentations/slides',
      present: slidesResources.length >= 1 || courseFiles.length >= 1,
    },
    {
      id: 10,
      key: 'practical_workbooks',
      label: 'Practical exercises and student workbooks',
      present: workbooks.length >= 1,
    },
    {
      id: 11,
      key: 'assignments',
      label: 'Assignments',
      present: assignments.length >= 1,
    },
    {
      id: 12,
      key: 'quizzes',
      label: 'Quizzes and formative assessments',
      present: quizzes.length >= 1,
    },
    {
      id: 13,
      key: 'exam_questions',
      label: 'Examination questions',
      present: examQuestions.length >= 1,
    },
    {
      id: 14,
      key: 'answer_keys_marking_guide',
      label: 'Answer keys and marking guides',
      present: hasText(course.answer_keys_text, 10) && hasText(course.exam_marking_guide, 12),
    },
    {
      id: 15,
      key: 'instructor_qualifications',
      label: 'Verified instructor bio and qualifications',
      present: instructorQual,
    },
    {
      id: 16,
      key: 'duration_hours',
      label: 'Course duration (1+ hours)',
      present: Number(course.duration_hours) >= 1,
    },
    {
      id: 17,
      key: 'difficulty_level',
      label: 'Difficulty level specification',
      present: hasText(course.level, 3),
    },
    {
      id: 18,
      key: 'language_code',
      label: 'Instruction language specification',
      present: hasText(course.language_code, 2),
    },
    {
      id: 19,
      key: 'prerequisites',
      label: 'Course prerequisites',
      present: hasText(course.prerequisites, 3),
    },
    {
      id: 20,
      key: 'target_audience',
      label: 'Target audience / grade level',
      present: hasText(course.target_audience, 3),
    },
    {
      id: 21,
      key: 'copyright_permission',
      label: 'Copyright or distribution permission',
      present: hasText(course.copyright_permission, 5),
    },
    {
      id: 22,
      key: 'certificate_criteria',
      label: 'Completion requirements and certificate criteria',
      present: hasText(course.certificate_criteria, 8),
    },
  ];

  const missing = checklist.filter((item) => !item.present).map((item) => item.label);
  const score = checklist.length - missing.length;
  return {
    score,
    total: 22,
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
