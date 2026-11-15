import { GoogleGenAI, Type } from '@google/genai';
import { db, getSettingsMap } from '../db.ts';
import { createSecurityAlert, recordSecurityEvent } from '../middleware/auth.ts';

export type AiProviderKind = 'gemini' | 'openai_compatible';

export interface AiLanguageSpec {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  tier: 'initial' | 'expandable';
}

export const SUPPORTED_AI_LANGUAGES: AiLanguageSpec[] = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, tier: 'initial' },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, tier: 'initial' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, tier: 'initial' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false, tier: 'initial' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, tier: 'initial' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', rtl: false, tier: 'initial' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', rtl: false, tier: 'initial' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', rtl: false, tier: 'initial' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', rtl: false, tier: 'initial' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', rtl: false, tier: 'initial' },
  // Expandable global languages
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, tier: 'expandable' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false, tier: 'expandable' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, tier: 'expandable' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, tier: 'expandable' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, tier: 'expandable' },
];

export const ACADEMIC_SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Biology',
  'Chemistry',
  'Physics',
  'Computer Science',
  'Programming',
  'Artificial Intelligence',
  'Business Studies',
  'Accounting',
  'Economics',
  'Entrepreneurship',
  'Digital Marketing',
  'Financial Literacy',
  'Web3 and Blockchain',
  'Professional Development',
] as const;

const SAFETY_BLOCK_PATTERNS = [
  /\b(suicide|self[- ]?harm|kill\s+myself|end\s+my\s+life)\b/i,
  /\b(child\s+porn|csam|sexual\s+exploitation|nude\s+minor)\b/i,
  /\b(how\s+to\s+(build|make|create)\s+(a\s+)?(bomb|explosives?|weapon)|make\s+explosives|ricin|sarin)\b/i,
  /\b(bypass\s+safety|ignore\s+all\s+previous\s+instructions|jailbreak)\b/i,
];

const MINOR_RESTRICTED_PATTERNS = [
  /\b(erotic|porn|explicit\s+sex|nsfw|gambling|betting\s+odds|recreational\s+drugs)\b/i,
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getOpenAiCompatConfig() {
  const apiKey = process.env.OPENAI_COMPAT_API_KEY?.trim() || '';
  const baseUrl = (process.env.OPENAI_COMPAT_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.OPENAI_COMPAT_MODEL?.trim() || 'gpt-4o-mini';
  return {
    configured: apiKey.length >= 10,
    apiKey,
    baseUrl,
    model,
  };
}

export function getAiProviderStatus() {
  const settings = getSettingsMap();
  const provider = (settings.ai_provider === 'openai_compatible' ? 'openai_compatible' : 'gemini') as AiProviderKind;
  const geminiReady = Boolean(getGeminiClient());
  const compatCfg = getOpenAiCompatConfig();
  const configured = provider === 'gemini' ? geminiReady : compatCfg.configured;
  const activeModel =
    provider === 'gemini'
      ? settings.ai_model || 'gemini-4-hydrogen'
      : compatCfg.model;

  const lastTestedStatus = settings.ai_last_verified_status || 'untested';
  const operational = configured && lastTestedStatus === 'operational';

  const monthlyCostRow = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost_usd), 0) as totalCost,
           COUNT(*) as totalCalls
    FROM ai_usage_logs
    WHERE created_at >= datetime('now', 'start of month')
  `).get() as { totalCost: number; totalCalls: number };

  return {
    provider,
    model: activeModel,
    configured,
    operational,
    lastTestedStatus,
    lastTestedAt: settings.ai_last_verified_at || null,
    dailyUserLimit: Number(settings.ai_daily_user_limit || 40),
    monthlyCostCapUsd: Number(settings.ai_monthly_cost_cap_usd || 50),
    monthlyEstimatedCostUsd: Number(monthlyCostRow.totalCost.toFixed(4)),
    monthlyCallsCount: monthlyCostRow.totalCalls,
    childSafetyMode: settings.ai_child_safety_mode || 'strict',
    availableProviders: [
      { id: 'gemini', label: 'Google Gemini (Server Secret)', configured: geminiReady, defaultModel: 'gemini-4-hydrogen' },
      { id: 'openai_compatible', label: 'OpenAI-Compatible Server Endpoint', configured: compatCfg.configured, defaultModel: compatCfg.model },
    ],
    supportedLanguages: SUPPORTED_AI_LANGUAGES,
  };
}

function saveTestStatus(status: 'operational' | 'error' | 'untested') {
  const upsert = db.prepare(`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  upsert.run('ai_last_verified_status', status);
  upsert.run('ai_last_verified_at', new Date().toISOString());
}

export async function testAiProviderConnection(): Promise<{
  ok: boolean;
  provider: AiProviderKind;
  model: string;
  latencyMs: number;
  message: string;
}> {
  const status = getAiProviderStatus();
  const start = Date.now();

  if (!status.configured) {
    saveTestStatus('error');
    return {
      ok: false,
      provider: status.provider,
      model: status.model,
      latencyMs: Date.now() - start,
      message:
        status.provider === 'gemini'
          ? 'Server environment variable GEMINI_API_KEY is missing or unconfigured. Add it in platform secrets.'
          : 'Server environment variable OPENAI_COMPAT_API_KEY is missing or unconfigured.',
    };
  }

  try {
    if (status.provider === 'gemini') {
      const ai = getGeminiClient()!;
      const allowedGeminiModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
      const modelName = allowedGeminiModels.has(status.model) ? status.model : 'gemini-4-hydrogen';
      const resp = await ai.models.generateContent({
        model: modelName,
        contents: 'Confirm readiness in one short sentence as IFIOK Professor, an AI educational assistant.',
        config: {
          systemInstruction: 'Respond clearly and concisely in under 20 words.',
        },
      });
      const text = resp.text?.trim() || '';
      if (!text) throw new Error('Empty response received from Gemini API.');
      saveTestStatus('operational');
      return {
        ok: true,
        provider: 'gemini',
        model: modelName,
        latencyMs: Date.now() - start,
        message: text,
      };
    }

    const compat = getOpenAiCompatConfig();
    const res = await fetch(`${compat.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${compat.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: compat.model,
        messages: [
          { role: 'system', content: 'Respond in under 20 words.' },
          { role: 'user', content: 'Confirm readiness as IFIOK Professor AI educational assistant.' },
        ],
        max_tokens: 64,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Provider HTTP ${res.status}: ${errText.slice(0, 180)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('Empty response received from OpenAI-compatible provider.');
    saveTestStatus('operational');
    return {
      ok: true,
      provider: 'openai_compatible',
      model: compat.model,
      latencyMs: Date.now() - start,
      message: text,
    };
  } catch (err) {
    saveTestStatus('error');
    return {
      ok: false,
      provider: status.provider,
      model: status.model,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'AI provider connectivity test failed.',
    };
  }
}

export interface ProfessorRequestInput {
  userId: number;
  schoolId?: number | null;
  ageGroup: string;
  educationLevel: string;
  guardianConsentVerified: number;
  languageCode: string;
  subject: string;
  mode: string;
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  courseContext?: string;
}

export interface ProfessorResponseOutput {
  reply: string;
  provider: AiProviderKind;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}

function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  // Conservative informational estimate ($0.10 / 1M input, $0.40 / 1M output)
  return Number((((promptTokens / 1_000_000) * 0.1) + ((completionTokens / 1_000_000) * 0.4)).toFixed(6));
}

function buildLanguageName(code: string): string {
  const found = SUPPORTED_AI_LANGUAGES.find((l) => l.code === code);
  return found ? `${found.name} (${found.nativeName})` : 'English';
}

function enforceGuardsAndSafety(input: ProfessorRequestInput) {
  const settings = getSettingsMap();
  const dailyLimit = Math.max(1, Number(settings.ai_daily_user_limit || 40));
  const monthlyCap = Math.max(1, Number(settings.ai_monthly_cost_cap_usd || 50));
  const isMinor = input.ageGroup === 'under_13' || input.ageGroup === 'teen_13_17';

  if (input.ageGroup === 'under_13' && !input.guardianConsentVerified) {
    throw new AiGuardError(
      403,
      'blocked_safety',
      'Child protection policy: Learners under 13 require verified parent/guardian consent or school-managed authorization before using IFIOK Professor.'
    );
  }

  for (const pat of SAFETY_BLOCK_PATTERNS) {
    if (pat.test(input.prompt)) {
      recordSecurityEvent(
        'ai_safety_blocked',
        'warning',
        input.userId,
        '',
        `Blocked unsafe prompt pattern for user #${input.userId} (${input.ageGroup})`
      );
      throw new AiGuardError(
        400,
        'blocked_safety',
        'This request cannot be processed under IFIOK SCHOOL child protection and educational safety policies.'
      );
    }
  }

  if (isMinor) {
    for (const pat of MINOR_RESTRICTED_PATTERNS) {
      if (pat.test(input.prompt)) {
        createSecurityAlert(
          'minor_ai_restriction_triggered',
          'warning',
          input.userId,
          '',
          `Minor learner (#${input.userId}, ${input.ageGroup}) triggered age-restricted AI filter.`
        );
        throw new AiGuardError(
          400,
          'blocked_safety',
          'Age-appropriate learning filter: This topic is restricted for younger learners. Ask an academic question or contact your teacher/guardian.'
        );
      }
    }
  }

  const todayCount = db.prepare(`
    SELECT COUNT(*) as c FROM ai_usage_logs
    WHERE user_id = ? AND status = 'success' AND created_at > datetime('now', '-24 hours')
  `).get(input.userId) as { c: number };

  if (todayCount.c >= dailyLimit) {
    throw new AiGuardError(
      429,
      'rate_limited',
      `Daily IFIOK Professor usage limit (${dailyLimit} interactions / 24h) reached. Please review your saved study notes or try again later.`
    );
  }

  const monthlyCost = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost_usd), 0) as s FROM ai_usage_logs
    WHERE created_at >= datetime('now', 'start of month')
  `).get() as { s: number };

  if (monthlyCost.s >= monthlyCap) {
    throw new AiGuardError(
      503,
      'rate_limited',
      'Platform monthly AI budget cap has been reached. Administrators can review capacity in AI Governance.'
    );
  }
}

export class AiGuardError extends Error {
  statusCode: number;
  logStatus: 'blocked_safety' | 'rate_limited' | 'provider_error';
  constructor(statusCode: number, logStatus: 'blocked_safety' | 'rate_limited' | 'provider_error', message: string) {
    super(message);
    this.statusCode = statusCode;
    this.logStatus = logStatus;
  }
}

function logAiUsage(params: {
  userId: number;
  schoolId?: number | null;
  provider: string;
  model: string;
  feature: string;
  languageCode: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: 'success' | 'blocked_safety' | 'rate_limited' | 'provider_error';
}) {
  db.prepare(`
    INSERT INTO ai_usage_logs (
      user_id, school_id, provider, model, feature, language_code,
      prompt_tokens, completion_tokens, estimated_cost_usd, latency_ms, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.userId,
    params.schoolId ?? null,
    params.provider,
    params.model,
    params.feature,
    params.languageCode,
    params.promptTokens,
    params.completionTokens,
    params.estimatedCostUsd,
    params.latencyMs,
    params.status
  );
}

export async function runProfessorCompletion(input: ProfessorRequestInput): Promise<ProfessorResponseOutput> {
  const status = getAiProviderStatus();
  const start = Date.now();

  try {
    enforceGuardsAndSafety(input);
  } catch (err) {
    if (err instanceof AiGuardError) {
      logAiUsage({
        userId: input.userId,
        schoolId: input.schoolId,
        provider: status.provider,
        model: status.model,
        feature: input.mode,
        languageCode: input.languageCode,
        promptTokens: Math.ceil(input.prompt.length / 4),
        completionTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - start,
        status: err.logStatus,
      });
    }
    throw err;
  }

  if (!status.configured) {
    throw new AiGuardError(
      503,
      'provider_error',
      'IFIOK Professor is not connected yet because server-side AI credentials are not configured. Contact the platform administrator.'
    );
  }

  const languageName = buildLanguageName(input.languageCode);
  const isMinor = input.ageGroup === 'under_13' || input.ageGroup === 'teen_13_17';

  const systemInstruction = [
    'You are IFIOK Professor ("Your Personal Global Learning Assistant"), an AI educational assistant built inside IFIOK SCHOOL — Global Digital Learning (part of IFIOK-EN).',
    'IDENTITY RULE: Always remain clearly identified as an AI educational assistant — never claim to be a human professor, licensed institution, or accredited university.',
    `RESPONSE LANGUAGE: Respond strictly in ${languageName} using accurate educational terminology appropriate for that language.`,
    `SUBJECT & LEARNER LEVEL: Subject = ${input.subject || 'General Studies'}; Education Level = ${input.educationLevel || 'undergraduate'}; Mode = ${input.mode}.`,
    isMinor
      ? 'CHILD SAFETY RULE: The learner is a minor. Keep all language strictly age-appropriate, encouraging, safe, and focused purely on academics. Never provide harmful, adult, or unmoderated advice; remind them teachers or guardians support their progress.'
      : 'ACADEMIC INTEGRITY: Guide students step-by-step so they understand underlying principles rather than blindly completing graded work without explanation. Recommend 2-3 logical next study topics at the end when helpful.',
    input.courseContext ? `VERIFIED LESSON CONTEXT:\n${input.courseContext.slice(0, 2500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    let reply = '';
    let promptTokens = Math.ceil((systemInstruction.length + input.prompt.length) / 4);
    let completionTokens = 0;
    let modelUsed = status.model;

    if (status.provider === 'gemini') {
      const ai = getGeminiClient()!;
      const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
      modelUsed = allowedModels.has(status.model) ? status.model : 'gemini-4-hydrogen';

      const historyText = (input.history || [])
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Student' : 'IFIOK Professor (AI)'}: ${m.content}`)
        .join('\n');

      const combinedPrompt = historyText
        ? `Previous conversation context:\n${historyText}\n\nCurrent request:\n${input.prompt}`
        : input.prompt;

      const resp = await ai.models.generateContent({
        model: modelUsed,
        contents: combinedPrompt,
        config: { systemInstruction },
      });
      reply = resp.text?.trim() || '';
      if (!reply) throw new Error('AI provider returned an empty educational response.');
      if (resp.usageMetadata) {
        promptTokens = resp.usageMetadata.promptTokenCount ?? promptTokens;
        completionTokens = resp.usageMetadata.candidatesTokenCount ?? Math.ceil(reply.length / 4);
      } else {
        completionTokens = Math.ceil(reply.length / 4);
      }
      saveTestStatus('operational');
    } else {
      const compat = getOpenAiCompatConfig();
      modelUsed = compat.model;
      const messages = [
        { role: 'system', content: systemInstruction },
        ...(input.history || []).slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: input.prompt },
      ];
      const res = await fetch(`${compat.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${compat.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelUsed, messages }),
      });
      if (!res.ok) {
        throw new Error(`AI provider returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      reply = data.choices?.[0]?.message?.content?.trim() || '';
      if (!reply) throw new Error('OpenAI-compatible provider returned an empty response.');
      promptTokens = data.usage?.prompt_tokens ?? promptTokens;
      completionTokens = data.usage?.completion_tokens ?? Math.ceil(reply.length / 4);
      saveTestStatus('operational');
    }

    const cost = estimateCostUsd(promptTokens, completionTokens);
    const latencyMs = Date.now() - start;

    logAiUsage({
      userId: input.userId,
      schoolId: input.schoolId,
      provider: status.provider,
      model: modelUsed,
      feature: input.mode,
      languageCode: input.languageCode,
      promptTokens,
      completionTokens,
      estimatedCostUsd: cost,
      latencyMs,
      status: 'success',
    });

    return {
      reply,
      provider: status.provider,
      model: modelUsed,
      promptTokens,
      completionTokens,
      estimatedCostUsd: cost,
      latencyMs,
    };
  } catch (err) {
    logAiUsage({
      userId: input.userId,
      schoolId: input.schoolId,
      provider: status.provider,
      model: status.model,
      feature: input.mode,
      languageCode: input.languageCode,
      promptTokens: Math.ceil(input.prompt.length / 4),
      completionTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - start,
      status: 'provider_error',
    });
    if (err instanceof AiGuardError) throw err;
    throw new AiGuardError(
      502,
      'provider_error',
      err instanceof Error ? err.message : 'Unable to complete AI educational request.'
    );
  }
}

export async function generateStructuredPracticeQuiz(params: {
  userId: number;
  ageGroup: string;
  educationLevel: string;
  guardianConsentVerified: number;
  languageCode: string;
  subject: string;
  topic: string;
  questionCount?: number;
}) {
  const status = getAiProviderStatus();
  const start = Date.now();
  const count = Math.max(3, Math.min(8, Number(params.questionCount) || 5));

  enforceGuardsAndSafety({
    userId: params.userId,
    ageGroup: params.ageGroup,
    educationLevel: params.educationLevel,
    guardianConsentVerified: params.guardianConsentVerified,
    languageCode: params.languageCode,
    subject: params.subject,
    mode: 'practice_quiz',
    prompt: `Generate quiz on ${params.subject}: ${params.topic}`,
  });

  if (!status.configured) {
    throw new AiGuardError(
      503,
      'provider_error',
      'IFIOK Professor is not connected yet because server-side AI credentials are not configured.'
    );
  }

  const languageName = buildLanguageName(params.languageCode);

  if (status.provider === 'gemini') {
    const ai = getGeminiClient()!;
    const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
    const modelUsed = allowedModels.has(status.model) ? status.model : 'gemini-4-hydrogen';

    const resp = await ai.models.generateContent({
      model: modelUsed,
      contents: `Create ${count} educational practice multiple-choice questions on Subject "${params.subject}", Topic "${params.topic}", for level "${params.educationLevel}" in language "${languageName}". Include clear explanations and 2 next-study recommendations.`,
      config: {
        systemInstruction:
          'You are IFIOK Professor (AI learning assistant). Output strictly accurate, age-appropriate educational questions with 4 options each (indices 0-3).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctIndex', 'explanation'],
              },
            },
            studyRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'questions', 'studyRecommendations'],
        },
      },
    });

    const jsonStr = (resp.text || '').trim();
    if (!jsonStr) throw new AiGuardError(502, 'provider_error', 'AI quiz generator returned empty output.');
    const parsed = JSON.parse(jsonStr);
    const pt = resp.usageMetadata?.promptTokenCount ?? 250;
    const ct = resp.usageMetadata?.candidatesTokenCount ?? 450;
    saveTestStatus('operational');
    logAiUsage({
      userId: params.userId,
      provider: 'gemini',
      model: modelUsed,
      feature: 'practice_quiz',
      languageCode: params.languageCode,
      promptTokens: pt,
      completionTokens: ct,
      estimatedCostUsd: estimateCostUsd(pt, ct),
      latencyMs: Date.now() - start,
      status: 'success',
    });
    return parsed;
  }

  // Fallback structured JSON prompt for OpenAI-compatible providers
  const out = await runProfessorCompletion({
    userId: params.userId,
    ageGroup: params.ageGroup,
    educationLevel: params.educationLevel,
    guardianConsentVerified: params.guardianConsentVerified,
    languageCode: params.languageCode,
    subject: params.subject,
    mode: 'practice_quiz',
    prompt: `Return ONLY raw valid JSON (no markdown) with schema {"title": string, "questions": [{"question": string, "options": [string,string,string,string], "correctIndex": number, "explanation": string}], "studyRecommendations": [string]}. Create ${count} questions on "${params.topic}".`,
  });

  const clean = out.reply.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(clean);
}
