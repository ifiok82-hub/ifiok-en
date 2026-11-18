import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Lock,
  MessageSquare,
  Plus,
  Printer,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import virtualClassroomImg from '../assets/images/global_virtual_classroom_1794728461194.jpg';
import { apiRequest } from '../lib/api.ts';
import { ACADEMIC_SUBJECTS, COUNTRIES } from '../lib/i18n.ts';
import type { LanguageCode, SchoolSummary, UserProfile } from '../types/platform.ts';
import { TeacherContributionsSection } from './TeacherContributionsSection.tsx';

interface SchoolWorkspaceData {
  school: {
    id: number;
    name: string;
    school_type: string;
    country: string;
    city: string;
    website: string;
    summary: string;
    verification_status: string;
    accreditation_note: string;
    child_safety_officer_email: string;
  };
  myRoles: string[];
  isSchoolAdmin: boolean;
  isStaff: boolean;
  isGuardian: boolean;
  metrics: {
    students: number;
    teachers: number;
    departments: number;
    classes: number;
    lessons: number;
    assignments: number;
    averageGradedScore: number | null;
  };
  departments: Array<{ id: number; name: string; description: string }>;
  classes: Array<{
    id: number;
    name: string;
    subject: string;
    grade_level: string;
    department_name: string | null;
    teacher_name: string | null;
    schedule_summary: string;
  }>;
  roster: Array<{
    id: number;
    user_id: number;
    member_role: string;
    full_name: string;
    email: string | null;
    age_group: string;
    class_name: string | null;
    ward_name: string | null;
  }>;
  lessons: Array<{
    id: number;
    class_id: number;
    class_name: string;
    teacher_name: string;
    subject: string;
    title: string;
    content_markdown: string;
    material_url: string;
    scheduled_at: string;
    language_code: string;
  }>;
  assignments: Array<{
    id: number;
    class_id: number;
    class_name: string;
    teacher_name: string;
    title: string;
    subject: string;
    instructions: string;
    due_date: string;
    max_score: number;
    is_exam: number;
    time_limit_minutes: number;
    questions_json: string;
  }>;
  submissions: Array<{
    id: number;
    assignment_id: number;
    student_user_id: number;
    student_name: string;
    assignment_title: string;
    submission_text: string;
    score: number | null;
    max_score: number;
    feedback: string;
    status: string;
    submitted_at: string;
  }>;
  attendance: Array<{
    id: number;
    class_name: string;
    student_name: string;
    attendance_date: string;
    status: string;
    notes: string;
  }>;
  communications: Array<{
    id: number;
    sender_name: string;
    target_role: string;
    title: string;
    message: string;
    created_at: string;
  }>;
  sessions?: Array<{
    id: number;
    name: string;
    term_label: string;
    start_date: string;
    end_date: string;
    is_active: number;
  }>;
}

export type SchoolPortalMode = 'admin' | 'teacher' | 'student' | 'guardian';

interface GuardianWardSummary {
  school_id: number;
  school_name: string;
  student_user_id: number;
  student_name: string;
  present_count: number;
  attendance_total: number;
  avg_score: number | null;
}

interface SchoolManagementPortalProps {
  user: UserProfile | null;
  language: LanguageCode;
  portalMode?: SchoolPortalMode;
  onRequireAuth: () => void;
  onLaunchProfessor?: (opts: { subject: string; mode?: string }) => void;
  onOpenCreateCourse?: () => void;
}

type WorkspaceTab = 'overview' | 'lessons' | 'assignments' | 'attendance' | 'admin';

const PORTAL_META: Record<
  SchoolPortalMode,
  { badge: string; title: string; subtitle: string; guestTitle: string }
> = {
  admin: {
    badge: 'IFIOK SCHOOL — Global Digital Learning',
    title: 'IFIOK School Administration Portal',
    subtitle:
      'Register primary, secondary, college, or training institutions, upload verification documents, organize departments and classes, and assign teachers, students, and guardians inside isolated school workspaces.',
    guestTitle: 'Register & govern your school inside IFIOK SCHOOL',
  },
  teacher: {
    badge: 'IFIOK SCHOOL — Educator Workspace',
    title: 'IFIOK Teacher Portal',
    subtitle:
      'Schedule lessons, publish public IFIOK SCHOOL courses, set homework and timed MCQ/written examinations, grade submissions, mark attendance, and prepare curricula with IFIOK Professor.',
    guestTitle: 'Teach, examine, and mentor students globally with IFIOK SCHOOL',
  },
  student: {
    badge: 'IFIOK SCHOOL — Learner Workspace',
    title: 'IFIOK Student Portal',
    subtitle:
      'Access institutional lessons, submit homework, sit timed examinations, monitor grades and attendance, and coordinate with your teachers and IFIOK Professor.',
    guestTitle: 'Join your school classes, complete exams, and track academic progress',
  },
  guardian: {
    badge: 'IFIOK SCHOOL — Family & Child Safety Oversight',
    title: 'IFIOK Parent/Guardian Portal',
    subtitle:
      'Monitor your linked student wards’ attendance, school notices, and examination scores, backed by strict under-13 child protection and parental consent safeguards.',
    guestTitle: 'Supervise your student’s attendance, grades, and safety on IFIOK SCHOOL',
  },
};

export function SchoolManagementPortal({
  user,
  language,
  portalMode = 'admin',
  onRequireAuth,
  onLaunchProfessor,
  onOpenCreateCourse,
}: SchoolManagementPortalProps) {
  const meta = PORTAL_META[portalMode];
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number>(0);
  const [workspace, setWorkspace] = useState<SchoolWorkspaceData | null>(null);
  const [guardianWards, setGuardianWards] = useState<GuardianWardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [wsTab, setWsTab] = useState<WorkspaceTab>(
    portalMode === 'admin'
      ? 'admin'
      : portalMode === 'teacher'
        ? 'lessons'
        : portalMode === 'student'
          ? 'assignments'
          : 'overview'
  );
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // School application state
  const [appName, setAppName] = useState('');
  const [appType, setAppType] = useState('Secondary School');
  const [appCountry, setAppCountry] = useState('Global');
  const [appCity, setAppCity] = useState('');
  const [appWebsite, setAppWebsite] = useState('');
  const [appSafetyEmail, setAppSafetyEmail] = useState('');
  const [appSummary, setAppSummary] = useState('');
  const [appDocUrl, setAppDocUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Department & Class creation
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [clsName, setClsName] = useState('');
  const [clsSubject, setClsSubject] = useState<string>(ACADEMIC_SUBJECTS[0]);
  const [clsGrade, setClsGrade] = useState('Grade 10');
  const [clsDeptId, setClsDeptId] = useState<number>(0);
  const [clsSchedule, setClsSchedule] = useState('');

  // Member enrollment
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'teacher' | 'student' | 'guardian' | 'school_admin'>('student');
  const [memberClassId, setMemberClassId] = useState<number>(0);
  const [wardEmail, setWardEmail] = useState('');

  // Lesson creation
  const [lessonClassId, setLessonClassId] = useState<number>(0);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSubject, setLessonSubject] = useState<string>(ACADEMIC_SUBJECTS[0]);
  const [lessonSchedule, setLessonSchedule] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonMaterialUrl, setLessonMaterialUrl] = useState('');

  // Assignment / Exam creation
  const [asgClassId, setAsgClassId] = useState<number>(0);
  const [asgTitle, setAsgTitle] = useState('');
  const [asgSubject, setAsgSubject] = useState<string>(ACADEMIC_SUBJECTS[0]);
  const [asgInstructions, setAsgInstructions] = useState('');
  const [asgDueDate, setAsgDueDate] = useState('2026-12-31');
  const [asgMaxScore, setAsgMaxScore] = useState('100');
  const [asgIsExam, setAsgIsExam] = useState(false);
  const [asgTimeLimit, setAsgTimeLimit] = useState('45');
  const [mcqItems, setMcqItems] = useState<Array<{ question: string; optionsText: string; correctIndex: number }>>([]);

  // Student submission state
  const [activeSubmissionId, setActiveSubmissionId] = useState<number>(0);
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});

  // Grading state
  const [gradeInputs, setGradeInputs] = useState<Record<number, { score: string; feedback: string }>>({});

  // Attendance state
  const [attClassId, setAttClassId] = useState<number>(0);
  const [attStudentId, setAttStudentId] = useState<number>(0);
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');

  // Communication notice form
  const [commTarget, setCommTarget] = useState<'all' | 'teachers' | 'students' | 'guardians'>('all');
  const [commTitle, setCommTitle] = useState('');
  const [commMsg, setCommMsg] = useState('');

  // Academic Session / Term form
  const [sessName, setSessName] = useState('2026/2027');
  const [sessTerm, setSessTerm] = useState('Term 1');
  const [sessStart, setSessStart] = useState('2026-09-01');
  const [sessEnd, setSessEnd] = useState('2026-12-18');
  const [sessActive, setSessActive] = useState(true);

  // Printable Report Card Modal
  const [reportCard, setReportCard] = useState<{
    school: { name: string; country: string; city: string; accreditation_note: string };
    student: { full_name: string; email: string | null; age_group: string };
    summary: {
      overallAverage: number | null;
      gradedAssessments: number;
      attendancePresent: number;
      attendanceTotal: number;
    };
    subjects: Array<{
      subject: string;
      gradedCount: number;
      averagePct: number | null;
      assignments: Array<{ title: string; score: number | null; maxScore: number; feedback: string }>;
    }>;
  } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadMySchools = useCallback(async () => {
    if (!user) {
      setSchools([]);
      setWorkspace(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ schools: SchoolSummary[] }>('/api/academy/schools/my');
      setSchools(res.schools);
      if (res.schools.length > 0 && !res.schools.some((s) => s.id === selectedSchoolId)) {
        setSelectedSchoolId(res.schools[0].id);
      }
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load institutions.' });
    } finally {
      setLoading(false);
    }
  }, [user, selectedSchoolId]);

  const loadWorkspace = useCallback(async (schoolId: number) => {
    if (!schoolId || !user) return;
    setLoading(true);
    try {
      const res = await apiRequest<SchoolWorkspaceData>(`/api/academy/schools/${schoolId}/workspace`);
      setWorkspace(res);
      if (res.classes.length > 0) {
        const firstId = res.classes[0].id;
        setLessonClassId((prev) => prev || firstId);
        setAsgClassId((prev) => prev || firstId);
        setAttClassId((prev) => prev || firstId);
        setMemberClassId((prev) => prev || firstId);
      }
      const firstStudent = res.roster.find((r) => r.member_role === 'student');
      if (firstStudent) {
        setAttStudentId((prev) => prev || firstStudent.user_id);
      }
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load school workspace.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (portalMode === 'admin') setWsTab('admin');
    else if (portalMode === 'teacher') setWsTab('lessons');
    else if (portalMode === 'student') setWsTab('assignments');
    else if (portalMode === 'guardian') setWsTab('overview');
  }, [portalMode]);

  useEffect(() => {
    loadMySchools();
  }, [loadMySchools]);

  useEffect(() => {
    if (!user || portalMode !== 'guardian') {
      setGuardianWards([]);
      return;
    }
    apiRequest<{ guardianWards?: GuardianWardSummary[] }>('/api/dashboard/overview')
      .then((res) => setGuardianWards(res.guardianWards || []))
      .catch(() => setGuardianWards([]));
  }, [user, portalMode]);

  useEffect(() => {
    if (selectedSchoolId > 0) {
      loadWorkspace(selectedSchoolId);
    }
  }, [selectedSchoolId, loadWorkspace]);

  const handleUploadFile = async (file: File, onUrl: (url: string) => void) => {
    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ url: string }>('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ dataBase64: base64 }),
      });
      onUrl(res.url);
      setNotice({ type: 'ok', text: 'Document image scanned and uploaded.' });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Upload rejected.' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleUploadPrivateLessonDoc = async (file: File) => {
    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read document.'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ storageKey: string; originalName: string; fileFormat: string }>(
        '/api/uploads/course-material',
        {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base64 }),
        }
      );
      setLessonMaterialUrl(`/api/uploads/school-material/${encodeURIComponent(res.storageKey)}`);
      setNotice({ type: 'ok', text: `Private lesson material scanned and stored: ${res.originalName} (${res.fileFormat}).` });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Document upload rejected.' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleOpenReportCard = async (schoolId: number, studentUserId: number) => {
    setLoadingReport(true);
    try {
      const res = await apiRequest<{
        school: { name: string; country: string; city: string; accreditation_note: string };
        student: { full_name: string; email: string | null; age_group: string };
        summary: {
          overallAverage: number | null;
          gradedAssessments: number;
          attendancePresent: number;
          attendanceTotal: number;
        };
        subjects: Array<{
          subject: string;
          gradedCount: number;
          averagePct: number | null;
          assignments: Array<{ title: string; score: number | null; maxScore: number; feedback: string }>;
        }>;
      }>(`/api/academy/schools/${schoolId}/report-card/${studentUserId}`);
      setReportCard(res);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Unable to load report card.' });
    } finally {
      setLoadingReport(false);
    }
  };

  const handleApplySchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ id: number; verificationStatus: string }>('/api/academy/schools/apply', {
        method: 'POST',
        body: JSON.stringify({
          name: appName,
          schoolType: appType,
          country: appCountry,
          city: appCity,
          website: appWebsite,
          childSafetyOfficerEmail: appSafetyEmail,
          summary: appSummary,
          verificationDocUrl: appDocUrl,
        }),
      });
      setShowApplyModal(false);
      setAppName('');
      setAppSummary('');
      setNotice({
        type: 'ok',
        text: `Institution registered (${res.verificationStatus}). Your isolated school workspace is ready.`,
      });
      await loadMySchools();
      setSelectedSchoolId(res.id);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'School registration failed.' });
    }
  };

  const mutateSchool = async (path: string, body: unknown, msg: string) => {
    try {
      await apiRequest(`/api/academy/schools/${selectedSchoolId}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setNotice({ type: 'ok', text: msg });
      await loadWorkspace(selectedSchoolId);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Operation failed.' });
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 h-56 lg:h-auto bg-slate-900">
          <img
            src={virtualClassroomImg}
            alt="Global School Management Portal"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-7 p-8 flex flex-col justify-center space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-amber-400">
            <Building2 className="w-4 h-4" />
            <span>{meta.title}</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">
            {meta.guestTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {meta.subtitle}
          </p>
          <div>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
            >
              Sign In or Register IFIOK SCHOOL Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 h-44 lg:h-auto bg-slate-900">
          <img
            src={virtualClassroomImg}
            alt={meta.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-amber-400">
                <Lock className="w-3.5 h-3.5" />
                <span>{meta.badge} · Isolated Multi-Tenant Portal</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {portalMode === 'teacher' && onOpenCreateCourse && (
                  <button
                    type="button"
                    onClick={onOpenCreateCourse}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publish Public Course</span>
                  </button>
                )}
                {(portalMode === 'admin' || portalMode === 'teacher') && (
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New School</span>
                  </button>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">
              {meta.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {meta.subtitle}
            </p>
          </div>

          {schools.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Active Institution:</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-1.5 text-sm font-semibold text-slate-900 dark:text-white"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.country} · {s.verification_status} · Role: {s.my_roles})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {portalMode === 'guardian' && guardianWards.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display font-bold text-base text-slate-950 dark:text-white">
              Parent / Guardian Oversight: Linked Student Wards
            </h3>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
              {guardianWards.length} Linked Ward{guardianWards.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {guardianWards.map((w) => (
              <div
                key={`${w.school_id}-${w.student_user_id}`}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">{w.student_name}</div>
                  <div className="text-slate-500">{w.school_name}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-mono text-slate-700 dark:text-amber-400 tabular-nums">
                    Attendance: {w.present_count}/{w.attendance_total} · Avg Grade:{' '}
                    {w.avg_score !== null ? `${w.avg_score}%` : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenReportCard(w.school_id, w.student_user_id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Report Card</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4 border ${
            notice.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && !workspace ? (
        <div className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] animate-pulse" />
      ) : schools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] p-10 text-center space-y-3">
          <GraduationCap className="w-8 h-8 text-purple-700 dark:text-amber-400 mx-auto" />
          <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
            You are not enrolled in an institution yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            School administrators can apply to register their institution and submit verification documents, or ask your school administrator to add your registered IFIOK-EN email to their roster.
          </p>
          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
          >
            Apply to Register School
          </button>
        </div>
      ) : workspace ? (
        <div className="space-y-6">
          {/* School Summary + Metrics */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {workspace.school.school_type} · {workspace.school.city ? `${workspace.school.city}, ` : ''}
                  {workspace.school.country} · Verification: <span className="font-mono uppercase">{workspace.school.verification_status}</span>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-950 dark:text-white mt-0.5">
                  {workspace.school.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{workspace.school.accreditation_note}</p>
              </div>
              <div className="text-xs font-mono text-purple-700 dark:text-amber-400">
                Your Roles: {workspace.myRoles.join(', ')}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              {[
                { label: 'Students', val: workspace.metrics.students },
                { label: 'Teachers', val: workspace.metrics.teachers },
                { label: 'Departments', val: workspace.metrics.departments },
                { label: 'Classes', val: workspace.metrics.classes },
                { label: 'Lessons', val: workspace.metrics.lessons },
                { label: 'Exams / Tasks', val: workspace.metrics.assignments },
                {
                  label: 'Avg Score',
                  val: workspace.metrics.averageGradedScore !== null ? `${workspace.metrics.averageGradedScore}%` : '—',
                },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3">
                  <div className="font-mono font-bold text-lg tabular-nums text-slate-950 dark:text-white">{m.val}</div>
                  <div className="text-[11px] text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-200/70 dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 overflow-x-auto">
            {(
              [
                ['overview', 'Overview & Notices', MessageSquare],
                ['lessons', 'Lessons & Schedule', BookOpen],
                ['assignments', 'Homework, Exams & Grades', ClipboardCheck],
                ['attendance', 'Attendance', Calendar],
                ...(workspace.isStaff ? [['admin', 'Departments, Classes & Roster', Users] as const] : []),
              ] as Array<[WorkspaceTab, string, typeof BookOpen]>
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWsTab(id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  wsTab === id
                    ? 'bg-white dark:bg-[#19284E] text-slate-950 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* TAB: OVERVIEW & NOTICES */}
          {wsTab === 'overview' && (
            <div className="space-y-6">
              {(workspace.myRoles.includes('student') || (workspace.sessions && workspace.sessions.length > 0)) && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-950 dark:text-white">
                      Academic Sessions & Student Transcript
                    </div>
                    {workspace.sessions && workspace.sessions.length > 0 ? (
                      <div className="flex flex-wrap gap-3 text-slate-600 dark:text-slate-300">
                        {workspace.sessions.map((s) => (
                          <span key={s.id} className="font-mono">
                            {s.name} · {s.term_label} ({s.start_date} – {s.end_date})
                            {s.is_active ? ' [ACTIVE]' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">No academic sessions configured yet.</span>
                    )}
                  </div>
                  {workspace.myRoles.includes('student') && (
                    <button
                      type="button"
                      disabled={loadingReport}
                      onClick={() => handleOpenReportCard(selectedSchoolId, user.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{loadingReport ? 'Loading...' : 'View / Print My Report Card'}</span>
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="font-display font-bold text-base text-slate-950 dark:text-white">
                    School Announcements & Communications
                  </h4>
                {workspace.communications.length === 0 ? (
                  <p className="text-xs text-slate-500">No announcements published yet.</p>
                ) : (
                  <div className="space-y-3">
                    {workspace.communications.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <span>From {c.sender_name} · Audience: {c.target_role}</span>
                          <span>{c.created_at.slice(0, 10)}</span>
                        </div>
                        <div className="font-semibold text-sm text-slate-950 dark:text-white">{c.title}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{c.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {workspace.isStaff && (
                <div className="lg:col-span-5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool(
                        '/communications',
                        { targetRole: commTarget, title: commTitle, message: commMsg },
                        'School notice published.'
                      );
                      setCommTitle('');
                      setCommMsg('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                      Send Notice to School Community
                    </h4>
                    <div>
                      <label className="block text-xs font-medium mb-1">Audience</label>
                      <select
                        value={commTarget}
                        onChange={(e) => setCommTarget(e.target.value as typeof commTarget)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        <option value="all">All Teachers, Students & Guardians</option>
                        <option value="teachers">Teachers Only</option>
                        <option value="students">Students Only</option>
                        <option value="guardians">Parents & Guardians</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Title</label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        value={commTitle}
                        onChange={(e) => setCommTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Message</label>
                      <textarea
                        rows={4}
                        required
                        minLength={8}
                        value={commMsg}
                        onChange={(e) => setCommMsg(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Publish Notice
                    </button>
                  </form>
                </div>
              )}
              </div>
            </div>
          )}

          {/* TAB: LESSONS & TEACHER PREP */}
          {wsTab === 'lessons' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={workspace.isStaff ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-base text-slate-950 dark:text-white">
                    Scheduled & Published Lessons
                  </h4>
                  {workspace.isStaff && onLaunchProfessor && (
                    <button
                      type="button"
                      onClick={() => onLaunchProfessor({ subject: lessonSubject, mode: 'teacher_prep' })}
                      className="text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Open IFIOK Professor Teacher Prep
                    </button>
                  )}
                </div>
                {workspace.lessons.length === 0 ? (
                  <p className="text-xs text-slate-500">No lessons published yet.</p>
                ) : (
                  <div className="space-y-3">
                    {workspace.lessons.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            {l.class_name} · {l.subject} · {l.teacher_name}
                          </span>
                          {l.scheduled_at && <span className="font-mono">{l.scheduled_at}</span>}
                        </div>
                        <h5 className="font-display font-bold text-slate-950 dark:text-white">{l.title}</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {l.content_markdown}
                        </p>
                        {l.material_url && (
                          <a
                            href={l.material_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs font-semibold text-purple-700 dark:text-amber-400 hover:underline"
                          >
                            View Attached Lesson Material
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Class Timetable & Lesson Schedule Grid */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3">
                  <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                    Class Timetable & Teaching Schedule
                  </h4>
                  {workspace.classes.length === 0 ? (
                    <p className="text-xs text-slate-500">No classes scheduled yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <tr>
                            <th className="py-2 pr-4">Class</th>
                            <th className="py-2 pr-4">Subject</th>
                            <th className="py-2 pr-4">Grade</th>
                            <th className="py-2 pr-4">Instructor</th>
                            <th className="py-2">Schedule</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {workspace.classes.map((cls) => (
                            <tr key={cls.id}>
                              <td className="py-2 pr-4 font-semibold">{cls.name}</td>
                              <td className="py-2 pr-4">{cls.subject}</td>
                              <td className="py-2 pr-4">{cls.grade_level}</td>
                              <td className="py-2 pr-4">{cls.teacher_name || 'Assigned Staff'}</td>
                              <td className="py-2 font-mono">{cls.schedule_summary || 'Flexible / Self-Paced'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {workspace.isStaff && (
                <div className="lg:col-span-5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool(
                        '/lessons',
                        {
                          classId: lessonClassId,
                          subject: lessonSubject,
                          title: lessonTitle,
                          scheduledAt: lessonSchedule,
                          contentMarkdown: lessonContent,
                          materialUrl: lessonMaterialUrl,
                          languageCode: language,
                        },
                        'Lesson published and scheduled.'
                      );
                      setLessonTitle('');
                      setLessonContent('');
                      setLessonMaterialUrl('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                      Teacher: Create & Schedule Lesson
                    </h4>
                    {workspace.classes.length === 0 ? (
                      <p className="text-xs text-amber-600">Create a class first in the Admin/Roster tab.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium mb-1">Class</label>
                            <select
                              value={lessonClassId}
                              onChange={(e) => setLessonClassId(Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs"
                            >
                              {workspace.classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Subject</label>
                            <select
                              value={lessonSubject}
                              onChange={(e) => setLessonSubject(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs"
                            >
                              {ACADEMIC_SUBJECTS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Lesson Title</label>
                          <input
                            type="text"
                            required
                            minLength={3}
                            value={lessonTitle}
                            onChange={(e) => setLessonTitle(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Schedule Date/Time</label>
                          <input
                            type="text"
                            value={lessonSchedule}
                            onChange={(e) => setLessonSchedule(e.target.value)}
                            placeholder="Mon/Wed 10:00 UTC"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Structured Lesson Notes</label>
                          <textarea
                            rows={4}
                            required
                            minLength={15}
                            value={lessonContent}
                            onChange={(e) => setLessonContent(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium">Upload Lesson Material (PDF / DOCX / PPTX / Visual, Scanned)</label>
                          <input
                            type="file"
                            accept=".pdf,.docx,.pptx,.txt,.md,image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              if (f.type.startsWith('image/')) {
                                handleUploadFile(f, setLessonMaterialUrl);
                              } else {
                                handleUploadPrivateLessonDoc(f);
                              }
                            }}
                            className="text-xs"
                          />
                          {lessonMaterialUrl && (
                            <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                              Attached: {lessonMaterialUrl}
                            </div>
                          )}
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                        >
                          Publish Lesson
                        </button>
                      </>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB: ASSIGNMENTS, EXAMS & GRADING */}
          {wsTab === 'assignments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className={workspace.isStaff ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
                  <h4 className="font-display font-bold text-base text-slate-950 dark:text-white">
                    Homework & Timed Examinations
                  </h4>
                  {workspace.assignments.length === 0 ? (
                    <p className="text-xs text-slate-500">No assignments or examinations set yet.</p>
                  ) : (
                    workspace.assignments.map((a) => {
                      const questions = JSON.parse(a.questions_json || '[]') as Array<{
                        question: string;
                        options?: string[];
                        correctIndex?: number;
                      }>;
                      const mySub = workspace.submissions.find(
                        (s) => s.assignment_id === a.id && s.student_user_id === user.id
                      );
                      const openTake = activeSubmissionId === a.id;

                      return (
                        <div
                          key={a.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>
                              {a.is_exam ? 'Examination' : 'Homework'} · {a.class_name} · {a.subject} · Max {a.max_score} pts
                              {a.time_limit_minutes > 0 ? ` · ${a.time_limit_minutes} min` : ''}
                            </span>
                            <span className="font-mono">Due {a.due_date}</span>
                          </div>
                          <div className="font-display font-bold text-slate-950 dark:text-white">{a.title}</div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{a.instructions}</p>

                          {mySub && (
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                              Submitted ({mySub.status})
                              {mySub.score !== null ? ` — Score: ${mySub.score}/${a.max_score}` : ''}
                              {mySub.feedback ? ` · ${mySub.feedback}` : ''}
                            </div>
                          )}

                          {workspace.myRoles.includes('student') && (
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSubmissionId(openTake ? 0 : a.id);
                                  setWrittenAnswer('');
                                  setMcqAnswers({});
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                              >
                                {openTake ? 'Close Submission Form' : mySub ? 'Resubmit Work' : a.is_exam ? 'Take Exam' : 'Submit Homework'}
                              </button>
                            </div>
                          )}

                          {openTake && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const answersArr = questions.map((_, idx) => mcqAnswers[idx] ?? -1);
                                mutateSchool(
                                  `/assignments/${a.id}/submit`,
                                  { submissionText: writtenAnswer, answers: answersArr },
                                  'Work submitted successfully.'
                                );
                                setActiveSubmissionId(0);
                              }}
                              className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
                            >
                              {questions.map((q, qIdx) => (
                                <div key={qIdx} className="space-y-1.5">
                                  <div className="text-xs font-semibold">
                                    {qIdx + 1}. {q.question}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(q.options || []).map((opt, oIdx) => (
                                      <label key={oIdx} className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`q-${a.id}-${qIdx}`}
                                          checked={mcqAnswers[qIdx] === oIdx}
                                          onChange={() => setMcqAnswers((p) => ({ ...p, [qIdx]: oIdx }))}
                                        />
                                        <span>{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {questions.length === 0 && (
                                <textarea
                                  rows={4}
                                  required
                                  minLength={5}
                                  value={writtenAnswer}
                                  onChange={(e) => setWrittenAnswer(e.target.value)}
                                  placeholder="Write your complete assignment response..."
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                                />
                              )}
                              <button
                                type="submit"
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                Submit Final Response
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {workspace.isStaff && (
                  <div className="lg:col-span-5">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsedQuestions = mcqItems
                          .filter((m) => m.question.trim() && m.optionsText.trim())
                          .map((m) => ({
                            question: m.question.trim(),
                            options: m.optionsText
                              .split('|')
                              .map((s) => s.trim())
                              .filter(Boolean),
                            correctIndex: Number(m.correctIndex) || 0,
                          }));
                        mutateSchool(
                          '/assignments',
                          {
                            classId: asgClassId,
                            title: asgTitle,
                            subject: asgSubject,
                            instructions: asgInstructions,
                            dueDate: asgDueDate,
                            maxScore: Number(asgMaxScore) || 100,
                            isExam: asgIsExam,
                            timeLimitMinutes: asgIsExam ? Number(asgTimeLimit) || 45 : 0,
                            questions: parsedQuestions,
                          },
                          'Assessment created.'
                        );
                        setAsgTitle('');
                        setAsgInstructions('');
                        setMcqItems([]);
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                    >
                      <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                        Teacher: Set Homework or Exam
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Class</label>
                          <select
                            value={asgClassId}
                            onChange={(e) => setAsgClassId(Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs"
                          >
                            {workspace.classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Due Date</label>
                          <input
                            type="date"
                            required
                            value={asgDueDate}
                            onChange={(e) => setAsgDueDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Title</label>
                        <input
                          type="text"
                          required
                          value={asgTitle}
                          onChange={(e) => setAsgTitle(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Subject</label>
                          <select
                            value={asgSubject}
                            onChange={(e) => setAsgSubject(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs"
                          >
                            {ACADEMIC_SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Max Score</label>
                          <input
                            type="number"
                            min={10}
                            max={1000}
                            value={asgMaxScore}
                            onChange={(e) => setAsgMaxScore(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={asgIsExam}
                            onChange={(e) => setAsgIsExam(e.target.checked)}
                          />
                          <span>Formal Examination</span>
                        </label>
                        {asgIsExam && (
                          <input
                            type="number"
                            value={asgTimeLimit}
                            onChange={(e) => setAsgTimeLimit(e.target.value)}
                            className="w-24 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-mono"
                            placeholder="Mins"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Instructions</label>
                        <textarea
                          rows={3}
                          required
                          minLength={10}
                          value={asgInstructions}
                          onChange={(e) => setAsgInstructions(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                        />
                      </div>

                      <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Objective MCQ Questions (Optional auto-grade)</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMcqItems((p) => [
                                ...p,
                                { question: '', optionsText: 'Option A | Option B | Option C | Option D', correctIndex: 0 },
                              ])
                            }
                            className="text-xs font-semibold text-purple-700 dark:text-amber-400 cursor-pointer"
                          >
                            + Add MCQ
                          </button>
                        </div>
                        {mcqItems.map((m, idx) => (
                          <div key={idx} className="rounded-lg bg-slate-50 dark:bg-[#081024] p-2.5 space-y-1.5 text-xs">
                            <input
                              type="text"
                              value={m.question}
                              onChange={(e) =>
                                setMcqItems((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x))
                                )
                              }
                              placeholder="Question text..."
                              className="w-full rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                            />
                            <input
                              type="text"
                              value={m.optionsText}
                              onChange={(e) =>
                                setMcqItems((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, optionsText: e.target.value } : x))
                                )
                              }
                              placeholder="Separate options with |"
                              className="w-full rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                            />
                            <label className="inline-flex items-center gap-1.5">
                              <span>Correct index (0-based):</span>
                              <input
                                type="number"
                                min={0}
                                max={5}
                                value={m.correctIndex}
                                onChange={(e) =>
                                  setMcqItems((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, correctIndex: Number(e.target.value) } : x
                                    )
                                  )
                                }
                                className="w-14 rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 font-mono"
                              />
                            </label>
                          </div>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        Publish Assessment
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Submissions & Grading Queue */}
              {workspace.submissions.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3">
                  <h4 className="font-display font-bold text-base text-slate-950 dark:text-white">
                    {workspace.isStaff ? 'Student Submissions & Grading' : 'My & Ward Examination Results'}
                  </h4>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {workspace.submissions.map((sub) => (
                      <div key={sub.id} className="py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="space-y-1 max-w-xl">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {sub.student_name} — {sub.assignment_title}
                          </div>
                          {sub.submission_text && (
                            <p className="text-slate-600 dark:text-slate-300">{sub.submission_text}</p>
                          )}
                          <div className="font-mono text-slate-500">
                            Status: {sub.status.toUpperCase()}
                            {sub.score !== null ? ` · Score: ${sub.score}/${sub.max_score}` : ''}
                            {sub.feedback ? ` · Feedback: ${sub.feedback}` : ''}
                          </div>
                        </div>

                        {workspace.isStaff && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={sub.max_score}
                              placeholder="Score"
                              value={gradeInputs[sub.id]?.score ?? ''}
                              onChange={(e) =>
                                setGradeInputs((p) => ({
                                  ...p,
                                  [sub.id]: { score: e.target.value, feedback: p[sub.id]?.feedback ?? '' },
                                }))
                              }
                              className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-1 font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Feedback..."
                              value={gradeInputs[sub.id]?.feedback ?? ''}
                              onChange={(e) =>
                                setGradeInputs((p) => ({
                                  ...p,
                                  [sub.id]: { score: p[sub.id]?.score ?? '', feedback: e.target.value },
                                }))
                              }
                              className="w-40 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                mutateSchool(
                                  `/submissions/${sub.id}/grade`,
                                  {
                                    score: Number(gradeInputs[sub.id]?.score ?? 0),
                                    feedback: gradeInputs[sub.id]?.feedback ?? 'Graded by instructor.',
                                  },
                                  'Submission graded and student notified.'
                                )
                              }
                              className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                            >
                              Save Grade
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ATTENDANCE */}
          {wsTab === 'attendance' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={workspace.isStaff ? 'lg:col-span-7' : 'lg:col-span-12'}>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {workspace.attendance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500">
                            No attendance records logged yet.
                          </td>
                        </tr>
                      ) : (
                        workspace.attendance.map((att) => (
                          <tr key={att.id}>
                            <td className="py-3 px-4 font-mono">{att.attendance_date}</td>
                            <td className="py-3 px-4 font-semibold">{att.student_name}</td>
                            <td className="py-3 px-4">{att.class_name}</td>
                            <td className="py-3 px-4 font-mono uppercase">{att.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {workspace.isStaff && (
                <div className="lg:col-span-5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool(
                        '/attendance',
                        {
                          classId: attClassId,
                          studentUserId: attStudentId,
                          attendanceDate: attDate,
                          status: attStatus,
                        },
                        'Attendance recorded.'
                      );
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                      Mark Student Attendance
                    </h4>
                    <div>
                      <label className="block text-xs font-medium mb-1">Class</label>
                      <select
                        value={attClassId}
                        onChange={(e) => setAttClassId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        {workspace.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Enrolled Student</label>
                      <select
                        value={attStudentId}
                        onChange={(e) => setAttStudentId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      >
                        {workspace.roster
                          .filter((r) => r.member_role === 'student')
                          .map((s) => (
                            <option key={s.id} value={s.user_id}>
                              {s.full_name} ({s.email || 'Account #' + s.user_id})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Date</label>
                        <input
                          type="date"
                          required
                          value={attDate}
                          onChange={(e) => setAttDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Status</label>
                        <select
                          value={attStatus}
                          onChange={(e) => setAttStatus(e.target.value as typeof attStatus)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2 text-xs"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                          <option value="excused">Excused</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Save Attendance
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB: SCHOOL ADMIN (DEPARTMENTS, CLASSES, ROSTER) */}
          {wsTab === 'admin' && !workspace.isStaff && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="font-display font-bold text-sm text-slate-950 dark:text-white">
                School Administration Controls Restricted to Institution Staff
              </div>
              <p>
                Your role in {workspace.school.name} is <span className="font-mono">{workspace.myRoles.join(', ')}</span>.
                Use the Overview, Lessons, Homework & Exams, or Attendance tabs above, or register a new institution if you are a school administrator.
              </p>
            </div>
          )}
          {wsTab === 'admin' && workspace.isStaff && (
            <div className="space-y-6">
              {workspace.isSchoolAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool('/departments', { name: deptName, description: deptDesc }, 'Department created.');
                      setDeptName('');
                      setDeptDesc('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm">1. Create Academic Department</h4>
                    <input
                      type="text"
                      required
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="e.g. Science & Engineering"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={deptDesc}
                      onChange={(e) => setDeptDesc(e.target.value)}
                      placeholder="Department overview..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Add Department
                    </button>
                  </form>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool(
                        '/classes',
                        {
                          name: clsName,
                          subject: clsSubject,
                          gradeLevel: clsGrade,
                          departmentId: clsDeptId || undefined,
                          scheduleSummary: clsSchedule,
                        },
                        'Class created.'
                      );
                      setClsName('');
                      setClsSchedule('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm">2. Create Class / Learning Group</h4>
                    <input
                      type="text"
                      required
                      value={clsName}
                      onChange={(e) => setClsName(e.target.value)}
                      placeholder="e.g. SS2 Physics Cohort A"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={clsSubject}
                        onChange={(e) => setClsSubject(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-2 text-xs"
                      >
                        {ACADEMIC_SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={clsGrade}
                        onChange={(e) => setClsGrade(e.target.value)}
                        placeholder="Grade Level"
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-2 text-xs"
                      />
                    </div>
                    <select
                      value={clsDeptId}
                      onChange={(e) => setClsDeptId(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    >
                      <option value={0}>No specific department</option>
                      {workspace.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Create Class
                    </button>
                  </form>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutateSchool(
                        '/members',
                        {
                          email: memberEmail,
                          memberRole,
                          classId: memberClassId || undefined,
                          wardEmail: memberRole === 'guardian' ? wardEmail : undefined,
                        },
                        'Member assigned to institution.'
                      );
                      setMemberEmail('');
                      setWardEmail('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm">3. Register Teacher, Student or Guardian</h4>
                    <input
                      type="email"
                      required
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="Registered IFIOK-EN email"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-2 text-xs"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="guardian">Parent / Guardian</option>
                        <option value="school_admin">School Admin</option>
                      </select>
                      <select
                        value={memberClassId}
                        onChange={(e) => setMemberClassId(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2 py-2 text-xs"
                      >
                        <option value={0}>All / Unassigned Class</option>
                        {workspace.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {memberRole === 'guardian' && (
                      <input
                        type="email"
                        value={wardEmail}
                        onChange={(e) => setWardEmail(e.target.value)}
                        placeholder="Student (ward) email"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                      />
                    )}
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Enrol Member
                    </button>
                  </form>
                </div>
              )}

              {workspace.isSchoolAdmin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutateSchool(
                      '/sessions',
                      {
                        name: sessName,
                        termLabel: sessTerm,
                        startDate: sessStart,
                        endDate: sessEnd,
                        isActive: sessActive,
                      },
                      'Academic session / term saved.'
                    );
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display font-bold text-sm">4. Academic Sessions & Terms</h4>
                    {workspace.sessions && workspace.sessions.length > 0 && (
                      <span className="font-mono text-[11px] text-slate-500">
                        {workspace.sessions.length} Term(s) Configured
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      required
                      value={sessName}
                      onChange={(e) => setSessName(e.target.value)}
                      placeholder="2026/2027 Session"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={sessTerm}
                      onChange={(e) => setSessTerm(e.target.value)}
                      placeholder="Term 1"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                    />
                    <input
                      type="date"
                      required
                      value={sessStart}
                      onChange={(e) => setSessStart(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs font-mono"
                    />
                    <input
                      type="date"
                      required
                      value={sessEnd}
                      onChange={(e) => setSessEnd(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      className="py-2 px-4 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      Save Session
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sessActive}
                      onChange={(e) => setSessActive(e.target.checked)}
                    />
                    <span>Set as current active academic term</span>
                  </label>
                </form>
              )}

              {/* Roster Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Class / Ward</th>
                      <th className="py-3 px-4">Age Safety Tier</th>
                      <th className="py-3 px-4 text-right">Transcript</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {workspace.roster.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{r.full_name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{r.email || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono uppercase">{r.member_role}</td>
                        <td className="py-3 px-4">{r.ward_name ? `Ward: ${r.ward_name}` : r.class_name || '—'}</td>
                        <td className="py-3 px-4 font-mono">{r.age_group}</td>
                        <td className="py-3 px-4 text-right">
                          {r.member_role === 'student' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReportCard(selectedSchoolId, r.user_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Report Card</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {portalMode === 'teacher' && (
        <TeacherContributionsSection
          user={user}
          mode="studio"
          schoolId={selectedSchoolId || null}
          onRequireAuth={onRequireAuth}
          onNotify={(type, text) => setNotice({ type, text })}
        />
      )}

      {/* Register Institution Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Apply for School Registration
                </h3>
              </div>
              <button type="button" onClick={() => setShowApplyModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApplySchool} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Institution Name</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Institution Type</label>
                  <select
                    value={appType}
                    onChange={(e) => setAppType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  >
                    <option value="Primary School">Primary School</option>
                    <option value="Secondary School">Secondary School</option>
                    <option value="High School">High School</option>
                    <option value="College / University">College / University</option>
                    <option value="Training Institute">Training Institute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Country</label>
                  <select
                    value={appCountry}
                    onChange={(e) => setAppCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={appCity}
                    onChange={(e) => setAppCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Child Safety Officer Email</label>
                  <input
                    type="email"
                    value={appSafetyEmail}
                    onChange={(e) => setAppSafetyEmail(e.target.value)}
                    placeholder="safeguarding@school.org"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Official Website (Optional)</label>
                <input
                  type="url"
                  value={appWebsite}
                  onChange={(e) => setAppWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Institutional Verification Document Scan (PNG / JPEG / WEBP)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFile(f, setAppDocUrl);
                  }}
                  className="text-xs"
                />
                {uploadingDoc && <span className="text-xs text-slate-500 ml-2">Scanning upload...</span>}
                {appDocUrl && (
                  <div className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded: {appDocUrl}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Institution Summary & Academic Scope</label>
                <textarea
                  rows={3}
                  required
                  minLength={15}
                  value={appSummary}
                  onChange={(e) => setAppSummary(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Submit Institution Application
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Printable Student Report Card Modal */}
      {reportCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono uppercase text-purple-700 dark:text-amber-400">
                  IFIOK SCHOOL — Official Term Report Card
                </div>
                <h3 className="text-xl font-display font-bold text-slate-950 dark:text-white mt-0.5">
                  {reportCard.student.full_name}
                </h3>
                <div className="text-xs text-slate-500">
                  {reportCard.school.name} · {reportCard.school.city ? `${reportCard.school.city}, ` : ''}
                  {reportCard.school.country}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button type="button" onClick={() => setReportCard(null)} className="cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                <div className="font-mono font-bold text-lg tabular-nums">
                  {reportCard.summary.overallAverage !== null ? `${reportCard.summary.overallAverage}%` : '—'}
                </div>
                <div className="text-slate-500">Overall Average</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                <div className="font-mono font-bold text-lg tabular-nums">
                  {reportCard.summary.gradedAssessments}
                </div>
                <div className="text-slate-500">Graded Assessments</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                <div className="font-mono font-bold text-lg tabular-nums">
                  {reportCard.summary.attendancePresent}/{reportCard.summary.attendanceTotal}
                </div>
                <div className="text-slate-500">Attendance Present</div>
              </div>
            </div>

            {reportCard.subjects.length === 0 ? (
              <p className="text-xs text-slate-500">No graded subject assessments recorded yet for this student.</p>
            ) : (
              <div className="space-y-3">
                {reportCard.subjects.map((sub) => (
                  <div
                    key={sub.subject}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-950 dark:text-white">
                      <span>{sub.subject}</span>
                      <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {sub.averagePct !== null ? `${sub.averagePct}%` : 'Pending'} ({sub.gradedCount} graded)
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sub.assignments.map((a, idx) => (
                        <div key={`${a.title}-${idx}`} className="py-1.5 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{a.title}</div>
                            {a.feedback && <div className="text-slate-500">{a.feedback}</div>}
                          </div>
                          <div className="font-mono tabular-nums shrink-0">
                            {a.score !== null ? `${a.score}/${a.maxScore}` : 'Ungraded'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-3">
              {reportCard.school.accreditation_note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
