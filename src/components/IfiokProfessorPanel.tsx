import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import professorStudioImg from '../assets/images/ifiok_professor_studio_1794728460558.jpg';
import { apiRequest } from '../lib/api.ts';
import {
  ACADEMIC_SUBJECTS,
  getBcp47ForLanguage,
  getLanguageAvailabilitySummary,
  getLanguageScopeNote,
  isRtlLanguage,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
} from '../lib/i18n.ts';
import type { AiCitation, AiProviderStatus, LanguageCode, UserProfile } from '../types/platform.ts';

type ProfessorMode =
  | 'tutor'
  | 'lesson'
  | 'homework'
  | 'code_stem'
  | 'practice_quiz'
  | 'mark_answer'
  | 'explain_doc'
  | 'recommendations'
  | 'translate'
  | 'exam_prep'
  | 'teacher_prep';

interface SessionSummary {
  id: number;
  subject: string;
  language_code: string;
  mode: string;
  title: string;
  course_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  created_at?: string;
}

interface PracticeQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface PracticeQuizPayload {
  title: string;
  subject: string;
  language: string;
  questions: PracticeQuizQuestion[];
}

interface IfiokProfessorPanelProps {
  user: UserProfile | null;
  language: LanguageCode;
  onChangeLanguage?: (lang: LanguageCode) => void;
  onRequireAuth: () => void;
  initialSubject?: string;
  initialCourseId?: number | null;
  initialCourseTitle?: string;
  initialTranslateText?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function IfiokProfessorPanel({
  user,
  language,
  onChangeLanguage,
  onRequireAuth,
  initialSubject,
  initialCourseId = null,
  initialCourseTitle,
  initialTranslateText = '',
}: IfiokProfessorPanelProps) {
  const t = TRANSLATIONS[language];
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [mode, setMode] = useState<ProfessorMode>(initialTranslateText ? 'translate' : 'tutor');
  const [subject, setSubject] = useState<string>(initialSubject || ACADEMIC_SUBJECTS[0]);
  const [chatLang, setChatLang] = useState<LanguageCode>(language);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Translator state
  const [sourceText, setSourceText] = useState(initialTranslateText);
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);

  // Practice Quiz state
  const [quizTopic, setQuizTopic] = useState('');
  const [quizCount, setQuizCount] = useState(5);
  const [quizData, setQuizData] = useState<PracticeQuizPayload | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizCitations, setQuizCitations] = useState<AiCitation[]>([]);

  // Answer Marking state
  const [markQuestion, setMarkQuestion] = useState('');
  const [markStudentAnswer, setMarkStudentAnswer] = useState('');
  const [markGuide, setMarkGuide] = useState('');
  const [markMaxScore, setMarkMaxScore] = useState(10);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [markResult, setMarkResult] = useState<{
    score: number;
    maxScore: number;
    strengths: string[];
    missingConcepts: string[];
    improvedModelAnswer: string;
    feedback: string;
  } | null>(null);

  // Document / Notes Explainer state
  const [docFileName, setDocFileName] = useState('');
  const [docMimeType, setDocMimeType] = useState('');
  const [docBase64, setDocBase64] = useState('');
  const [docRawText, setDocRawText] = useState('');
  const [docMode, setDocMode] = useState<'explain' | 'summarize' | 'quiz_from_notes'>('explain');
  const [docLoading, setDocLoading] = useState(false);
  const [docResult, setDocResult] = useState<{
    summary: string;
    explanation: string;
    keyTerms: string[];
    citations?: AiCitation[];
    extractedLength: number;
    truncated: boolean;
  } | null>(null);

  // Personalized Study Plan Recommendations state
  const [recLoading, setRecLoading] = useState(false);
  const [recData, setRecData] = useState<{
    enrolledCount: number;
    gradedSubmissionsCount: number;
    aiSessionsCount: number;
    avgGradedScore: number | null;
    focusSubjects: string[];
    rawText?: string;
    recommendations: Array<{
      title: string;
      subject: string;
      reason: string;
      actionStep: string;
    }>;
  } | null>(null);

  // Voice learning state (Web Speech API)
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  // Safety reporting modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inaccurate or inappropriate AI response');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState('');

  const canUseTeacherPrep = Boolean(
    user?.roles.some((r) => ['teacher', 'instructor', 'school_admin', 'super_admin'].includes(r))
  );

  useEffect(() => {
    setChatLang(language);
  }, [language]);

  useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    if (initialTranslateText) {
      setSourceText(initialTranslateText);
      setMode('translate');
    }
  }, [initialTranslateText]);

  const loadAiStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await apiRequest<AiProviderStatus>('/api/academy/ai/status');
      setAiStatus(res);
    } catch {
      setAiStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    try {
      const res = await apiRequest<{ sessions: SessionSummary[] }>('/api/academy/ai/sessions');
      setSessions(res.sessions);
    } catch {
      setSessions([]);
    }
  }, [user]);

  useEffect(() => {
    loadAiStatus();
    loadSessions();
  }, [loadAiStatus, loadSessions]);

  const handleLoadSession = async (sessionId: number) => {
    setErrorMsg('');
    try {
      const res = await apiRequest<{ session: SessionSummary; messages: ChatMessage[] }>(
        `/api/academy/ai/sessions/${sessionId}`
      );
      setActiveSessionId(res.session.id);
      setSubject(res.session.subject || ACADEMIC_SUBJECTS[0]);
      if (LANGUAGE_OPTIONS.some((l) => l.code === res.session.language_code)) {
        setChatLang(res.session.language_code as LanguageCode);
      }
      if (
        ['tutor', 'lesson', 'homework', 'code_stem', 'exam_prep', 'teacher_prep'].includes(res.session.mode)
      ) {
        setMode(res.session.mode as ProfessorMode);
      }
      setMessages(res.messages);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load saved tutoring session.');
    }
  };

  const handleStartNewSession = () => {
    setActiveSessionId(0);
    setMessages([]);
    setErrorMsg('');
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    const clean = prompt.trim();
    if (clean.length < 2) return;

    setErrorMsg('');
    setSending(true);
    const optimisticUser: ChatMessage = { role: 'user', content: clean };
    setMessages((prev) => [...prev, optimisticUser]);
    setPrompt('');

    try {
      const chatMode =
        mode === 'practice_quiz' ||
        mode === 'translate' ||
        mode === 'mark_answer' ||
        mode === 'explain_doc' ||
        mode === 'recommendations'
          ? 'tutor'
          : mode;
      const res = await apiRequest<{
        sessionId: number;
        reply: string;
        citations?: AiCitation[];
        provider: string;
        model: string;
      }>('/api/academy/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: clean,
          subject,
          languageCode: chatLang,
          mode: chatMode,
          sessionId: activeSessionId || undefined,
          courseId: initialCourseId || undefined,
        }),
      });
      setActiveSessionId(res.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, citations: res.citations }]);
      loadSessions();
      loadAiStatus();
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setPrompt(clean);
      setErrorMsg(err instanceof Error ? err.message : 'IFIOK Professor could not respond.');
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setErrorMsg('');
    setTranslating(true);
    setTranslatedText('');
    try {
      const res = await apiRequest<{ translatedText: string }>('/api/academy/ai/translate', {
        method: 'POST',
        body: JSON.stringify({
          text: sourceText.trim(),
          targetLanguage: chatLang,
          subject,
        }),
      });
      setTranslatedText(res.translatedText);
      loadAiStatus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Translation could not be completed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setErrorMsg('');
    setGeneratingQuiz(true);
    setQuizData(null);
    setQuizCitations([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    try {
      const res = await apiRequest<{ quiz: PracticeQuizPayload; citations?: AiCitation[] }>('/api/academy/ai/practice-quiz', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          topic: quizTopic.trim(),
          languageCode: chatLang,
          questionCount: quizCount,
        }),
      });
      setQuizData(res.quiz);
      setQuizCitations(res.citations || []);
      loadAiStatus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Practice quiz generation failed.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleMarkAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setErrorMsg('');
    setMarkingLoading(true);
    setMarkResult(null);
    try {
      const res = await apiRequest<{
        score: number;
        maxScore: number;
        strengths: string[];
        missingConcepts: string[];
        improvedModelAnswer: string;
        feedback: string;
      }>('/api/academy/ai/mark-answer', {
        method: 'POST',
        body: JSON.stringify({
          question: markQuestion.trim(),
          studentAnswer: markStudentAnswer.trim(),
          markingGuide: markGuide.trim() || undefined,
          maxScore: markMaxScore,
          subject,
          languageCode: chatLang,
        }),
      });
      setMarkResult(res);
      loadAiStatus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Answer marking failed.');
    } finally {
      setMarkingLoading(false);
    }
  };

  const handleSelectStudyDoc = async (file: File) => {
    setErrorMsg('');
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });
      setDocFileName(file.name);
      setDocMimeType(file.type || 'application/octet-stream');
      setDocBase64(base64);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to read study file.');
    }
  };

  const handleExplainDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!docBase64 && docRawText.trim().length < 20) {
      setErrorMsg('Upload a PDF/DOCX/TXT study document or paste at least 20 characters of notes.');
      return;
    }
    setErrorMsg('');
    setDocLoading(true);
    setDocResult(null);
    try {
      const res = await apiRequest<{
        summary: string;
        explanation: string;
        keyTerms: string[];
        citations?: AiCitation[];
        extractedLength: number;
        truncated: boolean;
      }>('/api/academy/ai/explain-document', {
        method: 'POST',
        body: JSON.stringify({
          fileName: docFileName || undefined,
          mimeType: docMimeType || undefined,
          dataBase64: docBase64 || undefined,
          text: docRawText.trim() || undefined,
          subject,
          languageCode: chatLang,
          mode: docMode,
        }),
      });
      setDocResult(res);
      loadAiStatus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Document analysis failed.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleLoadRecommendations = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setErrorMsg('');
    setRecLoading(true);
    try {
      const res = await apiRequest<{
        enrolledCount: number;
        gradedSubmissionsCount: number;
        aiSessionsCount: number;
        avgGradedScore: number | null;
        focusSubjects: string[];
        rawText?: string;
        recommendations: Array<{
          title: string;
          subject: string;
          reason: string;
          actionStep: string;
        }>;
      }>(`/api/academy/ai/recommendations?languageCode=${encodeURIComponent(chatLang)}`);
      setRecData(res);
      loadAiStatus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate study plan.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleToggleVoiceInput = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg('Voice dictation is not supported in this browser. Type your question directly.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = getBcp47ForLanguage(chatLang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = (ev) => {
      setErrorMsg(`Voice input notice: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const handleSpeakText = (text: string, idx: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setErrorMsg('Text-to-speech playback is not supported in this browser.');
      return;
    }
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = getBcp47ForLanguage(chatLang);
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  const handleSafetyReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest('/api/academy/ai/safety-report', {
        method: 'POST',
        body: JSON.stringify({
          contextType: 'ai_professor',
          referenceId: activeSessionId || 0,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setReportSent('Safety report logged for immediate review by IFIOK-EN Trust & Safety.');
      setReportDetails('');
      setTimeout(() => {
        setReportOpen(false);
        setReportSent('');
      }, 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit safety report.');
    }
  };

  const rtl = isRtlLanguage(chatLang);

  const modeButtons: Array<{ id: ProfessorMode; label: string }> = [
    { id: 'tutor', label: 'Interactive Tutor' },
    { id: 'lesson', label: 'Step-by-Step Lesson' },
    { id: 'homework', label: 'Homework Help' },
    { id: 'code_stem', label: 'STEM & Code Tutor' },
    { id: 'practice_quiz', label: 'Practice Quiz' },
    { id: 'mark_answer', label: 'Answer Marking' },
    { id: 'explain_doc', label: 'Notes / PDF Explainer' },
    { id: 'recommendations', label: 'My Study Plan' },
    { id: 'translate', label: 'Lesson Translator' },
    { id: 'exam_prep', label: 'Exam Prep & Study Plan' },
    ...(canUseTeacherPrep ? [{ id: 'teacher_prep' as const, label: 'Teacher Prep' }] : []),
  ];

  const quizScore = quizData
    ? quizData.questions.reduce((acc, q, idx) => (quizAnswers[idx] === q.correctIndex ? acc + 1 : acc), 0)
    : 0;

  return (
    <div className="space-y-6" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Hero Banner Identifying IFIOK PROFESSOR as AI */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 h-48 lg:h-auto bg-slate-900">
          <img
            src={professorStudioImg}
            alt="IFIOK Professor multilingual AI educational studio"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-8 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-amber-400">
                <Bot className="w-4 h-4" />
                <span>{t.professorTitle}</span>
                <span aria-hidden="true">·</span>
                <span>{t.professorAiLabel}</span>
              </div>
              <div className="text-xs font-mono">
                {statusLoading ? (
                  <span className="text-slate-500">Checking AI Provider...</span>
                ) : aiStatus?.operational ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Operational ({aiStatus.provider} · {aiStatus.model})
                  </span>
                ) : aiStatus?.configured ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Configured ({aiStatus.provider} · {aiStatus.model}) — Status: {aiStatus.lastTestedStatus}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    AI Offline (Server Credentials Not Configured)
                  </span>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-white">
              {t.professorTagline}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Clear AI disclosure: IFIOK Professor is an automated AI learning assistant supporting your studies across {ACADEMIC_SUBJECTS.length} academic subjects and {getLanguageAvailabilitySummary().fullUiLanguagesCount} verified languages alongside qualified human educators.
              {user && (user.age_group === 'under_13' || user.age_group === 'teen_13_17')
                ? ' Strict Child Protection safety filters are automatically active for your account.'
                : ''}
            </p>
            {initialCourseTitle && (
              <p className="text-xs font-mono text-purple-700 dark:text-amber-300">
                Course Context Linked: {initialCourseTitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>{t.academicTerms.subject}:</span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {ACADEMIC_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" />
                <select
                  value={chatLang}
                  onChange={(e) => {
                    const next = e.target.value as LanguageCode;
                    setChatLang(next);
                    onChangeLanguage?.(next);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeLabel} — {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Child Safety / AI Report</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Language scope: {getLanguageScopeNote(chatLang)}
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-200/70 dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {modeButtons.map((mb) => (
          <button
            key={mb.id}
            type="button"
            onClick={() => {
              setMode(mb.id);
              setErrorMsg('');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              mode === mb.id
                ? 'bg-white dark:bg-[#19284E] text-slate-950 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {mb.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-900 dark:text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      {mode === 'practice_quiz' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Interactive Practice {t.academicTerms.quiz} — {subject}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate real practice questions with instant answer checking and step-by-step explanations in {LANGUAGE_OPTIONS.find((l) => l.code === chatLang)?.nativeLabel}.
            </p>
          </div>

          <form onSubmit={handleGenerateQuiz} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium mb-1">Topic or Concept</label>
              <input
                type="text"
                required
                minLength={3}
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                placeholder="e.g. Quadratic equations, Cellular respiration, Smart contract security..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Questions</label>
              <select
                value={quizCount}
                onChange={(e) => setQuizCount(Number(e.target.value))}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={generatingQuiz}
              className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {generatingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generatingQuiz ? 'Generating...' : 'Generate Practice Quiz'}</span>
            </button>
          </form>

          {quizData && (
            <div className="space-y-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display font-bold text-slate-950 dark:text-white">{quizData.title}</h4>
                {quizSubmitted && (
                  <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Score: {quizScore} / {quizData.questions.length}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {quizData.questions.map((q, qIdx) => (
                  <div
                    key={`${q.question}-${qIdx}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4 space-y-2.5"
                  >
                    <div className="font-semibold text-sm text-slate-950 dark:text-white">
                      {qIdx + 1}. {q.question}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const chosen = quizAnswers[qIdx] === oIdx;
                        const isCorrect = q.correctIndex === oIdx;
                        let style =
                          'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D152B] text-slate-800 dark:text-slate-200';
                        if (quizSubmitted) {
                          if (isCorrect) style = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                          else if (chosen && !isCorrect) style = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200';
                        } else if (chosen) {
                          style = 'border-purple-600 dark:border-amber-500 bg-purple-50 dark:bg-amber-500/10';
                        }
                        return (
                          <button
                            key={`${qIdx}-${oIdx}`}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                            className={`text-left px-3.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${style}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                        <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!quizSubmitted ? (
                <button
                  type="button"
                  onClick={() => setQuizSubmitted(true)}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Check My Answers
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Retry Quiz
                </button>
              )}
              {quizCitations.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-500">
                  <div className="font-semibold text-purple-700 dark:text-amber-400">
                    Grounded in IFIOK SCHOOL Library:
                  </div>
                  {quizCitations.map((c) => (
                    <div key={`${c.sourceType}-${c.id}`} className="font-mono">
                      [{c.sourceType.replace('_', ' ')}] {c.title} · {c.section} · {c.author} (v{c.version})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : mode === 'translate' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-4">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Multilingual {t.academicTerms.lesson} Translator
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Translate course lessons, study notes, or questions accurately into {LANGUAGE_OPTIONS.find((l) => l.code === chatLang)?.nativeLabel} while preserving educational terminology.
            </p>
          </div>
          <form onSubmit={handleTranslate} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium">Original {t.academicTerms.lesson} Text</label>
              <textarea
                rows={7}
                required
                minLength={3}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste lesson notes, equations, definitions, or syllabus content here..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={translating}
                className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                <span>{translating ? 'Translating...' : `Translate to ${LANGUAGE_OPTIONS.find((l) => l.code === chatLang)?.label}`}</span>
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium">Translated Study Material</label>
                {translatedText && (
                  <button
                    type="button"
                    onClick={() => handleSpeakText(translatedText, 999)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-amber-400 cursor-pointer"
                  >
                    {speakingIdx === 999 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{speakingIdx === 999 ? 'Stop' : 'Listen'}</span>
                  </button>
                )}
              </div>
              <div className="min-h-[185px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {translatedText || 'Translation output will appear here once submitted.'}
              </div>
            </div>
          </form>
        </div>
      ) : mode === 'mark_answer' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              AI Answer Marking & Rubric Feedback — {subject}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit an exam or homework question together with your written response to receive structured scoring, strengths, missing concepts, and a model answer.
            </p>
          </div>
          <form onSubmit={handleMarkAnswer} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium mb-1">Question</label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={markQuestion}
                  onChange={(e) => setMarkQuestion(e.target.value)}
                  placeholder="Enter the exact question being answered..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Max Score</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={markMaxScore}
                  onChange={(e) => setMarkMaxScore(Number(e.target.value) || 10)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Student Answer</label>
              <textarea
                rows={4}
                required
                minLength={5}
                value={markStudentAnswer}
                onChange={(e) => setMarkStudentAnswer(e.target.value)}
                placeholder="Write or paste your full answer here..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Marking Guide / Rubric (Optional)</label>
              <input
                type="text"
                value={markGuide}
                onChange={(e) => setMarkGuide(e.target.value)}
                placeholder="Key formula, terminology, or rubric points expected..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={markingLoading}
              className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {markingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{markingLoading ? 'Evaluating Answer...' : 'Mark My Answer'}</span>
            </button>
          </form>

          {markResult && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-slate-950 dark:text-white">
                  Evaluation Feedback
                </span>
                <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {markResult.score} / {markResult.maxScore}
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{markResult.feedback}</p>
              {markResult.strengths.length > 0 && (
                <div>
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Strengths</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-200">
                    {markResult.strengths.map((s, i) => (
                      <li key={`str-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {markResult.missingConcepts.length > 0 && (
                <div>
                  <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Concepts to Strengthen</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-200">
                    {markResult.missingConcepts.map((m, i) => (
                      <li key={`mis-${i}`}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {markResult.improvedModelAnswer && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] p-3">
                  <div className="font-semibold mb-1 text-slate-900 dark:text-white">Model Answer</div>
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{markResult.improvedModelAnswer}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : mode === 'explain_doc' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Notes, PDF & Document Explainer — {subject}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a study PDF, DOCX, TXT, or Markdown file (or paste your study notes) so IFIOK Professor can explain concepts, summarize chapters, or build practice questions from your document.
            </p>
          </div>
          <form onSubmit={handleExplainDoc} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Upload Study Document (PDF, DOCX, TXT, MD)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectStudyDoc(f);
                  }}
                  className="text-xs"
                />
                {docFileName && (
                  <div className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    Loaded: {docFileName}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Analysis Mode</label>
                <select
                  value={docMode}
                  onChange={(e) => setDocMode(e.target.value as typeof docMode)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-xs"
                >
                  <option value="explain">Explain Concepts Simply</option>
                  <option value="summarize">Structured Revision Summary</option>
                  <option value="quiz_from_notes">Generate Questions from Notes</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Or Paste Study Notes Directly</label>
              <textarea
                rows={4}
                value={docRawText}
                onChange={(e) => setDocRawText(e.target.value)}
                placeholder="Paste lecture notes or textbook excerpts..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={docLoading}
              className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{docLoading ? 'Analyzing Document...' : 'Analyze with IFIOK Professor'}</span>
            </button>
          </form>

          {docResult && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-sm text-slate-950 dark:text-white">Summary & Explanation</span>
                <button
                  type="button"
                  onClick={() => handleSpeakText(`${docResult.summary}\n\n${docResult.explanation}`, 998)}
                  className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-amber-400 cursor-pointer"
                >
                  {speakingIdx === 998 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{speakingIdx === 998 ? 'Stop' : 'Listen'}</span>
                </button>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">{docResult.summary}</p>
              <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200 leading-relaxed">{docResult.explanation}</p>
              {docResult.keyTerms.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-semibold">Key Terms:</span> {docResult.keyTerms.join(', ')}
                </div>
              )}
              {docResult.citations && docResult.citations.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-500">
                  <div className="font-semibold text-purple-700 dark:text-amber-400">
                    Referenced IFIOK SCHOOL Curriculum Sources:
                  </div>
                  {docResult.citations.map((c) => (
                    <div key={`${c.sourceType}-${c.id}`} className="font-mono">
                      [{c.sourceType.replace('_', ' ')}] {c.title} · {c.section} · {c.author}
                    </div>
                  ))}
                </div>
              )}
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                Extracted {docResult.extractedLength} characters{docResult.truncated ? ' (truncated to context limit)' : ''}
              </div>
            </div>
          )}
        </div>
      ) : mode === 'recommendations' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                Personalized Learning Path & Study Plan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generated strictly from your actual IFIOK SCHOOL course enrolments, graded school submissions, and IFIOK Professor sessions.
              </p>
            </div>
            <button
              type="button"
              disabled={recLoading}
              onClick={handleLoadRecommendations}
              className="px-5 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {recLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{recLoading ? 'Building Study Plan...' : 'Generate My Study Plan'}</span>
            </button>
          </div>

          {recData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono font-bold text-lg tabular-nums">{recData.enrolledCount}</div>
                  <div className="text-slate-500">Enrolled Courses</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono font-bold text-lg tabular-nums">{recData.gradedSubmissionsCount}</div>
                  <div className="text-slate-500">Graded Assessments</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono font-bold text-lg tabular-nums">{recData.aiSessionsCount}</div>
                  <div className="text-slate-500">Tutoring Sessions</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#081024] p-3 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono font-bold text-lg tabular-nums">
                    {recData.avgGradedScore !== null ? `${recData.avgGradedScore}%` : '—'}
                  </div>
                  <div className="text-slate-500">Average Graded Score</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recData.recommendations.map((rec, idx) => (
                  <div
                    key={`${rec.title}-${idx}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081024] p-4 space-y-2 text-xs"
                  >
                    <div className="font-mono text-purple-700 dark:text-amber-400 font-semibold">{rec.subject}</div>
                    <div className="font-display font-bold text-sm text-slate-950 dark:text-white">{rec.title}</div>
                    <p className="text-slate-600 dark:text-slate-300">{rec.reason}</p>
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100">
                      Next Action: {rec.actionStep}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Click "Generate My Study Plan" above to analyze your verified learning telemetry.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Session History Sidebar */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-slate-950 dark:text-white">Study Sessions</h3>
              <button
                type="button"
                onClick={handleStartNewSession}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-amber-400 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
            </div>
            {!user ? (
              <p className="text-xs text-slate-500">Sign in to save study sessions and track tutoring history.</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-500">No saved sessions yet. Ask a question to begin.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleLoadSession(s.id)}
                    className={`w-full text-left py-2.5 px-2 rounded-lg transition-colors cursor-pointer ${
                      activeSessionId === s.id ? 'bg-slate-100 dark:bg-slate-800/80' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{s.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {s.subject} · {s.language_code.toUpperCase()} · {s.mode.replace('_', ' ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Tutoring Thread */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D152B] flex flex-col min-h-[460px]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Mode: <strong className="text-slate-900 dark:text-white capitalize">{mode.replace('_', ' ')}</strong> · {subject}
              </span>
              <span className="font-mono">AI Educational Assistant</span>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[460px]">
              {messages.length === 0 ? (
                <div className="py-10 text-center space-y-3 max-w-lg mx-auto">
                  <Bot className="w-8 h-8 text-purple-700 dark:text-amber-400 mx-auto" />
                  <h4 className="font-display font-bold text-slate-950 dark:text-white">
                    Ask IFIOK Professor anything in {subject}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Request step-by-step derivations, clear conceptual lessons, homework hints (without giving away answers blindly), exam revision plans, or voice read-aloud in your chosen language.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {[
                      `Teach me core foundations of ${subject} step by step.`,
                      `Give me 3 real-world examples explaining ${subject}.`,
                      `Create a weekly study plan for ${subject} exam prep.`,
                    ].map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setPrompt(starter)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed space-y-2 ${
                        m.role === 'user'
                          ? 'bg-[#0E1A36] text-white dark:bg-amber-500 dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-[#081024] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[11px] opacity-75 font-mono">
                        <span>{m.role === 'user' ? 'You' : 'IFIOK Professor (AI)'}</span>
                        {m.role === 'assistant' && (
                          <button
                            type="button"
                            onClick={() => handleSpeakText(m.content, idx)}
                            className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            {speakingIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            <span>{speakingIdx === idx ? 'Stop' : 'Listen'}</span>
                          </button>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="font-semibold text-purple-700 dark:text-amber-400">
                            Grounded in IFIOK SCHOOL Library:
                          </div>
                          {m.citations.map((c) => (
                            <div key={`${c.sourceType}-${c.id}`} className="font-mono">
                              • {c.title} · {c.section} · {c.author} (v{c.version})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-4 py-3 bg-slate-100 dark:bg-[#081024] border border-slate-200 dark:border-slate-800 text-xs text-slate-500 inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>IFIOK Professor is preparing your explanation...</span>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2"
            >
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                title="Voice input (Web Speech API)"
                className={`p-2.5 rounded-lg border cursor-pointer shrink-0 ${
                  listening
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat(e);
                  }
                }}
                placeholder={
                  user
                    ? `Ask a ${subject} question or paste homework problem...`
                    : 'Sign in to start an interactive session with IFIOK Professor...'
                }
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3.5 py-2 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2.5 rounded-lg bg-[#0E1A36] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Ask AI</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Child Safety & AI Concern Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D152B] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 dark:text-white">
                Report Child Safety or AI Concern
              </h3>
              <button type="button" onClick={() => setReportOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {reportSent ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                {reportSent}
              </div>
            ) : (
              <form onSubmit={handleSafetyReportSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Reason</label>
                  <input
                    type="text"
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Details (min. 10 characters)</label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe the concern or message content for Trust & Safety review..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#081024] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Submit Safety Report
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
