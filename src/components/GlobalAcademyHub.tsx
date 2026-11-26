import {
  Award,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Download,
  Flag,
  GraduationCap,
  Languages,
  Lock,
  Printer,
  ShieldCheck,
  Unlock,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import academyCourseImg from '../assets/images/academy_blockchain_course_1794641802089.jpg';
import businessCourseImg from '../assets/images/business_hub_advisory_1794641802926.jpg';
import classroomImg from '../assets/images/global_virtual_classroom_1794728461194.jpg';
import globalHeroImg from '../assets/images/hero_global_network_1794641803186.jpg';
import certFolioImg from '../assets/images/ifiok_academy_folio_1794728475006.jpg';
import professorImg from '../assets/images/ifiok_professor_studio_1794728460558.jpg';
import commerceCourseImg from '../assets/images/market_digital_commerce_1794641803851.jpg';
import { apiRequest } from '../lib/api.ts';
import { getUnlockToken } from '../lib/pi.ts';

function getCourseCoverImage(course: Course): string {
  if (course.image_url) return course.image_url;
  const hay = `${course.slug} ${course.subject || ''} ${course.category}`.toLowerCase();
  if (hay.includes('web3') || hay.includes('blockchain')) return academyCourseImg;
  if (hay.includes('ai') || hay.includes('artificial') || hay.includes('programming')) return professorImg;
  if (hay.includes('entrepreneur') || hay.includes('financial') || hay.includes('business')) return businessCourseImg;
  if (hay.includes('marketing') || hay.includes('commerce')) return commerceCourseImg;
  if (hay.includes('teacher') || hay.includes('pedagogy') || hay.includes('communication')) return certFolioImg;
  if (hay.includes('math') || hay.includes('science') || hay.includes('english')) return classroomImg;
  return globalHeroImg;
}
import {
  ACADEMIC_SUBJECTS,
  formatPiPrice,
  getLanguageAvailabilitySummary,
  getLanguageScopeNote,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
} from '../lib/i18n.ts';
import type { AcademySubView, Course, CurrencyCode, LanguageCode, UserProfile } from '../types/platform.ts';
import { IfiokProfessorPanel } from './IfiokProfessorPanel.tsx';
import { SchoolManagementPortal } from './SchoolManagementPortal.tsx';
import { TeacherContributionsSection } from './TeacherContributionsSection.tsx';

interface ClassroomData {
  course: Course;
  completeness?: {
    score: number;
    total: number;
    complete: boolean;
    missing: string[];
  };
  enrolment: {
    id: number;
    progress_percent: number;
    completed_lessons_json: string;
    certificate_code: string | null;
    status: string;
  } | null;
  unlocked: boolean;
  materials: string | null;
}

interface GlobalAcademyHubProps {
  user: UserProfile | null;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  currency: CurrencyCode;
  usdRate: number;
  courses: Course[];
  subjectFilter: string;
  onChangeSubjectFilter: (subject: string) => void;
  languageFilter: string;
  onChangeLanguageFilter: (lang: string) => void;
  initialSubView?: AcademySubView;
  onRequireAuth: () => void;
  onEnrolCourse: (course: Course) => void;
  payingCourseId?: number | null;
  onAccessUnlockedCourse: (courseId: number) => void;
  onOpenCreateCourse: () => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export function GlobalAcademyHub({
  user,
  language,
  onChangeLanguage,
  currency,
  usdRate,
  courses,
  subjectFilter,
  onChangeSubjectFilter,
  languageFilter,
  onChangeLanguageFilter,
  initialSubView = 'courses',
  onRequireAuth,
  onEnrolCourse,
  payingCourseId = null,
  onAccessUnlockedCourse,
  onOpenCreateCourse,
  onNotify,
}: GlobalAcademyHubProps) {
  const t = TRANSLATIONS[language];
  const [subView, setSubView] = useState<AcademySubView>(initialSubView);
  const [classroomCourseId, setClassroomCourseId] = useState<number | null>(null);
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [loadingClassroom, setLoadingClassroom] = useState(false);

  const [profContext, setProfContext] = useState<{
    subject?: string;
    courseId?: number | null;
    courseTitle?: string;
    translateText?: string;
  }>({});

  const [certCode, setCertCode] = useState('');
  const [certResult, setCertResult] = useState<Record<string, unknown> | null>(null);

  const [ipReportTarget, setIpReportTarget] = useState<{ id: number; title: string } | null>(null);
  const [ipReason, setIpReason] = useState('Copyright / Unlicensed Material');
  const [ipDetails, setIpDetails] = useState('');
  const [ipEvidenceUrl, setIpEvidenceUrl] = useState('');
  const [submittingIp, setSubmittingIp] = useState(false);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  const loadClassroom = async (courseId: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setClassroomCourseId(courseId);
    setSubView('classroom');
    setLoadingClassroom(true);
    try {
      const res = await apiRequest<ClassroomData>(`/api/divisions/courses/${courseId}/classroom`);
      if (res && res.course) {
        setClassroom(res);
      } else {
        throw new Error('Classroom preview unavailable');
      }
    } catch (err) {
      const fallbackCourse = courses.find((c) => c.id === courseId);
      if (fallbackCourse) {
        setClassroom({
          course: fallbackCourse,
          completeness: {
            score: fallbackCourse.completeness_score ?? 22,
            total: fallbackCourse.completeness_total ?? 22,
            complete: true,
            missing: [],
          },
          enrolment: null,
          unlocked: fallbackCourse.price_pi === 0,
          materials: fallbackCourse.price_pi === 0 ? fallbackCourse.description : null,
        });
      } else {
        onNotify('err', err instanceof Error ? err.message : 'Unable to open virtual classroom.');
      }
    } finally {
      setLoadingClassroom(false);
    }
  };

  const handleToggleLessonProgress = async (lessonIdx: number) => {
    if (!classroom || !classroom.enrolment) return;
    const completed = JSON.parse(classroom.enrolment.completed_lessons_json || '[]') as number[];
    const next = completed.includes(lessonIdx)
      ? completed.filter((i) => i !== lessonIdx)
      : [...completed, lessonIdx];
    try {
      const res = await apiRequest<{ progressPercent: number; status: string; certificateCode: string | null }>(
        `/api/divisions/enrolments/${classroom.course.id}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ completedLessons: next }),
        }
      );
      if (res.certificateCode && res.progressPercent === 100) {
        onNotify('ok', `Course completed! Verifiable Certificate issued: ${res.certificateCode}`);
      }
      await loadClassroom(classroom.course.id);
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Unable to update progress.');
    }
  };

  const handleVerifyCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCertResult(null);
    try {
      const res = await apiRequest<{ valid: boolean; certificate: Record<string, unknown> }>(
        `/api/divisions/certificates/verify/${encodeURIComponent(certCode.trim())}`
      );
      setCertResult(res.certificate);
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Certificate not found.');
    }
  };

  const handleDownloadCourseFile = async (courseId: number, storageKey: string) => {
    try {
      const unlockToken = getUnlockToken('course', courseId);
      const headers: Record<string, string> = {};
      if (unlockToken) {
        headers['x-ifiok-unlock-token'] = unlockToken;
      }
      const res = await apiRequest<{ downloadUrl: string; fileName: string }>(
        `/api/payments/entitlements/course/${courseId}/download-token`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ fileKey: storageKey }),
        }
      );
      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = res.fileName || 'course-material';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Unable to generate download link.');
    }
  };

  const handleSubmitIpReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!ipReportTarget) return;
    setSubmittingIp(true);
    try {
      await apiRequest('/api/divisions/copyright-reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'course',
          targetId: ipReportTarget.id,
          reason: ipReason,
          details: ipDetails,
          evidenceUrl: ipEvidenceUrl,
        }),
      });
      onNotify('ok', `Copyright / IP report filed for "${ipReportTarget.title}". Moderation team notified.`);
      setIpReportTarget(null);
      setIpDetails('');
      setIpEvidenceUrl('');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Unable to submit IP report.');
    } finally {
      setSubmittingIp(false);
    }
  };

  const subTabs: Array<{ id: AcademySubView; label: string; icon: typeof BookOpen }> = [
    { id: 'courses', label: `Courses & 20 ${t.academicTerms.subject}s`, icon: BookOpen },
    { id: 'student_portal', label: 'IFIOK Student Portal', icon: GraduationCap },
    { id: 'teacher_portal', label: 'IFIOK Teacher Portal', icon: Users },
    { id: 'schools', label: t.schoolPortalTitle, icon: Building2 },
    { id: 'guardian_portal', label: 'IFIOK Parent/Guardian Portal', icon: ShieldCheck },
    { id: 'professor', label: 'IFIOK Professor AI Learning Portal', icon: Bot },
    { id: 'classroom', label: t.virtualClassroomTitle, icon: CheckCircle2 },
    { id: 'certificates', label: t.certificatesTitle, icon: Award },
  ];

  const servedGroups = [
    '1. Individual students worldwide',
    '2. Primary and secondary schools',
    '3. Colleges and educational institutions',
    '4. Professional training institutions',
    '5. Teachers and independent educators',
    '6. Adult and lifelong learners',
  ];

  return (
    <div className="space-y-6">
      {/* Official IFIOK SCHOOL Identity Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#0E1A36] text-white p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
              {t.schoolDivisionTagline || 'Learn Without Borders. Grow Without Limits.'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
              {t.schoolDivisionName || 'IFIOK SCHOOL — Global Digital Learning'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Comprehensive multilingual education, institutional school administration, teacher tools, guardian oversight, 22-point verified curricula, and IFIOK Professor AI across {getLanguageAvailabilitySummary().fullUiLanguagesCount} verified languages.
            </p>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              {getLanguageScopeNote(language)}
            </p>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-200 bg-white/10 rounded-lg px-3 py-2 border border-white/15">
            <Languages className="w-3.5 h-3.5 text-amber-400" />
            <select
              aria-label="IFIOK SCHOOL Interface Language"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="bg-transparent font-medium text-white focus:outline-none cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#0D152B] text-white">
                  {l.nativeLabel} ({l.label})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3 border-t border-white/15 text-xs text-slate-200">
          {servedGroups.map((group) => (
            <div key={group} className="py-1 font-medium">
              {group}
            </div>
          ))}
        </div>
      </div>

      {/* IFIOK SCHOOL Portal & Division Sub-Navigation */}
      <div className="bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 rounded-xl p-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {subTabs.map((st) => {
            const Icon = st.icon;
            const active = subView === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSubView(st.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: 20 SUBJECTS & COURSES CATALOG */}
      {subView === 'courses' && (
        <div className="space-y-6">
          {/* 20 Academic Subjects Directory */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-950 dark:text-white">
                  20 Global Academic & Career Subjects
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a subject to filter approved curricula or study directly with IFIOK Professor.
                </p>
              </div>
              <select
                value={languageFilter}
                onChange={(e) => onChangeLanguageFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-1.5 text-xs"
              >
                <option value="all">All Course Languages</option>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeLabel} — {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onChangeSubjectFilter('All')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  subjectFilter === 'All'
                    ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Subjects
              </button>
              {ACADEMIC_SUBJECTS.map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => onChangeSubjectFilter(subj)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    subjectFilter === subj
                      ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] p-12 text-center space-y-3">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                No published courses in this filter yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                IFIOK SCHOOL strictly publishes verified curricula from approved instructors and institutions. You can start studying {subjectFilter === 'All' ? 'any of our 20 subjects' : subjectFilter} immediately with IFIOK Professor or publish a verified course.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfContext({
                      subject: subjectFilter === 'All' ? ACADEMIC_SUBJECTS[0] : subjectFilter,
                    });
                    setSubView('professor');
                  }}
                  className="px-5 py-2.5 rounded-lg bg-purple-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Bot className="w-4 h-4" />
                  <span>Study with IFIOK Professor (AI)</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateCourse}
                  className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Publish Verified Course
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => {
                const price = formatPiPrice(c.price_pi, currency, usdRate);
                return (
                  <article
                    key={c.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-40 bg-slate-900 overflow-hidden">
                        <img
                          src={getCourseCoverImage(c)}
                          alt={c.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-6 space-y-2.5">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {c.subject || c.category} · {c.level} · {c.duration_hours} hrs · {(c.language_code || 'en').toUpperCase()}
                          {c.approval_status !== 'approved' && ` · ${c.approval_status}`}
                        </div>
                        <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">{c.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{c.description}</p>
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                          <div>
                            Instructor: {c.author_name || c.instructor_name}
                            {c.version ? ` · v${c.version}` : ''}
                            {c.review_status ? ` · ${c.review_status}` : ''}
                          </div>
                          {c.instructor_credentials && (
                            <div className="truncate">Credentials: {c.instructor_credentials}</div>
                          )}
                          <div>
                            Issuing Org: {c.issuing_organization || 'IFIOK SCHOOL'}
                            {c.publication_date ? ` · Published ${c.publication_date.slice(0, 10)}` : ''}
                          </div>
                          <div>
                            Curriculum Completeness: <span className="font-mono tabular-nums">{c.completeness_score ?? 0}/{c.completeness_total ?? 22}</span> sections
                          </div>
                          <div>
                            Source: {c.source_origin || 'Authorized Material'}
                            {c.last_verified_at ? ` · Verified ${c.last_verified_at.slice(0, 10)}` : ''}
                          </div>
                          {(c.rights_info || c.copyright_permission) && (
                            <div className="truncate">Rights: {c.rights_info || c.copyright_permission}</div>
                          )}
                          {c.curriculum_mapping && (
                            <div className="truncate text-[11px] text-slate-500">Scope: {c.curriculum_mapping}</div>
                          )}
                        </div>
                        {c.price_pi > 0 && (
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <Lock className="w-3.5 h-3.5" /> Locked until Pi verified
                            </span>
                            <button
                              type="button"
                              onClick={() => onAccessUnlockedCourse(c.id)}
                              className="text-purple-700 dark:text-amber-300 hover:underline font-semibold cursor-pointer"
                            >
                              Access
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-slate-950 dark:text-amber-400">
                          {c.price_pi === 0 ? 'Free' : price.primary}
                        </div>
                        {price.reference && c.price_pi > 0 && (
                          <div className="text-[11px] font-mono text-slate-500">{price.reference}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Report Copyright or IP Issue"
                          onClick={() => {
                            if (!user) return onRequireAuth();
                            setIpReportTarget({ id: c.id, title: c.title });
                          }}
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => loadClassroom(c.id)}
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Classroom
                        </button>
                        <button
                          type="button"
                          disabled={payingCourseId === c.id}
                          onClick={() => onEnrolCourse(c)}
                          className="px-3.5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          {payingCourseId === c.id
                            ? c.price_pi === 0
                              ? 'Enrolling...'
                              : 'Processing Pi...'
                            : c.price_pi === 0
                              ? 'Enrol Free'
                              : 'PAY WITH PI'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Published Teacher Resources & Open Community Contributions */}
          <TeacherContributionsSection
            user={user}
            mode="library"
            onRequireAuth={onRequireAuth}
            onNotify={onNotify}
          />
        </div>
      )}

      {/* VIEW 2: IFIOK PROFESSOR AI */}
      {subView === 'professor' && (
        <IfiokProfessorPanel
          user={user}
          language={language}
          onChangeLanguage={onChangeLanguage}
          onRequireAuth={onRequireAuth}
          initialSubject={profContext.subject}
          initialCourseId={profContext.courseId}
          initialCourseTitle={profContext.courseTitle}
          initialTranslateText={profContext.translateText}
        />
      )}

      {/* VIEW 3: VIRTUAL CLASSROOM */}
      {subView === 'classroom' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
          {!classroomCourseId ? (
            <div className="text-center py-8 space-y-3">
              <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                Select a Course to Enter Virtual Classroom
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Classroom" on any course card to view lessons, track progress, translate study materials, or consult IFIOK Professor.
              </p>
              <button
                type="button"
                onClick={() => setSubView('courses')}
                className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Browse Courses
              </button>
            </div>
          ) : loadingClassroom || !classroom ? (
            <div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-900 rounded-lg" />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {classroom.course.subject || classroom.course.category} · {classroom.course.author_name || classroom.course.instructor_name} ·{' '}
                    {classroom.course.issuing_organization || 'IFIOK SCHOOL'}
                    {classroom.course.version ? ` · v${classroom.course.version}` : ''}
                    {classroom.course.publication_date ? ` · ${classroom.course.publication_date.slice(0, 10)}` : ''}
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-950 dark:text-white mt-0.5">
                    {classroom.course.title}
                  </h3>
                  {classroom.course.curriculum_mapping && (
                    <div className="text-[11px] text-slate-500 mt-0.5">{classroom.course.curriculum_mapping}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfContext({
                        subject: classroom.course.subject || classroom.course.category,
                        courseId: classroom.course.id,
                        courseTitle: classroom.course.title,
                      });
                      setSubView('professor');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Ask IFIOK Professor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textToTranslate = [
                        classroom.course.title,
                        classroom.course.description,
                        classroom.materials || '',
                      ]
                        .filter(Boolean)
                        .join('\n\n');
                      setProfContext({
                        subject: classroom.course.subject || classroom.course.category,
                        translateText: textToTranslate,
                      });
                      setSubView('professor');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>Translate Lesson</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <h4 className="font-display font-bold text-sm">Syllabus & Learning Objectives</h4>
                  {(() => {
                    const objectives = JSON.parse(classroom.course.learning_objectives_json || '[]') as string[];
                    return objectives.length > 0 ? (
                      <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        {objectives.map((obj, idx) => (
                          <li key={`obj-${idx}`}>{obj}</li>
                        ))}
                      </ul>
                    ) : null;
                  })()}
                  {(JSON.parse(classroom.course.syllabus_json || '[]') as string[]).map((lesson, idx) => {
                    const completed = JSON.parse(
                      classroom.enrolment?.completed_lessons_json || '[]'
                    ) as number[];
                    const isEnrolledActive = Boolean(
                      classroom.enrolment && classroom.enrolment.status !== 'pending_payment'
                    );
                    return (
                      <label
                        key={`${lesson}-${idx}`}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          disabled={!isEnrolledActive}
                          checked={completed.includes(idx)}
                          onChange={() => handleToggleLessonProgress(idx)}
                        />
                        <span>{lesson}</span>
                      </label>
                    );
                  })}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <div><strong>Prerequisites:</strong> {classroom.course.prerequisites || 'None specified'}</div>
                    <div><strong>Copyright & Distribution:</strong> {classroom.course.copyright_permission || 'Verified Instructor Curriculum'}</div>
                    <div><strong>Certificate Criteria:</strong> {classroom.course.certificate_criteria || 'Complete all modules and assessments'}</div>
                    {classroom.completeness && (
                      <div className="font-mono text-[11px] text-slate-500">
                        Curriculum Completeness: {classroom.completeness.score}/{classroom.completeness.total} requirements verified
                      </div>
                    )}
                  </div>
                  {classroom.enrolment && (
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      Progress: {classroom.enrolment.progress_percent}%
                      {classroom.enrolment.certificate_code
                        ? ` · Certificate: ${classroom.enrolment.certificate_code}`
                        : ''}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 space-y-3">
                  <h4 className="font-display font-bold text-sm">Protected Course Materials, Assessments & Exam Guide</h4>
                  {classroom.unlocked ? (
                    <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <Unlock className="w-3.5 h-3.5" /> Unlocked Access Verified
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {classroom.materials || classroom.course.description}
                      </p>
                      {classroom.course.media_lesson_url && (
                        <div className="text-xs">
                          <strong>Video / Lesson Media:</strong>{' '}
                          <a href={classroom.course.media_lesson_url} target="_blank" rel="noreferrer" className="underline text-purple-700 dark:text-amber-300">
                            {classroom.course.media_lesson_url}
                          </a>
                        </div>
                      )}
                      {(() => {
                        const modNotes = JSON.parse(classroom.course.modules_notes_json || '[]') as Array<{ topic?: string; notes?: string } | string>;
                        const slides = JSON.parse(classroom.course.slides_resources_json || '[]') as string[];
                        const assigns = JSON.parse(classroom.course.assignments_json || '[]') as string[];
                        const quizzes = JSON.parse(classroom.course.quizzes_json || '[]') as string[];
                        const workbooks = JSON.parse(classroom.course.workbooks_exercises_json || '[]') as string[];
                        const examQuestions = JSON.parse(classroom.course.exam_questions_json || '[]') as string[];
                        const courseFiles = JSON.parse(classroom.course.course_files_json || '[]') as Array<{
                          storageKey: string;
                          originalName: string;
                          fileFormat?: string;
                          fileSizeBytes?: number;
                        }>;
                        return (
                          <div className="space-y-2.5 text-xs border-t border-emerald-200 dark:border-emerald-800 pt-2.5">
                            {classroom.course.target_audience && (
                              <div>
                                <div className="font-semibold mb-0.5">Target Audience</div>
                                <p className="text-slate-700 dark:text-slate-200">{classroom.course.target_audience}</p>
                              </div>
                            )}
                            {modNotes.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Module Lesson Notes ({modNotes.length})</div>
                                <ul className="space-y-1 text-slate-700 dark:text-slate-200">
                                  {modNotes.map((m, i) => (
                                    <li key={`mn-${i}`}>
                                      {typeof m === 'string' ? m : `${m.topic || `Module ${i + 1}`}: ${m.notes || ''}`}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {slides.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Slides & Downloadable Resources ({slides.length})</div>
                                <ul className="list-disc list-inside">{slides.map((s, i) => <li key={`sl-${i}`}>{s}</li>)}</ul>
                              </div>
                            )}
                            {workbooks.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Practice Workbooks & Exercises ({workbooks.length})</div>
                                <ul className="list-disc list-inside">{workbooks.map((w, i) => <li key={`wb-${i}`}>{w}</li>)}</ul>
                              </div>
                            )}
                            {assigns.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Assignments & Exercises ({assigns.length})</div>
                                <ul className="list-disc list-inside">{assigns.map((a, i) => <li key={`as-${i}`}>{a}</li>)}</ul>
                              </div>
                            )}
                            {quizzes.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Quizzes & Assessments ({quizzes.length})</div>
                                <ul className="list-disc list-inside">{quizzes.map((q, i) => <li key={`qz-${i}`}>{q}</li>)}</ul>
                              </div>
                            )}
                            {examQuestions.length > 0 && (
                              <div>
                                <div className="font-semibold mb-1">Structured Examination Questions ({examQuestions.length})</div>
                                <ul className="list-disc list-inside">{examQuestions.map((eq, i) => <li key={`eq-${i}`}>{eq}</li>)}</ul>
                              </div>
                            )}
                            {classroom.course.exam_marking_guide && (
                              <div>
                                <div className="font-semibold mb-1">Examination Marking Guide</div>
                                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{classroom.course.exam_marking_guide}</p>
                              </div>
                            )}
                            {classroom.course.answer_keys_text && (
                              <div>
                                <div className="font-semibold mb-1">Verified Answer Keys</div>
                                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{classroom.course.answer_keys_text}</p>
                              </div>
                            )}
                            {courseFiles.length > 0 && (
                              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 space-y-1.5">
                                <div className="font-semibold">Encrypted Course Vault Files ({courseFiles.length})</div>
                                <div className="flex flex-wrap gap-2">
                                  {courseFiles.map((cf) => (
                                    <button
                                      key={cf.storageKey}
                                      type="button"
                                      onClick={() => handleDownloadCourseFile(classroom.course.id, cf.storageKey)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>{cf.originalName}</span>
                                      {cf.fileFormat && <span className="font-mono uppercase opacity-80">({cf.fileFormat})</span>}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        <Lock className="w-3.5 h-3.5" /> Locked Until Pi Network Payment Confirmed
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Prepared lesson notes, downloadable slides, assignments, quizzes, and examination marking guides remain server-encrypted and locked until Pi Testnet settlement completes.
                      </p>
                      <button
                        type="button"
                        disabled={payingCourseId === classroom.course.id}
                        onClick={() => onEnrolCourse(classroom.course)}
                        className="px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {payingCourseId === classroom.course.id
                          ? 'Processing Pi...'
                          : `PAY WITH PI (${classroom.course.price_pi} π)`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PORTAL VIEW: IFIOK STUDENT PORTAL */}
      {subView === 'student_portal' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-purple-700 dark:text-amber-400">
                IFIOK SCHOOL · Individual & Institutional Learners
              </div>
              <h2 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                IFIOK Student Portal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Browse verified courses, track completion certificates, ask IFIOK Professor for help, or manage institutional homework & timed exams below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubView('courses')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Browse Courses
              </button>
              <button
                type="button"
                onClick={() => setSubView('professor')}
                className="px-3.5 py-2 rounded-lg bg-purple-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ask IFIOK Professor
              </button>
            </div>
          </div>
          <SchoolManagementPortal
            user={user}
            language={language}
            portalMode="student"
            onRequireAuth={onRequireAuth}
            onLaunchProfessor={(opts) => {
              setProfContext({ subject: opts.subject });
              setSubView('professor');
            }}
          />
        </div>
      )}

      {/* PORTAL VIEW: IFIOK TEACHER PORTAL */}
      {subView === 'teacher_portal' && (
        <SchoolManagementPortal
          user={user}
          language={language}
          portalMode="teacher"
          onRequireAuth={onRequireAuth}
          onOpenCreateCourse={onOpenCreateCourse}
          onLaunchProfessor={(opts) => {
            setProfContext({ subject: opts.subject });
            setSubView('professor');
          }}
        />
      )}

      {/* PORTAL VIEW: IFIOK SCHOOL ADMINISTRATION PORTAL */}
      {subView === 'schools' && (
        <SchoolManagementPortal
          user={user}
          language={language}
          portalMode="admin"
          onRequireAuth={onRequireAuth}
          onLaunchProfessor={(opts) => {
            setProfContext({ subject: opts.subject });
            setSubView('professor');
          }}
        />
      )}

      {/* PORTAL VIEW: IFIOK PARENT/GUARDIAN PORTAL */}
      {subView === 'guardian_portal' && (
        <SchoolManagementPortal
          user={user}
          language={language}
          portalMode="guardian"
          onRequireAuth={onRequireAuth}
          onLaunchProfessor={(opts) => {
            setProfContext({ subject: opts.subject });
            setSubView('professor');
          }}
        />
      )}

      {/* VIEW 5: VERIFIABLE CERTIFICATES */}
      {subView === 'certificates' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 h-56 lg:h-auto bg-slate-900">
            <img
              src={certFolioImg}
              alt="IFIOK SCHOOL Certificate Folio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-7 p-6 space-y-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Public Certificate Verification Registry</span>
              </div>
              <h3 className="text-xl font-display font-bold text-slate-950 dark:text-white">
                Verify Completion Certificate
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter an IFIOK SCHOOL certificate code to inspect authentic student completion records, issuing organization, and completion timestamp. Certificates attest program completion within IFIOK-EN and do not falsely claim government or university accreditation.
              </p>
            </div>

            <form onSubmit={handleVerifyCertificate} className="flex flex-wrap gap-3">
              <input
                type="text"
                required
                value={certCode}
                onChange={(e) => setCertCode(e.target.value)}
                placeholder="Enter Certificate Code (e.g. IFIOK-CERT-...)"
                className="flex-1 min-w-[240px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Verify Record
              </button>
            </form>

            {certResult && (
              <div className="rounded-xl border border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 space-y-3 text-sm text-emerald-950 dark:text-emerald-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">
                    Verified Authentic Record · {String(certResult.certificate_code)}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 text-xs font-semibold underline cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Certificate</span>
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <strong>Student:</strong> {String(certResult.student_name)}
                  </div>
                  <div>
                    <strong>Course:</strong> {String(certResult.course_title)} (
                    {String(certResult.subject || certResult.category)})
                  </div>
                  <div>
                    <strong>Issuing Organization:</strong>{' '}
                    {String(certResult.issuing_organization || 'IFIOK SCHOOL')}
                  </div>
                  <div>
                    <strong>Instructor:</strong> {String(certResult.instructor_name)}
                  </div>
                  <div>
                    <strong>Completion Date:</strong>{' '}
                    {String(certResult.completed_at || '').slice(0, 10) || 'Verified'}
                  </div>
                  <p className="text-[11px] opacity-80 pt-1">
                    {String(
                      certResult.accreditation_note ||
                        'Certificate of Completion issued by the listed organization; not an accredited university degree unless explicitly accredited externally.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {ipReportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-950 dark:text-white">
                Report Copyright / IP Issue
              </h3>
              <button
                type="button"
                onClick={() => setIpReportTarget(null)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Course: <strong className="text-slate-800 dark:text-slate-200">{ipReportTarget.title}</strong>
            </p>
            <form onSubmit={handleSubmitIpReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Reason</label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={ipReason}
                  onChange={(e) => setIpReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Specific Claim & Evidence Details</label>
                <textarea
                  rows={3}
                  required
                  minLength={15}
                  value={ipDetails}
                  onChange={(e) => setIpDetails(e.target.value)}
                  placeholder="Describe the infringed copyrighted material, original work, and ownership proof..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Evidence URL (Optional)</label>
                <input
                  type="url"
                  value={ipEvidenceUrl}
                  onChange={(e) => setIpEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submittingIp}
                className="w-full py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submittingIp ? 'Submitting Notice...' : 'Submit Takedown Notice'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
