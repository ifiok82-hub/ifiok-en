import {
  Download,
  FileText,
  Flag,
  History,
  Plus,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import {
  ACADEMIC_SUBJECTS,
  COUNTRIES,
  EDUCATION_LEVELS,
  LANGUAGE_OPTIONS,
} from '../lib/i18n.ts';
import type {
  TeacherSubmission,
  TeacherSubmissionStatus,
  TeacherSubmissionVersion,
  UserProfile,
} from '../types/platform.ts';

interface TeacherContributionsSectionProps {
  user: UserProfile | null;
  mode: 'library' | 'studio';
  schoolId?: number | null;
  onRequireAuth: () => void;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

const CONTRIBUTION_CATEGORIES = [
  'Lesson Plan',
  'Worksheet & Exercises',
  'Presentation Slides',
  'Revision Study Guide',
  'Marking Rubric & Exam Prep',
  'Audio / Multimedia Guide',
];

const STATUS_BADGE_CLASS: Record<TeacherSubmissionStatus, string> = {
  Draft: 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300',
  Submitted: 'border-amber-400 text-amber-700 dark:text-amber-300',
  'Under Review': 'border-purple-400 text-purple-700 dark:text-purple-300',
  'Revision Required': 'border-orange-400 text-orange-700 dark:text-orange-300',
  Approved: 'border-emerald-400 text-emerald-700 dark:text-emerald-300',
  Published: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Rejected: 'border-rose-400 text-rose-700 dark:text-rose-300',
  Suspended: 'border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  Archived: 'border-slate-400 text-slate-500',
};

export function TeacherContributionsSection({
  user,
  mode,
  schoolId = null,
  onRequireAuth,
  onNotify,
}: TeacherContributionsSectionProps) {
  const [items, setItems] = useState<TeacherSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(mode === 'studio');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');

  // Create submission modal
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>(ACADEMIC_SUBJECTS[0]);
  const [level, setLevel] = useState('secondary');
  const [country, setCountry] = useState('Global');
  const [languageCode, setLanguageCode] = useState('en');
  const [category, setCategory] = useState(CONTRIBUTION_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('Clear headings, readable font sizes, printable layout.');
  const [licenseTerms, setLicenseTerms] = useState('CC BY-NC-SA 4.0 / IFIOK SCHOOL Educational License');
  const [copyrightDeclared, setCopyrightDeclared] = useState(false);
  const [initialStatus, setInitialStatus] = useState<'Draft' | 'Submitted'>('Submitted');
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [fileBase64, setFileBase64] = useState('');

  // Version history / upload new version modal
  const [versionTarget, setVersionTarget] = useState<TeacherSubmission | null>(null);
  const [versions, setVersions] = useState<TeacherSubmissionVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [nextVersionTag, setNextVersionTag] = useState('1.1.0');
  const [changeNotes, setChangeNotes] = useState('');
  const [revFileName, setRevFileName] = useState('');
  const [revFileMime, setRevFileMime] = useState('');
  const [revFileBase64, setRevFileBase64] = useState('');
  const [uploadingRev, setUploadingRev] = useState(false);

  // Copyright / IP Report modal
  const [reportTarget, setReportTarget] = useState<TeacherSubmission | null>(null);
  const [reportReason, setReportReason] = useState('Suspected copyright or unauthorized redistribution');
  const [reportDetails, setReportDetails] = useState('');
  const [reportEvidenceUrl, setReportEvidenceUrl] = useState('');
  const [reporting, setReporting] = useState(false);

  const canAuthor = Boolean(
    user?.roles.some((r) => ['teacher', 'instructor', 'school_admin', 'super_admin'].includes(r))
  );

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mineOnly && user) params.set('mine', '1');
      if (subjectFilter !== 'All') params.set('subject', subjectFilter);
      if (searchQ.trim()) params.set('q', searchQ.trim());
      const res = await apiRequest<{ submissions: TeacherSubmission[] }>(
        `/api/academy/teacher-submissions?${params.toString()}`
      );
      setItems(res.submissions);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mineOnly, user, subjectFilter, searchQ]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    });

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!fileBase64) {
      onNotify?.('err', 'Please attach a document or educational resource file (PDF, DOCX, PPTX, etc.).');
      return;
    }
    if (!copyrightDeclared) {
      onNotify?.('err', 'You must sign the copyright & originality declaration before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ id: number; status: TeacherSubmissionStatus }>(
        '/api/academy/teacher-submissions',
        {
          method: 'POST',
          body: JSON.stringify({
            schoolId: schoolId || null,
            title,
            description,
            subject,
            level,
            country,
            languageCode,
            category,
            accessibilityNotes,
            copyrightDeclared,
            licenseTerms,
            status: initialStatus,
            fileName,
            mimeType: fileMime,
            dataBase64: fileBase64,
          }),
        }
      );
      onNotify?.('ok', `Teacher contribution saved with status "${res.status}".`);
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setFileName('');
      setFileBase64('');
      setCopyrightDeclared(false);
      await loadSubmissions();
    } catch (err) {
      onNotify?.('err', err instanceof Error ? err.message : 'Unable to upload teacher contribution.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransitionStatus = async (subId: number, status: 'Submitted' | 'Archived') => {
    try {
      await apiRequest(`/api/academy/teacher-submissions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onNotify?.('ok', `Contribution moved to "${status}".`);
      await loadSubmissions();
    } catch (err) {
      onNotify?.('err', err instanceof Error ? err.message : 'Unable to update contribution status.');
    }
  };

  const handleOpenVersions = async (sub: TeacherSubmission) => {
    setVersionTarget(sub);
    setNextVersionTag(() => {
      const parts = (sub.current_version || '1.0.0').split('.').map((n) => Number(n) || 0);
      return `${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
    });
    setChangeNotes('');
    setRevFileName('');
    setRevFileBase64('');
    setLoadingVersions(true);
    try {
      const res = await apiRequest<{ versions: TeacherSubmissionVersion[] }>(
        `/api/academy/teacher-submissions/${sub.id}/versions`
      );
      setVersions(res.versions);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionTarget || !revFileBase64) return;
    setUploadingRev(true);
    try {
      await apiRequest(`/api/academy/teacher-submissions/${versionTarget.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          version: nextVersionTag,
          changeNotes,
          fileName: revFileName,
          mimeType: revFileMime,
          dataBase64: revFileBase64,
        }),
      });
      onNotify?.('ok', `Uploaded revision v${nextVersionTag} and moved to Submitted for verification.`);
      setVersionTarget(null);
      await loadSubmissions();
    } catch (err) {
      onNotify?.('err', err instanceof Error ? err.message : 'Failed to upload new version.');
    } finally {
      setUploadingRev(false);
    }
  };

  const handleSubmitCopyrightReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!reportTarget) return;
    setReporting(true);
    try {
      await apiRequest('/api/divisions/copyright-reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'teacher_submission',
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails,
          evidenceUrl: reportEvidenceUrl,
        }),
      });
      onNotify?.('ok', 'Copyright / IP report logged for Governance review.');
      setReportTarget(null);
      setReportDetails('');
      setReportEvidenceUrl('');
    } catch (err) {
      onNotify?.('err', err instanceof Error ? err.message : 'Unable to submit IP notice.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {mode === 'studio'
                ? 'Educator Contributions & Version Control Studio'
                : 'Verified Educator Resource Library'}
            </span>
          </div>
          <h3 className="text-lg font-display font-bold text-slate-950 dark:text-white">
            {mode === 'studio'
              ? 'Upload & Manage Lesson Plans, Worksheets & Study Packs'
              : 'Approved & Published Teacher Contributions'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All files are SHA-256 checksummed, scanned against active scripts/malware, tracked across a 9-state moderation workflow, and indexed for IFIOK Professor citations once Approved or Published.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setMineOnly((p) => !p)}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                mineOnly
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {mineOnly ? 'Showing My Submissions' : 'Showing Public Library'}
            </button>
          )}
          {(mode === 'studio' || canAuthor) && (
            <button
              type="button"
              onClick={() => {
                if (!user) return onRequireAuth();
                setShowCreate(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Contribute Resource</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search lesson plans, worksheets, authors..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-1.5 text-xs"
        />
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-1.5 text-xs"
        >
          <option value="All">All Subjects</option>
          {ACADEMIC_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-28 rounded-lg bg-slate-100 dark:bg-[#081024] animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
          {mineOnly
            ? 'You have not uploaded any teacher contributions yet.'
            : 'No approved/published teacher contributions match the selected filter yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const isOwner = Boolean(user && item.author_user_id === user.id);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4 flex flex-col justify-between space-y-3 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">
                      {item.subject} · {item.category} · v{item.current_version}
                    </span>
                    <span className={`px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${STATUS_BADGE_CLASS[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-sm text-slate-950 dark:text-white">{item.title}</h4>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{item.description}</p>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                    <div>
                      Author: {item.author_name || 'Educator'} ({item.country}) · Level: {item.level} · Lang:{' '}
                      {item.language_code.toUpperCase()}
                    </div>
                    <div className="font-mono">
                      File: {item.file_original_name} ({item.file_format} · {(item.file_size_bytes / 1024).toFixed(1)} KB)
                    </div>
                    <div>Licence: {item.license_terms}</div>
                    {item.accessibility_notes && <div>Accessibility: {item.accessibility_notes}</div>}
                    {item.review_notes && (
                      <div className="text-amber-700 dark:text-amber-300 font-medium">
                        Reviewer Notes: {item.review_notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/academy/teacher-submissions/${item.id}/download`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenVersions(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Versions</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isOwner && ['Draft', 'Revision Required'].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => handleTransitionStatus(item.id, 'Submitted')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Submit Review</span>
                      </button>
                    )}
                    {isOwner && !['Archived', 'Suspended'].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => handleTransitionStatus(item.id, 'Archived')}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        Archive
                      </button>
                    )}
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) return onRequireAuth();
                          setReportTarget(item);
                        }}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <Flag className="w-3 h-3" />
                        <span>Report IP</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE CONTRIBUTION MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                Contribute Verified Teaching Resource
              </h3>
              <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmission} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Resource Title</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Algebra Quadratic Functions Worked Lesson Pack"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    {ACADEMIC_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    {CONTRIBUTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Target Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>
                        {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Language</label>
                  <select
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Region / Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Workflow Action</label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as 'Draft' | 'Submitted')}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-2"
                  >
                    <option value="Submitted">Submit for Moderation Review</option>
                    <option value="Draft">Save as Private Draft</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Pedagogical Description</label>
                <textarea
                  rows={3}
                  required
                  minLength={20}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe learning objectives, classroom activities, and how teachers or learners should use this file..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Accessibility Notes</label>
                  <input
                    type="text"
                    value={accessibilityNotes}
                    onChange={(e) => setAccessibilityNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Distribution Licence Terms</label>
                  <input
                    type="text"
                    value={licenseTerms}
                    onChange={(e) => setLicenseTerms(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-3 space-y-1.5">
                <label className="block font-medium">
                  Upload File (PDF, DOCX, PPTX, TXT, MD, CSV, PNG/JPG/WEBP, MP3/MP4 — max 15 MB)
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.mp3,.mp4"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const b64 = await readFileAsBase64(f);
                    setFileName(f.name);
                    setFileMime(f.type || 'application/octet-stream');
                    setFileBase64(b64);
                  }}
                />
                {fileName && (
                  <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    Ready: {fileName}
                  </div>
                )}
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyrightDeclared}
                  onChange={(e) => setCopyrightDeclared(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I declare that this material is my original educational work or duly licensed for IFIOK SCHOOL distribution, with no third-party copyright infringement or malicious payload.
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Scanning & Saving...' : 'Save Teacher Contribution'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VERSION HISTORY & REVISION MODAL */}
      {versionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-700 dark:text-amber-400" />
                <h3 className="font-display font-bold text-slate-950 dark:text-white">
                  Version History — {versionTarget.title}
                </h3>
              </div>
              <button type="button" onClick={() => setVersionTarget(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingVersions ? (
              <div className="h-20 animate-pulse bg-slate-100 dark:bg-[#081024] rounded-lg" />
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-500">No historical version records logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-52 overflow-y-auto text-xs">
                {versions.map((v) => (
                  <div key={v.id} className="p-3 space-y-0.5">
                    <div className="flex items-center justify-between font-mono font-semibold">
                      <span>v{v.version} · {v.file_original_name}</span>
                      <span className="text-slate-500">{v.created_at.slice(0, 10)}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">{v.change_notes}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">SHA-256: {v.file_sha256}</div>
                  </div>
                ))}
              </div>
            )}

            {user && user.id === versionTarget.author_user_id && (
              <form onSubmit={handleUploadNewVersion} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="font-semibold flex items-center gap-1.5 text-slate-950 dark:text-white">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload New Revision</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={nextVersionTag}
                    onChange={(e) => setNextVersionTag(e.target.value)}
                    placeholder="1.1.0"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 font-mono"
                  />
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.mp3,.mp4"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const b64 = await readFileAsBase64(f);
                      setRevFileName(f.name);
                      setRevFileMime(f.type || 'application/octet-stream');
                      setRevFileBase64(b64);
                    }}
                  />
                </div>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="Summary of improvements or reviewer corrections..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={uploadingRev}
                  className="w-full py-2 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {uploadingRev ? 'Uploading Revision...' : 'Upload New Version & Submit for Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* COPYRIGHT / IP REPORT MODAL */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">
                Report Copyright / IP Issue
              </h3>
              <button type="button" onClick={() => setReportTarget(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCopyrightReport} className="space-y-3 text-xs">
              <div className="text-slate-500">Resource: <strong>{reportTarget.title}</strong></div>
              <div>
                <label className="block font-medium mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Detailed Explanation (min 15 chars)</label>
                <textarea
                  rows={3}
                  required
                  minLength={15}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Evidence URL (Optional)</label>
                <input
                  type="url"
                  value={reportEvidenceUrl}
                  onChange={(e) => setReportEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={reporting}
                className="w-full py-2.5 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
              >
                {reporting ? 'Filing IP Notice...' : 'Submit Copyright / IP Notice'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
