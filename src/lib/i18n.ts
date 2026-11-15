import type { CurrencyCode, LanguageCode } from '../types/platform.ts';

export const COUNTRIES = [
  'Global',
  'Nigeria',
  'United Kingdom',
  'United States',
  'Canada',
  'Germany',
  'France',
  'Spain',
  'Brazil',
  'Singapore',
  'India',
  'Kenya',
  'Tanzania',
  'South Africa',
  'Ghana',
  'Egypt',
  'Saudi Arabia',
  'United Arab Emirates',
  'China',
  'Japan',
  'South Korea',
  'Australia',
  'Philippines',
  'Indonesia',
];

export const PHONE_CODES = [
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+234', label: 'NG (+234)' },
  { code: '+254', label: 'KE (+254)' },
  { code: '+255', label: 'TZ (+255)' },
  { code: '+233', label: 'GH (+233)' },
  { code: '+27', label: 'ZA (+27)' },
  { code: '+20', label: 'EG (+20)' },
  { code: '+966', label: 'SA (+966)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+34', label: 'ES (+34)' },
  { code: '+55', label: 'BR (+55)' },
  { code: '+86', label: 'CN (+86)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+91', label: 'IN (+91)' },
  { code: '+81', label: 'JP (+81)' },
  { code: '+82', label: 'KR (+82)' },
  { code: '+63', label: 'PH (+63)' },
  { code: '+62', label: 'ID (+62)' },
  { code: '+61', label: 'AU (+61)' },
];

export const TIMEZONES = [
  'UTC',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Manila',
  'Australia/Sydney',
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

export const EDUCATION_LEVELS = [
  { value: 'primary', label: 'Primary / Elementary' },
  { value: 'secondary', label: 'Secondary / Middle School' },
  { value: 'high_school', label: 'High School / Senior Secondary' },
  { value: 'undergraduate', label: 'Undergraduate / College' },
  { value: 'graduate', label: 'Graduate / Postgraduate' },
  { value: 'professional', label: 'Professional / Executive' },
];

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  bcp47: string;
  rtl: boolean;
  tier: 'initial' | 'expandable';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', bcp47: 'en-US', rtl: false, tier: 'initial' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', bcp47: 'fr-FR', rtl: false, tier: 'initial' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', bcp47: 'es-ES', rtl: false, tier: 'initial' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', bcp47: 'pt-BR', rtl: false, tier: 'initial' },
  { code: 'ar', label: 'Arabic (RTL)', nativeLabel: 'العربية', bcp47: 'ar-SA', rtl: true, tier: 'initial' },
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '中文 (简体)', bcp47: 'zh-CN', rtl: false, tier: 'initial' },
  { code: 'yo', label: 'Yoruba', nativeLabel: 'Yorùbá', bcp47: 'yo-NG', rtl: false, tier: 'initial' },
  { code: 'ha', label: 'Hausa', nativeLabel: 'Hausa', bcp47: 'ha-NG', rtl: false, tier: 'initial' },
  { code: 'ig', label: 'Igbo', nativeLabel: 'Igbo', bcp47: 'ig-NG', rtl: false, tier: 'initial' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', bcp47: 'sw-KE', rtl: false, tier: 'initial' },
  { code: 'de', label: 'German (Ready)', nativeLabel: 'Deutsch', bcp47: 'de-DE', rtl: false, tier: 'expandable' },
  { code: 'hi', label: 'Hindi (Ready)', nativeLabel: 'हिन्दी', bcp47: 'hi-IN', rtl: false, tier: 'expandable' },
  { code: 'ja', label: 'Japanese (Ready)', nativeLabel: '日本語', bcp47: 'ja-JP', rtl: false, tier: 'expandable' },
  { code: 'ko', label: 'Korean (Ready)', nativeLabel: '한국어', bcp47: 'ko-KR', rtl: false, tier: 'expandable' },
  { code: 'ru', label: 'Russian (Ready)', nativeLabel: 'Русский', bcp47: 'ru-RU', rtl: false, tier: 'expandable' },
];

export function isRtlLanguage(code: LanguageCode): boolean {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.rtl ?? false;
}

export function getBcp47ForLanguage(code: LanguageCode): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.bcp47 ?? 'en-US';
}

export function detectInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('ifiok_lang');
  if (saved && LANGUAGE_OPTIONS.some((l) => l.code === saved)) {
    return saved as LanguageCode;
  }
  const nav = (navigator.language || 'en').toLowerCase().split('-')[0];
  const matched = LANGUAGE_OPTIONS.find((l) => l.code === nav);
  return matched ? matched.code : 'en';
}

const REFERENCE_FX_PER_USD: Record<CurrencyCode, { symbol: string; mult: number }> = {
  PI: { symbol: 'π', mult: 1 },
  USD: { symbol: '$', mult: 1 },
  EUR: { symbol: '€', mult: 0.92 },
  GBP: { symbol: '£', mult: 0.79 },
  NGN: { symbol: '₦', mult: 1580 },
};

export function formatPiPrice(
  amountPi: number,
  displayCurrency: CurrencyCode,
  informationalUsdPerPi = 1.0
): { primary: string; reference: string | null } {
  const formattedPi = `${Number(amountPi).toLocaleString(undefined, {
    minimumFractionDigits: amountPi % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} π`;

  if (displayCurrency === 'PI') {
    return { primary: formattedPi, reference: null };
  }
  const fx = REFERENCE_FX_PER_USD[displayCurrency];
  const refAmount = amountPi * informationalUsdPerPi * fx.mult;
  return {
    primary: formattedPi,
    reference: `≈ ${fx.symbol}${refAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${displayCurrency} (info)`,
  };
}

export interface UiDictionary {
  slogan: string;
  joinBtn: string;
  exploreBtn: string;
  navDivisions: string;
  navAcademy: string;
  navBusiness: string;
  navMarket: string;
  navOpportunities: string;
  professorTitle: string;
  professorTagline: string;
  professorAiLabel: string;
  schoolDivisionName: string;
  schoolDivisionTagline: string;
  schoolPortalTitle: string;
  virtualClassroomTitle: string;
  certificatesTitle: string;
  academicTerms: {
    subject: string;
    lesson: string;
    quiz: string;
    exam: string;
    homework: string;
    grade: string;
    attendance: string;
    certificate: string;
  };
}

const EN_DICT: UiDictionary = {
  slogan: 'Empower. Connect. Earn. Grow.',
  joinBtn: 'Join IFIOK-EN',
  exploreBtn: 'Explore Our Services',
  navDivisions: 'Divisions',
  navAcademy: 'IFIOK SCHOOL',
  navBusiness: 'Business Hub',
  navMarket: 'Market',
  navOpportunities: 'Opportunities',
  professorTitle: 'IFIOK PROFESSOR',
  professorTagline: 'Your Personal Global Learning Assistant',
  professorAiLabel: 'AI Educational Assistant',
  schoolDivisionName: 'IFIOK SCHOOL — Global Digital Learning',
  schoolDivisionTagline: 'Learn Without Borders. Grow Without Limits.',
  schoolPortalTitle: 'IFIOK School Administration Portal',
  virtualClassroomTitle: 'Virtual Classroom',
  certificatesTitle: 'Certificates',
  academicTerms: {
    subject: 'Subject',
    lesson: 'Lesson',
    quiz: 'Quiz',
    exam: 'Examination',
    homework: 'Homework',
    grade: 'Grade',
    attendance: 'Attendance',
    certificate: 'Certificate',
  },
};

export const TRANSLATIONS: Record<LanguageCode, UiDictionary> = {
  en: EN_DICT,
  fr: {
    slogan: 'Autonomiser. Connecter. Gagner. Grandir.',
    joinBtn: 'Rejoindre IFIOK-EN',
    exploreBtn: 'Explorer nos services',
    navDivisions: 'Divisions',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Pôle Entreprises',
    navMarket: 'Marché',
    navOpportunities: 'Opportunités',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Votre Assistant Personnel d’Apprentissage Mondial',
    professorAiLabel: 'Assistant Éducatif IA',
    schoolDivisionName: 'IFIOK SCHOOL — Apprentissage Numérique Mondial',
    schoolDivisionTagline: 'Apprendre sans frontières. Grandir sans limites.',
    schoolPortalTitle: 'Portail d’Administration Scolaire IFIOK',
    virtualClassroomTitle: 'Classe Virtuelle',
    certificatesTitle: 'Certificats',
    academicTerms: {
      subject: 'Matière',
      lesson: 'Leçon',
      quiz: 'Quiz',
      exam: 'Examen',
      homework: 'Devoir',
      grade: 'Note',
      attendance: 'Assiduité',
      certificate: 'Certificat',
    },
  },
  es: {
    slogan: 'Empoderar. Conectar. Ganar. Crecer.',
    joinBtn: 'Únete a IFIOK-EN',
    exploreBtn: 'Explorar servicios',
    navDivisions: 'Divisiones',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Centro Empresarial',
    navMarket: 'Mercado',
    navOpportunities: 'Oportunidades',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Tu Asistente Personal de Aprendizaje Global',
    professorAiLabel: 'Asistente Educativo de IA',
    schoolDivisionName: 'IFIOK SCHOOL — Aprendizaje Digital Global',
    schoolDivisionTagline: 'Aprende Sin Fronteras. Crece Sin Límites.',
    schoolPortalTitle: 'Portal de Administración Escolar IFIOK',
    virtualClassroomTitle: 'Aula Virtual',
    certificatesTitle: 'Certificados',
    academicTerms: {
      subject: 'Asignatura',
      lesson: 'Lección',
      quiz: 'Cuestionario',
      exam: 'Examen',
      homework: 'Tarea',
      grade: 'Calificación',
      attendance: 'Asistencia',
      certificate: 'Certificado',
    },
  },
  pt: {
    slogan: 'Capacitar. Conectar. Ganhar. Crescer.',
    joinBtn: 'Junte-se ao IFIOK-EN',
    exploreBtn: 'Explorar serviços',
    navDivisions: 'Divisões',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Centro Empresarial',
    navMarket: 'Mercado',
    navOpportunities: 'Oportunidades',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Seu Assistente Pessoal de Aprendizagem Global',
    professorAiLabel: 'Assistente Educacional de IA',
    schoolDivisionName: 'IFIOK SCHOOL — Aprendizagem Digital Global',
    schoolDivisionTagline: 'Aprenda Sem Fronteiras. Cresça Sem Limites.',
    schoolPortalTitle: 'Portal de Administração Escolar IFIOK',
    virtualClassroomTitle: 'Sala de Aula Virtual',
    certificatesTitle: 'Certificados',
    academicTerms: {
      subject: 'Disciplina',
      lesson: 'Aula',
      quiz: 'Questionário',
      exam: 'Exame',
      homework: 'Tarefa',
      grade: 'Nota',
      attendance: 'Frequência',
      certificate: 'Certificado',
    },
  },
  ar: {
    slogan: 'التمكين. التواصل. الكسب. النمو.',
    joinBtn: 'انضم إلى IFIOK-EN',
    exploreBtn: 'استكشف خدماتنا',
    navDivisions: 'الأقسام',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'مركز الأعمال',
    navMarket: 'السوق',
    navOpportunities: 'الفرص',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'مساعدك الشخصي للتعلم العالمي',
    professorAiLabel: 'مساعد تعليمي بالذكاء الاصطناعي',
    schoolDivisionName: 'IFIOK SCHOOL — التعلم الرقمي العالمي',
    schoolDivisionTagline: 'تعلّم بلا حدود. انمُ بلا قيود.',
    schoolPortalTitle: 'بوابة إدارة المدارس IFIOK',
    virtualClassroomTitle: 'الفصل الافتراضي',
    certificatesTitle: 'الشهادات',
    academicTerms: {
      subject: 'المادة الدراسية',
      lesson: 'الدرس',
      quiz: 'اختبار قصير',
      exam: 'الامتحان',
      homework: 'الواجب المنزلي',
      grade: 'الدرجة',
      attendance: 'الحضور',
      certificate: 'شهادة الإتمام',
    },
  },
  zh: {
    slogan: '赋能 · 连接 · 创收 · 成长',
    joinBtn: '加入 IFIOK-EN',
    exploreBtn: '探索服务',
    navDivisions: '业务板块',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: '商业中心',
    navMarket: '市场',
    navOpportunities: '机遇',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: '您的个人全球学习助手',
    professorAiLabel: '人工智能教育助手',
    schoolDivisionName: 'IFIOK SCHOOL — 全球数字学习',
    schoolDivisionTagline: '学无国界，成长无限。',
    schoolPortalTitle: 'IFIOK 学校管理门户',
    virtualClassroomTitle: '虚拟课堂',
    certificatesTitle: '结业证书',
    academicTerms: {
      subject: '学科',
      lesson: '课程',
      quiz: '测验',
      exam: '考试',
      homework: '作业',
      grade: '成绩',
      attendance: '考勤',
      certificate: '证书',
    },
  },
  yo: {
    slogan: 'Fún ní Agbára. So Pọ̀. Jèrè. Dàgbà.',
    joinBtn: 'Darapọ̀ mọ́ IFIOK-EN',
    exploreBtn: 'Ṣàwárí Àwọn Iṣẹ́ Wa',
    navDivisions: 'Àwọn Ẹ̀ka',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Ibùdó Iṣẹ́',
    navMarket: 'Ọjà',
    navOpportunities: 'Àwọn Àǹfààní',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Olùrànlọ́wọ́ Ẹ̀kọ́ Àgbáyé Rẹ',
    professorAiLabel: 'Olùrànlọ́wọ́ Ẹ̀kọ́ AI',
    schoolDivisionName: 'IFIOK SCHOOL — Ẹ̀kọ́ Ayélujára Àgbáyé',
    schoolDivisionTagline: 'Kọ́ Ẹ̀kọ́ Láìsí Ààlà. Dàgbà Láìsí Òpin.',
    schoolPortalTitle: 'Pépà Ìṣàkóso Ilé-Ìwé IFIOK',
    virtualClassroomTitle: 'Yàrá Ìkẹ́kọ̀ọ́ Ayélujára',
    certificatesTitle: 'Àwọn Ìwé-Ẹ̀rí',
    academicTerms: {
      subject: 'Ẹ̀kọ́',
      lesson: 'Ìdánilẹ́kọ̀ọ́',
      quiz: 'Ìdánwò Kékeré',
      exam: 'Ìdánwò Àṣekágbá',
      homework: 'Iṣẹ́ Ilé',
      grade: 'Àmì Ìdánwò',
      attendance: 'Ìwàsí',
      certificate: 'Ìwé-Ẹ̀rí',
    },
  },
  ha: {
    slogan: 'Ƙarfafa. Haɗa. Samu. Girma.',
    joinBtn: 'Shiga IFIOK-EN',
    exploreBtn: 'Bincika Ayyukanmu',
    navDivisions: 'Sassan',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Cibiyar Kasuwanci',
    navMarket: 'Kasuwa',
    navOpportunities: 'Damarmaki',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Mataimakin Koyo na Duniya',
    professorAiLabel: 'Mataimakin Ilimi na AI',
    schoolDivisionName: 'IFIOK SCHOOL — Koyon Dijital na Duniya',
    schoolDivisionTagline: 'Koyo Ba Tare da Iyaka Ba. Girma Ba Tare da Iyaka Ba.',
    schoolPortalTitle: 'Shafin Gudanar da Makaranta na IFIOK',
    virtualClassroomTitle: 'Ajin Yanar Gizo',
    certificatesTitle: 'Takardun Shaida',
    academicTerms: {
      subject: 'Darasi',
      lesson: 'Karatun Yau',
      quiz: 'Gwaji',
      exam: 'Jarrabawa',
      homework: 'Aikin Gida',
      grade: 'Maki',
      attendance: 'Halarta',
      certificate: 'Takardar Shaida',
    },
  },
  ig: {
    slogan: 'Nye Ike. Jikọọ. Nweta. Too.',
    joinBtn: 'Sonye na IFIOK-EN',
    exploreBtn: 'Chọpụta Ọrụ Anyị',
    navDivisions: 'Ngalaba',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Ebe Azụmahịa',
    navMarket: 'Ahịa',
    navOpportunities: 'Ohere',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Onye Enyemaka Mmụta Ụwa Gị',
    professorAiLabel: 'Onye Enyemaka Mmụta AI',
    schoolDivisionName: 'IFIOK SCHOOL — Mmụta Dijitalụ Ụwa',
    schoolDivisionTagline: 'Mụta Na-enweghị Oke. Too Na-enweghị Ngwụcha.',
    schoolPortalTitle: 'Ọnụ Ụzọ Nchịkwa Ụlọ Akwụkwọ IFIOK',
    virtualClassroomTitle: 'Klaasị Ịntanetị',
    certificatesTitle: 'Asambodo',
    academicTerms: {
      subject: 'Isiokwu Mmụta',
      lesson: 'Ihe Mmụta',
      quiz: 'Ajụjụ Nnwale',
      exam: 'Ule',
      homework: 'Ọrụ Ụlọ',
      grade: 'Akara',
      attendance: 'Ọbịbịa',
      certificate: 'Asambodo',
    },
  },
  sw: {
    slogan: 'Wezesha. Unganisha. Pata. Kua.',
    joinBtn: 'Jiunge na IFIOK-EN',
    exploreBtn: 'Chunguza Huduma Zetu',
    navDivisions: 'Vitengo',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Kituo cha Biashara',
    navMarket: 'Soko',
    navOpportunities: 'Fursa',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Msaidizi Wako wa Kujifunza Duniani',
    professorAiLabel: 'Msaidizi wa Elimu wa AI',
    schoolDivisionName: 'IFIOK SCHOOL — Kujifunza Kidijitali Duniani',
    schoolDivisionTagline: 'Jifunze Bila Mipaka. Kua Bila Kikomo.',
    schoolPortalTitle: 'Lango la Usimamizi wa Shule IFIOK',
    virtualClassroomTitle: 'Darasa la Mtandaoni',
    certificatesTitle: 'Vyeti',
    academicTerms: {
      subject: 'Somo',
      lesson: 'Kipindi',
      quiz: 'Jaribio',
      exam: 'Mtihani',
      homework: 'Kazi ya Nyumbani',
      grade: 'Alama',
      attendance: 'Mahudhurio',
      certificate: 'Cheti',
    },
  },
  de: { ...EN_DICT, navMarket: 'Marktplatz', navOpportunities: 'Chancen', professorTagline: 'Ihr persönlicher globaler Lernassistent' },
  hi: { ...EN_DICT, professorTagline: 'आपका व्यक्तिगत वैश्विक शिक्षण सहायक' },
  ja: { ...EN_DICT, professorTagline: 'あなたのグローバル学習アシスタント' },
  ko: { ...EN_DICT, professorTagline: '나만의 글로벌 학습 어시스턴트' },
  ru: { ...EN_DICT, professorTagline: 'Ваш персональный глобальный помощник в обучении' },
};
