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
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', bcp47: 'de-DE', rtl: false, tier: 'initial' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', bcp47: 'hi-IN', rtl: false, tier: 'initial' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', bcp47: 'ja-JP', rtl: false, tier: 'initial' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', bcp47: 'ko-KR', rtl: false, tier: 'initial' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', bcp47: 'ru-RU', rtl: false, tier: 'initial' },
];

export const MARKET_SUITES = [
  {
    id: 'software_productivity',
    code: 'A',
    label: 'Software & Productivity',
    subcategories: [
      'Licensed Software',
      'Business Management Tools',
      'Website Themes & Templates',
      'E-commerce Templates',
      'WordPress Themes & Plugins',
      'Developer Tools & SDKs',
      'Programming Resources',
      'Authorized Cloud Tools',
    ],
  },
  {
    id: 'digital_learning_publishing',
    code: 'B',
    label: 'Digital Learning & Publishing',
    subcategories: [
      'E-books',
      'Audiobooks',
      'Educational Guides',
      'Training Manuals',
      'Digital Workbooks',
      'Business Guides',
      'Study Materials',
    ],
  },
  {
    id: 'creative_design_assets',
    code: 'C',
    label: 'Creative & Design Assets',
    subcategories: [
      'Logo Templates',
      'Branding Kits',
      'Graphic Design Templates',
      'Presentation Templates',
      'Social Media Kits',
      'Licensed Fonts & Icons',
      'Video Editing Presets & Templates',
      'Photography Presets',
      'Licensed Stock Media & Illustrations',
    ],
  },
  {
    id: 'business_resources',
    code: 'D',
    label: 'Business Resources',
    subcategories: [
      'Business-Plan Templates',
      'Accounting Spreadsheets',
      'Financial Calculators',
      'Invoice & Proposal Templates',
      'CV & Resume Templates',
      'Marketing Resources',
      'Digital Business Starter Kits',
    ],
  },
  {
    id: 'digital_collectibles',
    code: 'E',
    label: 'Digital Collectibles',
    subcategories: [
      'Original Digital Artwork',
      'Authorized Collectible Editions',
      'Trading-Card Collections',
      'Gaming Collectibles',
      'Utility Blockchain Collectibles',
      'Creator-Issued Digital Assets',
    ],
  },
  {
    id: 'gaming_web3',
    code: 'F',
    label: 'Gaming & Web3',
    subcategories: [
      'Licensed Game-Dev Assets',
      'Authorized Gaming Items',
      'Blockchain Game Resources',
      'Web3 Developer Tools',
      'Smart-Contract Learning Resources',
      'Verified Pi Ecosystem Apps & Services',
    ],
  },
  {
    id: 'physical_commerce',
    code: 'P',
    label: 'Verified Physical Goods',
    subcategories: [
      'Electronics & Tech',
      'Hardware & Computing',
      'Books & Print Editions',
      'SME & Office Equipment',
    ],
  },
] as const;

export const DELIVERY_METHODS = [
  { id: 'instant_digital_download', label: 'Instant Digital Download (Vault)' },
  { id: 'license_key', label: 'Verified License Key' },
  { id: 'member_vault_access', label: 'Encrypted Member Portal Access' },
  { id: 'authorized_external_delivery', label: 'Authorized Partner API Delivery' },
  { id: 'physical_shipping', label: 'Tracked Physical Shipping' },
] as const;

export const FREELANCE_CATEGORIES = [
  'Programming',
  'Graphic Design',
  'Website Development',
  'Writing',
  'Translation',
  'Video Editing',
  'Digital Marketing',
  'Consulting',
] as const;

export const BUSINESS_HUB_CATEGORIES = [
  'Verified SMEs',
  'Templates & Toolkits',
  'Corporate Consulting',
  'Business Registration Assistance',
  'B2B Partnerships',
] as const;

export const OPPORTUNITY_TYPES = [
  { id: 'job', label: 'Jobs' },
  { id: 'internship', label: 'Internships' },
  { id: 'scholarship', label: 'Scholarships' },
  { id: 'grant', label: 'Grants' },
  { id: 'fellowship', label: 'Fellowships' },
  { id: 'competition', label: 'Competitions' },
  { id: 'partnership', label: 'Partnerships' },
] as const;

export const COMMUNITY_SPACES = [
  'Professional Networking',
  'Educational Communities',
  'Business Collaboration',
  'Developer Groups',
  'Mentorship Sessions',
  'Approved Events',
] as const;

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
  de: {
    slogan: 'Befähigen. Verbinden. Verdienen. Wachsen.',
    joinBtn: 'IFIOK-EN beitreten',
    exploreBtn: 'Dienste entdecken',
    navDivisions: 'Bereiche',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Business-Hub',
    navMarket: 'Marktplatz',
    navOpportunities: 'Chancen',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Ihr persönlicher globaler Lernassistent',
    professorAiLabel: 'KI-Bildungsassistent',
    schoolDivisionName: 'IFIOK SCHOOL — Globales digitales Lernen',
    schoolDivisionTagline: 'Lernen ohne Grenzen. Wachsen ohne Limits.',
    schoolPortalTitle: 'IFIOK Schulverwaltungsportal',
    virtualClassroomTitle: 'Virtuelles Klassenzimmer',
    certificatesTitle: 'Zertifikate',
    academicTerms: {
      subject: 'Fach',
      lesson: 'Lektion',
      quiz: 'Quiz',
      exam: 'Prüfung',
      homework: 'Hausaufgabe',
      grade: 'Note',
      attendance: 'Anwesenheit',
      certificate: 'Zertifikat',
    },
  },
  hi: {
    slogan: 'सशक्त बनाएं। जोड़ें। कमाएं। बढ़ें।',
    joinBtn: 'IFIOK-EN से जुड़ें',
    exploreBtn: 'हमारी सेवाएं देखें',
    navDivisions: 'विभाग',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'बिज़नेस हब',
    navMarket: 'बाज़ार',
    navOpportunities: 'अवसर',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'आपका व्यक्तिगत वैश्विक शिक्षण सहायक',
    professorAiLabel: 'AI शैक्षिक सहायक',
    schoolDivisionName: 'IFIOK SCHOOL — वैश्विक डिजिटल शिक्षा',
    schoolDivisionTagline: 'बिना सीमाओं के सीखें। बिना रुकावट बढ़ें।',
    schoolPortalTitle: 'IFIOK स्कूल प्रशासन पोर्टल',
    virtualClassroomTitle: 'वर्चुअल क्लासरूम',
    certificatesTitle: 'प्रमाणपत्र',
    academicTerms: {
      subject: 'विषय',
      lesson: 'पाठ',
      quiz: 'प्रश्नोत्तरी',
      exam: 'परीक्षा',
      homework: 'गृहकार्य',
      grade: 'ग्रेड',
      attendance: 'उपस्थिति',
      certificate: 'प्रमाणपत्र',
    },
  },
  ja: {
    slogan: '力を与える。つなぐ。稼ぐ。成長する。',
    joinBtn: 'IFIOK-EN に参加',
    exploreBtn: 'サービスを見る',
    navDivisions: '部門',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'ビジネスハブ',
    navMarket: 'マーケット',
    navOpportunities: '機会',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'あなたのグローバル学習アシスタント',
    professorAiLabel: 'AI 教育アシスタント',
    schoolDivisionName: 'IFIOK SCHOOL — グローバル・デジタル学習',
    schoolDivisionTagline: '国境なき学び。限界なき成長。',
    schoolPortalTitle: 'IFIOK 学校管理ポータル',
    virtualClassroomTitle: 'バーチャル教室',
    certificatesTitle: '修了証',
    academicTerms: {
      subject: '科目',
      lesson: 'レッスン',
      quiz: '小テスト',
      exam: '試験',
      homework: '宿題',
      grade: '成績',
      attendance: '出席',
      certificate: '証明書',
    },
  },
  ko: {
    slogan: '역량 강화. 연결. 수익. 성장.',
    joinBtn: 'IFIOK-EN 가입하기',
    exploreBtn: '서비스 탐색',
    navDivisions: '부문',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: '비즈니스 허브',
    navMarket: '마켓',
    navOpportunities: '기회',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: '나만의 글로벌 학습 어시스턴트',
    professorAiLabel: 'AI 교육 어시스턴트',
    schoolDivisionName: 'IFIOK SCHOOL — 글로벌 디지털 교육',
    schoolDivisionTagline: '경계 없는 배움. 한계 없는 성장.',
    schoolPortalTitle: 'IFIOK 학교 관리 포털',
    virtualClassroomTitle: '가상 교실',
    certificatesTitle: '수료증',
    academicTerms: {
      subject: '과목',
      lesson: '수업',
      quiz: '퀴즈',
      exam: '시험',
      homework: '과제',
      grade: '성적',
      attendance: '출석',
      certificate: '인증서',
    },
  },
  ru: {
    slogan: 'Расширяйте возможности. Объединяйте. Зарабатывайте. Растите.',
    joinBtn: 'Присоединиться к IFIOK-EN',
    exploreBtn: 'Изучить сервисы',
    navDivisions: 'Разделы',
    navAcademy: 'IFIOK SCHOOL',
    navBusiness: 'Бизнес-центр',
    navMarket: 'Маркет',
    navOpportunities: 'Возможности',
    professorTitle: 'IFIOK PROFESSOR',
    professorTagline: 'Ваш персональный глобальный помощник в обучении',
    professorAiLabel: 'ИИ-помощник по обучению',
    schoolDivisionName: 'IFIOK SCHOOL — Глобальное цифровое обучение',
    schoolDivisionTagline: 'Учитесь без границ. Растите без пределов.',
    schoolPortalTitle: 'Портал управления школой IFIOK',
    virtualClassroomTitle: 'Виртуальный класс',
    certificatesTitle: 'Сертификаты',
    academicTerms: {
      subject: 'Предмет',
      lesson: 'Урок',
      quiz: 'Тест',
      exam: 'Экзамен',
      homework: 'Домашнее задание',
      grade: 'Оценка',
      attendance: 'Посещаемость',
      certificate: 'Сертификат',
    },
  },
};

export function getLanguageAvailabilitySummary(): {
  totalConfiguredLanguages: number;
  fullUiLanguagesCount: number;
} {
  const fullUiLanguagesCount = LANGUAGE_OPTIONS.filter((opt) => {
    const dict = TRANSLATIONS[opt.code];
    if (!dict) return false;
    if (opt.code === 'en') return true;
    return dict.slogan !== EN_DICT.slogan && dict.academicTerms.subject !== EN_DICT.academicTerms.subject;
  }).length;
  return {
    totalConfiguredLanguages: LANGUAGE_OPTIONS.length,
    fullUiLanguagesCount,
  };
}
