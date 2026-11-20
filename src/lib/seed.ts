import type {
  Course,
  DivisionTab,
  FreelanceService,
  Opportunity,
  PlatformSettingsPublic,
  Product,
  PublicSummary,
} from '../types/platform.ts';

export const SEED_MEMBERS_COUNT = 1;
export const SEED_BUSINESSES_COUNT = 0;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsPublic = {
  heroHeadline: 'IFIOK-EN Global Digital Empowerment Network',
  heroSubheadline: 'Empower. Connect. Earn. Grow. Powered by Pi Network Testnet.',
  announcementBanner: 'IFIOK SCHOOL & IFIOK DIGITAL Testnet Commerce Active',
  supportEmail: 'ifiok82@gmail.com',
  freelanceCommissionPct: 8,
  marketplaceCommissionPct: 5,
  subscriptionProPi: 12,
  subscriptionBusinessPi: 35,
  subscriptionEnterprisePi: 90,
  informationalUsdPerPi: 1.0,
  piEnvironment: 'testnet',
  mainnetEnabled: false,
};

const SEED_PUB_DATE = '2026-11-18';
const SEED_TIMESTAMP = '2026-11-18T00:00:00.000Z';
const COURSE_RIGHTS =
  'Original IFIOK-EN Curriculum Work. Licensed to enrolled learners for personal and classroom study; commercial redistribution prohibited.';
const COURSE_MAPPING =
  'Independent structured curriculum authored by IFIOK-EN Editorial Faculty; does not claim external ministry, university, or national board accreditation.';

export type SeedCourse = Course & {
  pricePi: number;
  lessons: number;
  instructor: string;
};

export type SeedMarketListing = Product & {
  pricePi: number;
  seller: string;
};

const RAW_COURSES: Array<{
  id: number;
  slug: string;
  title: string;
  subject: string;
  category: string;
  level: string;
  durationHours: number;
  pricePi: number;
  description: string;
  prerequisites: string;
  targetAudience: string;
  syllabus: string[];
  learningObjectives: string[];
  pdfFileName: string;
}> = [
  {
    id: 1,
    slug: 'ifiok-math-foundations',
    title: 'Mathematics Foundations',
    subject: 'Mathematics',
    category: 'Mathematics',
    level: 'Beginner',
    durationHours: 16,
    pricePi: 0,
    description:
      'Core global numeracy curriculum covering place value, operations, fractions, percentages, linear equations, and everyday geometric measurement with worked examples.',
    prerequisites: 'Basic counting and number recognition',
    targetAudience: 'Primary/junior secondary students and adult numeracy learners globally',
    syllabus: [
      'Module 1: Whole Numbers, Place Value & Order of Operations',
      'Module 2: Fractions, Decimals, Ratios & Percentages',
      'Module 3: Linear Expressions & One-Variable Equations',
      'Module 4: Perimeter, Area, Volume & Data Interpretation',
    ],
    learningObjectives: [
      'Perform accurate multi-step arithmetic using BODMAS/PEMDAS order of operations.',
      'Convert fluently between fractions, decimals, and percentages in real financial and measurement tasks.',
      'Solve single-variable linear equations and check solutions by substitution.',
      'Compute area, perimeter, and volume for standard geometric shapes and interpret tables.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Mathematics_Foundations.pdf',
  },
  {
    id: 2,
    slug: 'ifiok-english-foundations',
    title: 'English Language Foundations',
    subject: 'English Language',
    category: 'English Language',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 0,
    description:
      'Essential grammar, reading comprehension, sentence clarity, vocabulary building, and structured paragraph writing for international students and lifelong learners.',
    prerequisites: 'Basic alphabet literacy and simple reading familiarity',
    targetAudience: 'Primary/secondary learners and international English foundations students',
    syllabus: [
      'Module 1: Parts of Speech & Sentence Architecture',
      'Module 2: Tenses, Subject-Verb Agreement & Punctuation',
      'Module 3: Active Reading Comprehension & Context Vocabulary',
      'Module 4: Structured Paragraphs, Summaries & Formal Messages',
    ],
    learningObjectives: [
      'Identify nouns, pronouns, verbs, adjectives, adverbs, prepositions, and conjunctions in context.',
      'Write grammatically consistent sentences using proper tense and subject-verb agreement.',
      'Extract main ideas, supporting evidence, and inferred meaning from nonfiction passages.',
      'Compose clear topic-sentence paragraphs and polite formal emails.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_English_Language_Foundations.pdf',
  },
  {
    id: 3,
    slug: 'ifiok-basic-science',
    title: 'Basic Science Foundations',
    subject: 'Biology & Life Sciences',
    category: 'Physics & Applied Sciences',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 0,
    description:
      'Inquiry-based foundational science exploring the scientific method, matter and energy, living cells, ecosystems, Earth systems, and safe observation habits.',
    prerequisites: 'Basic reading and arithmetic comprehension',
    targetAudience: 'Upper primary and junior secondary science learners worldwide',
    syllabus: [
      'Module 1: Observation, Hypothesis & The Scientific Method',
      'Module 2: States of Matter, Mixtures & Basic Energy Forms',
      'Module 3: Cells, Plants, Photosynthesis & Human Body Systems',
      'Module 4: Water Cycle, Weather, Climate & Environmental Stewardship',
    ],
    learningObjectives: [
      'Formulate a testable hypothesis and distinguish independent, dependent, and control variables.',
      'Compare particle behavior across solids, liquids, and gases during heating and cooling.',
      'Describe core cellular organelles and explain how photosynthesis sustains food chains.',
      'Explain evaporation, condensation, and precipitation within Earth freshwater cycles.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Basic_Science_Foundations.pdf',
  },
  {
    id: 4,
    slug: 'ifiok-computer-skills',
    title: 'Computer Skills for Beginners',
    subject: 'Computer Science & Software Engineering',
    category: 'Digital Literacy & Productivity',
    level: 'Beginner',
    durationHours: 12,
    pricePi: 0,
    description:
      'Practical digital literacy covering operating systems, folder hygiene, word processing, spreadsheets, cloud safety, password hygiene, and troubleshooting.',
    prerequisites: 'Access to a smartphone, tablet, or desktop computer',
    targetAudience: 'First-time computer users, students, and community digital trainees',
    syllabus: [
      'Module 1: Hardware, Operating Systems & Organized File Management',
      'Module 2: Document Formatting & Practical Spreadsheet Calculations',
      'Module 3: Effective Web Search, Email Etiquette & Cloud Collaboration',
      'Module 4: Account Security, Phishing Recognition & Backups',
    ],
    learningObjectives: [
      'Organize nested project folders using consistent naming conventions and safe file extensions.',
      'Create formatted documents and build basic SUM/AVERAGE spreadsheet tables.',
      'Evaluate online search results for credibility and write clear professional emails.',
      'Enable two-factor authentication, spot phishing links, and maintain 3-2-1 backups.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Computer_Skills_For_Beginners.pdf',
  },
  {
    id: 5,
    slug: 'ifiok-intro-programming',
    title: 'Introduction to Programming',
    subject: 'Computer Science & Software Engineering',
    category: 'Computer Science & Software Engineering',
    level: 'Beginner',
    durationHours: 20,
    pricePi: 3.0,
    description:
      'Structured software foundations covering variables, control flow, functions, arrays/lists, problem decomposition, debugging, and writing clean readable logic.',
    prerequisites: 'Basic computer literacy and elementary algebra',
    targetAudience: 'Secondary/college students, aspiring developers, and technical career switchers',
    syllabus: [
      'Module 1: Computational Thinking, Variables & Data Types',
      'Module 2: Boolean Logic, Conditionals & Iterative Loops',
      'Module 3: Modular Functions, Parameters & Return Values',
      'Module 4: Arrays, Dictionaries, Debugging & Unit Testing',
    ],
    learningObjectives: [
      'Model real problems using strings, integers, floats, and boolean state.',
      'Control execution paths cleanly using if/else branches and bounded while/for loops.',
      'Refactor repetitive code into reusable pure functions with explicit inputs and outputs.',
      'Debug off-by-one and type-mismatch bugs systematically using trace tables and assertions.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_Programming.pdf',
  },
  {
    id: 6,
    slug: 'ifiok-intro-ai',
    title: 'Introduction to Artificial Intelligence',
    subject: 'Artificial Intelligence & Data Science',
    category: 'Artificial Intelligence & Data Science',
    level: 'Intermediate',
    durationHours: 18,
    pricePi: 3.5,
    description:
      'Clear conceptual foundation in machine learning, supervised vs. unsupervised models, neural networks, large language models, prompt verification, and AI ethics.',
    prerequisites: 'Introductory programming concepts and basic probability/averages',
    targetAudience: 'High school, university, and professional learners exploring applied AI responsibly',
    syllabus: [
      'Module 1: What AI Is (and Isn’t) — Rule Systems vs. Machine Learning',
      'Module 2: Training Data, Features, Overfitting & Model Evaluation',
      'Module 3: Neural Networks, Transformers & Generative AI Mechanics',
      'Module 4: Hallucinations, Privacy, Bias & Responsible AI Verification',
    ],
    learningObjectives: [
      'Differentiate classical rule-based software from statistical supervised and unsupervised learning.',
      'Explain train/validation/test splits and recognize overfitting vs. underfitting.',
      'Describe how tokenized language models predict text probabilistically without inherent truth checking.',
      'Apply human-in-the-loop citation checks and data privacy safeguards when using AI tools.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_AI.pdf',
  },
  {
    id: 7,
    slug: 'ifiok-entrepreneurship',
    title: 'Entrepreneurship Fundamentals',
    subject: 'Business Management & Entrepreneurship',
    category: 'Business Management & Entrepreneurship',
    level: 'Beginner',
    durationHours: 15,
    pricePi: 2.5,
    description:
      'Actionable venture building covering customer problem discovery, value propositions, unit economics, pricing, lean MVP testing, and compliant business operations.',
    prerequisites: 'Basic arithmetic and interest in launching or formalizing a business',
    targetAudience: 'Aspiring founders, micro-entrepreneurs, and SME operators globally',
    syllabus: [
      'Module 1: Problem Discovery & Customer Interviews Without Bias',
      'Module 2: Value Proposition, Lean Business Canvas & MVP Validation',
      'Module 3: Unit Economics, Break-Even Pricing & Cashflow Survival',
      'Module 4: Customer Retention, Operations & Ethical Governance',
    ],
    learningObjectives: [
      'Conduct non-leading customer discovery interviews to confirm real willingness to pay.',
      'Map cost structure, revenue streams, channels, and key metrics on a 1-page Lean Canvas.',
      'Compute gross margin, fixed-cost break-even units, and runway.',
      'Define measurable post-launch customer retention and quality KPIs.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Entrepreneurship_Fundamentals.pdf',
  },
  {
    id: 8,
    slug: 'ifiok-financial-literacy',
    title: 'Personal Financial Literacy',
    subject: 'Economics, Finance & Accounting',
    category: 'Economics, Finance & Accounting',
    level: 'Beginner',
    durationHours: 12,
    pricePi: 2.0,
    description:
      'Practical money management covering budgeting systems, emergency reserves, compound interest vs. debt cost, scam prevention, and long-term financial planning.',
    prerequisites: 'Elementary percentage and arithmetic skills',
    targetAudience: 'Students, young professionals, families, and small business owners',
    syllabus: [
      'Module 1: Cashflow Tracking & Needs-vs-Wants Budgeting',
      'Module 2: Emergency Funds, Savings Discipline & Inflation Awareness',
      'Module 3: Understanding Interest, Credit Cost & Debt Traps',
      'Module 4: Financial Fraud Defense & Long-Term Goal Planning',
    ],
    learningObjectives: [
      'Categorize monthly income into fixed essentials, variable expenses, debt payoff, and savings.',
      'Calculate simple and compound interest growth and total borrowing cost over time.',
      'Identify red flags of high-interest debt traps and guaranteed-return investment scams.',
      'Set SMART short-, medium-, and long-term financial milestones.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Personal_Financial_Literacy.pdf',
  },
  {
    id: 9,
    slug: 'ifiok-digital-marketing',
    title: 'Digital Marketing Fundamentals',
    subject: 'Digital Marketing & E-Commerce',
    category: 'Digital Marketing & E-Commerce',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 2.5,
    description:
      'Ethical growth and digital commerce fundamentals covering audience positioning, search intent (SEO), content funnels, email retention, and conversion analytics.',
    prerequisites: 'Basic writing and web browsing familiarity',
    targetAudience: 'Creators, freelancers, SME owners, and commerce managers',
    syllabus: [
      'Module 1: Audience Positioning, Messaging & Honest Value Propositions',
      'Module 2: Search Intent, On-Page SEO & Educational Content Strategy',
      'Module 3: Conversion Funnels, Landing Clarity & Retention Loops',
      'Module 4: Honest Metrics — CTR, CAC, Conversion Rate & LTV',
    ],
    learningObjectives: [
      'Map customer pain points to clear search-friendly landing page headlines and offers.',
      'Structure ethical educational content that builds trust without deceptive clickbait.',
      'Calculate Click-Through Rate (CTR), Conversion Rate, and Customer Acquisition Cost (CAC).',
      'Design permission-based email follow-up workflows complying with privacy consent norms.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Digital_Marketing_Fundamentals.pdf',
  },
  {
    id: 10,
    slug: 'ifiok-web3-blockchain',
    title: 'Introduction to Web3 and Blockchain',
    subject: 'Web3, Blockchain & Pi Ecosystem',
    category: 'Web3, Blockchain & Pi Ecosystem',
    level: 'Intermediate',
    durationHours: 16,
    pricePi: 3.0,
    description:
      'Vendor-neutral technical primer on cryptographic hashing, public-key signatures, distributed consensus, utility tokens, smart contracts, and wallet security.',
    prerequisites: 'Basic computer skills and elementary digital security habits',
    targetAudience: 'Developers, students, merchants, and Pi ecosystem builders',
    syllabus: [
      'Module 1: Cryptographic Hash Functions & Merkle Integrity',
      'Module 2: Public/Private Keys, Non-Custodial Wallets & Signatures',
      'Module 3: Consensus Mechanisms & Transaction Finality',
      'Module 4: Real Utility Ecosystems, Smart Contracts & Anti-Scam Safety',
    ],
    learningObjectives: [
      'Explain pre-image resistance and avalanche properties of SHA-256 cryptographic hashes.',
      'Distinguish public wallet addresses from private keys / recovery passphrases and explain custody risks.',
      'Compare Proof-of-Work, Proof-of-Stake, and Stellar Consensus Protocol (SCP) trust graphs.',
      'Evaluate Web3 applications based on verifiable server-side verification and genuine utility.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_Web3_Blockchain.pdf',
  },
  {
    id: 11,
    slug: 'ifiok-professional-comm',
    title: 'Professional Communication',
    subject: 'Leadership, Governance & Ethics',
    category: 'Leadership, Governance & Ethics',
    level: 'Beginner',
    durationHours: 10,
    pricePi: 2.0,
    description:
      'Workplace and cross-cultural communication skills covering active listening, structured briefing, meeting agendas, constructive feedback, and conflict resolution.',
    prerequisites: 'Working fluency in foundational English reading and writing',
    targetAudience: 'Graduates, freelancers, team leads, and remote collaborators',
    syllabus: [
      'Module 1: Clarity, Conciseness & Audience-Centered Writing',
      'Module 2: Remote Collaboration, Asynchronous Updates & Meetings',
      'Module 3: Giving and Receiving Constructive Feedback (SBI Model)',
      'Module 4: Professional Negotiation & Written Dispute De-Escalation',
    ],
    learningObjectives: [
      'Write executive summaries and status updates putting decisions and blockers first.',
      'Run focused meetings with written agendas, timeboxes, and assigned action owners.',
      'Deliver specific, non-personal feedback using Situation-Behavior-Impact (SBI).',
      'De-escalate client or team disagreements calmly in writing with clear next steps.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Professional_Communication.pdf',
  },
  {
    id: 12,
    slug: 'ifiok-teacher-resource-course',
    title: 'Teacher Resource Pack',
    subject: 'Pedagogy & Teacher Training',
    category: 'Pedagogy & Teacher Training',
    level: 'Intermediate',
    durationHours: 12,
    pricePi: 0,
    description:
      'Comprehensive educator methodology course and downloadable templates for lesson planning, formative assessment, grading rubrics, accessibility, and child safeguarding.',
    prerequisites: 'Subject knowledge and intent to teach or facilitate learners',
    targetAudience: 'Primary/secondary school teachers, tutors, and training instructors',
    syllabus: [
      'Module 1: Backward Design Lesson Planning & Clear Learning Outcomes',
      'Module 2: Designing Fair Rubrics, MCQs & Formative Checks',
      'Module 3: Universal Accessibility & Multilingual Classroom Scaffolds',
      'Module 4: Child Safeguarding, Privacy & Academic Integrity Ethics',
    ],
    learningObjectives: [
      'Align lesson activities and assessments directly to measurable learning objectives.',
      'Construct analytic grading rubrics with transparent criteria and point weights.',
      'Apply accessibility standards (readable layouts, alt summaries, plain-language pacing).',
      'Maintain strict student data privacy and minor safeguarding boundaries.',
    ],
    pdfFileName: 'IFIOK_SCHOOL_Teacher_Resource_Pack.pdf',
  },
];

export const SEED_COURSES: SeedCourse[] = RAW_COURSES.map((c) => ({
  id: c.id,
  instructor_id: 1,
  instructor_user_id: 1,
  instructor: 'IFIOK PROFESSOR · IFIOK-EN Editorial Faculty',
  instructor_name: 'IFIOK-EN Editorial Faculty',
  instructor_headline: 'IFIOK SCHOOL Curriculum Team',
  instructor_credentials: 'IFIOK-EN Verified Curriculum Faculty',
  title: c.title,
  slug: c.slug,
  category: c.category,
  subject: c.subject,
  language_code: 'en',
  issuing_organization: 'IFIOK SCHOOL',
  level: c.level,
  duration_hours: c.durationHours,
  price_pi: c.pricePi,
  pricePi: c.pricePi,
  lessons: c.syllabus.length,
  syllabus_json: JSON.stringify(c.syllabus),
  learning_objectives_json: JSON.stringify(c.learningObjectives),
  prerequisites: c.prerequisites,
  target_audience: c.targetAudience,
  copyright_permission: COURSE_RIGHTS,
  certificate_criteria:
    'Complete all 4 modules, practice assignments, and achieve >=70% on the assessment rubric.',
  completeness_score: 22,
  completeness_total: 22,
  completeness_complete: true,
  module_topics_count: c.syllabus.length,
  assignments_count: 1,
  quizzes_count: 1,
  description: c.description,
  approval_status: 'approved',
  is_featured: 1,
  source_origin: 'IFIOK-EN Original Curriculum',
  availability_status: 'available',
  last_verified_at: SEED_TIMESTAMP,
  has_locked_content: c.pricePi > 0 ? 1 : 0,
  author_name: 'IFIOK-EN Editorial Faculty',
  publication_date: SEED_PUB_DATE,
  version: '1.0.0',
  review_status: 'Published',
  rights_info: COURSE_RIGHTS,
  curriculum_mapping: COURSE_MAPPING,
  created_at: SEED_TIMESTAMP,
}));

export const SEED_MARKET_LISTINGS: SeedMarketListing[] = [
  {
    id: 1,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Business Starter Kit',
    category: 'Business Templates & Toolkits',
    market_suite: 'business_resources',
    product_type: 'digital',
    description:
      'Complete digital venture launch bundle containing a step-by-step Business Planning Guide (PDF), editable Lean Canvas template (MD), and Compliance & Launch Readiness Checklist (PDF).',
    price_pi: 6.0,
    pricePi: 6.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Business_Starter_Kit_v1.2.zip',
    file_format: 'ZIP',
    malware_scan_status: 'clean_verified',
    version: '1.2.0',
    preview_images_json: JSON.stringify([
      'Business_Launch_Handbook.pdf — 4-section planning & validation guide',
      'Lean_Canvas_Worksheet.md — editable 9-block strategy worksheet',
      'Operations_Readiness_Checklist.pdf — licensing, banking & invoicing steps',
    ]),
    support_info:
      'Includes PDF launch guide, Lean Canvas markdown worksheet, and operational checklist. 14-day verified Pi defect support.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 2,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Small Business Accounting Workbook',
    category: 'Accounting & Finance Workbooks',
    market_suite: 'business_resources',
    product_type: 'digital',
    description:
      'Ready-to-use multi-sheet Excel/OOXML bookkeeping workbook featuring Income Ledger, Expense Tracker, Monthly Cashflow Summary, and Break-Even Calculator.',
    price_pi: 5.5,
    pricePi: 5.5,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Small_Business_Accounting_Workbook.xlsx',
    file_format: 'XLSX',
    malware_scan_status: 'clean_verified',
    version: '1.1.0',
    preview_images_json: JSON.stringify([
      'Sheet 1: Financial_Summary — revenue, expenses, net margin & cash runway overview',
      'Sheet 2: Income_Ledger — structured invoice date, client, category & amount columns',
      'Sheet 3: Expense_Ledger — vendor, deductible category, tax note & payment method',
    ]),
    support_info:
      'Native .xlsx spreadsheet compatible with Excel, LibreOffice Calc & Google Sheets. 14-day Pi support.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 3,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Professional CV Kit',
    category: 'CV & Career Kits',
    market_suite: 'business_resources',
    product_type: 'digital',
    description:
      'Clean, ATS-compatible Word (.docx) CV & Cover Letter template kit engineered for international job applications, with quantified achievement formulas and action verbs.',
    price_pi: 4.0,
    pricePi: 4.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Professional_CV_Kit.docx',
    file_format: 'DOCX',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'ATS-friendly single-column layout without graphics that confuse parsers',
      'Quantified Experience Bullet Formula (Action Verb + Scope + Measurable Result)',
      'Structured Cover Letter template adaptable across tech, education & business',
    ]),
    support_info:
      'Editable Microsoft Word / Google Docs (.docx) CV, executive summary guide, and cover letter pack.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 4,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Digital Marketing Kit',
    category: 'Digital Marketing Kits',
    market_suite: 'business_resources',
    product_type: 'digital',
    description:
      'Practical digital growth toolkit for creators and SMEs containing SEO on-page checklists, conversion funnel audit sheets, campaign KPI calculators, and ethical email templates.',
    price_pi: 5.0,
    pricePi: 5.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Digital_Marketing_Kit.pdf',
    file_format: 'PDF',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'On-Page SEO & Search Intent Audit Checklist',
      'Landing Page Messaging & Trust Block Blueprint',
      '30-Day Educational Content & Newsletter Calendar',
    ]),
    support_info: 'Downloadable PDF workbook with funnel audits, SEO checklists & 30-day content planner.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 5,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Mathematics Practice Pack',
    category: 'Education & Study Packs',
    market_suite: 'digital_learning_publishing',
    product_type: 'digital',
    description:
      'Graded mathematics drill workbook with 4 topic tiers (Arithmetic, Fractions & Ratios, Linear Algebra, Practical Geometry), step-by-step worked examples, and complete answer keys.',
    price_pi: 3.5,
    pricePi: 3.5,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Mathematics_Practice_Pack.pdf',
    file_format: 'PDF',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      '40+ graded practice problems across 4 progressive difficulty levels',
      'Step-by-step worked solutions showing intermediate method steps',
      'Self-check formula sheet for exam & homework preparation',
    ]),
    support_info: 'Structured multi-page PDF study pack with worked solutions & self-test key.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 6,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Computer Skills Guide',
    category: 'eBooks & Guides',
    market_suite: 'digital_learning_publishing',
    product_type: 'digital',
    description:
      'Accessible illustrated-structure PDF handbook teaching everyday file management, keyboard shortcuts, office documents, spreadsheet formulas, cloud hygiene, and phishing defense.',
    price_pi: 3.0,
    pricePi: 3.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Computer_Skills_Guide.pdf',
    file_format: 'PDF',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'Complete Keyboard Shortcut Reference for Windows, macOS & Browsers',
      'Essential Spreadsheet Formulas Guide (SUM, AVERAGE, IF, COUNTIF)',
      'Personal & Workplace Phishing + Password Hygiene Field Manual',
    ]),
    support_info: 'Printable PDF handbook covering essential desktop, spreadsheet & online safety workflows.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 7,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Entrepreneurship Guide',
    category: 'Business Templates & Toolkits',
    market_suite: 'business_resources',
    product_type: 'digital',
    description:
      'Step-by-step entrepreneurship field manual covering customer discovery questions, MVP testing, gross vs. net margin math, vendor contracts, and early hiring readiness.',
    price_pi: 4.5,
    pricePi: 4.5,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Entrepreneurship_Guide.pdf',
    file_format: 'PDF',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      '20 Non-Leading Customer Discovery Interview Questions',
      'Unit Economics, Break-Even & Working Capital Formula Sheet',
      'Operational Risk & Governance Checklist for Growing SMEs',
    ]),
    support_info: 'Comprehensive founder handbook in portable PDF format.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 8,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Web3 Learning Pack',
    category: 'Tech & Web3 Learning Packs',
    market_suite: 'gaming_web3',
    product_type: 'digital',
    description:
      'Technical and beginner-accessible Web3 study pack explaining cryptographic hashes, non-custodial wallets, consensus models, server-side payment verification, and Pi Testnet builder checklists.',
    price_pi: 4.5,
    pricePi: 4.5,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Web3_Learning_Pack.pdf',
    file_format: 'PDF',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'Visual Walkthrough: Hashing, Digital Signatures & Public Ledgers',
      'Wallet Seed Phrase Security & Scam Avoidance Rules',
      'Server-Verified Payment Security Architecture Blueprint',
    ]),
    support_info: 'Educational PDF pack on cryptography, consensus, wallet safety & Testnet architecture.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 9,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Website Starter Kit',
    category: 'Website & Software Starter Kits',
    market_suite: 'software_productivity',
    product_type: 'digital',
    description:
      'Production-ready static website starter archive (.zip) featuring semantic HTML5 landing page, responsive mobile-first CSS stylesheet, SEO metadata checklist, and deployment notes.',
    price_pi: 7.0,
    pricePi: 7.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Website_Starter_Kit.zip',
    file_format: 'ZIP',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'index.html — Accessible semantic HTML5 business & portfolio layout',
      'styles.css — Clean CSS variables, dark-ready tokens & responsive grid',
      'README.md — SEO, performance & deployment checklist',
    ]),
    support_info: 'Clean responsive HTML5 + CSS3 starter archive (.zip) with accessibility & SEO guide.',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 10,
    seller_id: 1,
    seller_user_id: 1,
    seller: 'IFIOK DIGITAL Official Publishing',
    store_name: 'IFIOK DIGITAL Official Publishing',
    seller_country: 'Global',
    title: 'IFIOK Teacher Resource Pack',
    category: 'Teacher & Classroom Resources',
    market_suite: 'digital_learning_publishing',
    product_type: 'digital',
    description:
      'Complete educator toolkit (.zip) combining an editable Lesson Plan Template (.docx), Student Assessment & Safeguarding Rubric (.pdf), and Classroom Attendance & Gradebook Tracker (.xlsx).',
    price_pi: 4.0,
    pricePi: 4.0,
    stock_qty: 999,
    approval_status: 'approved',
    lifecycle_status: 'published',
    source_origin: 'IFIOK DIGITAL Official Publishing',
    distribution_permission: 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use',
    delivery_method: 'instant_digital_download',
    refund_support_terms: '14-day Pi Network verified defect & download support via ifiok82@gmail.com',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    has_locked_content: 1,
    file_original_name: 'IFIOK_Teacher_Resource_Pack.zip',
    file_format: 'ZIP',
    malware_scan_status: 'clean_verified',
    version: '1.0.0',
    preview_images_json: JSON.stringify([
      'Editable_Lesson_Plan_Template.docx — Objectives, warm-up, instruction & assessment blocks',
      'Grading_Rubric_and_Safeguarding_Guide.pdf — 4-tier analytic rubric & classroom ethics',
      'Classroom_Gradebook_Attendance.xlsx — Term roster, attendance & weighted average sheets',
    ]),
    support_info:
      'Multi-format classroom pack (.zip) containing Lesson Plan (.docx), Rubric (.pdf), and Gradebook (.xlsx).',
    creator_ownership_attested: 1,
    download_count: 0,
    has_file: true,
    created_at: SEED_TIMESTAMP,
  },
];

export const SEED_FREELANCE_SERVICES: FreelanceService[] = [
  {
    id: 1,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK-EN Technical Advisory',
    freelancer_country: 'Global',
    title: 'Pi SDK Integration & Payment Verification Audit',
    category: 'Programming',
    description:
      'End-to-end implementation and security review of Pi Browser authentication and server-verified user-to-app Testnet payments.',
    deliverables: 'SDK integration patch, server approval/completion handler, and Testnet audit report',
    credentials_summary: 'IFIOK-EN Verified Engineering Desk',
    delivery_days: 5,
    price_pi: 12.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 2,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK-EN Digital Studio',
    freelancer_country: 'Global',
    title: 'Responsive Business & Portfolio Website Build',
    category: 'Website Development',
    description:
      'Mobile-first, SEO-ready web application or SME storefront crafted with clean accessibility, fast load performance, and Pi-ready navigation.',
    deliverables: 'Responsive web build, metadata & canonical setup, and deployment documentation',
    credentials_summary: 'IFIOK-EN Verified Web Engineering Desk',
    delivery_days: 7,
    price_pi: 18.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 3,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK-EN Creative Desk',
    freelancer_country: 'Global',
    title: 'Educational Course Slide Deck & Brand Visual Kit',
    category: 'Graphic Design',
    description:
      'Structured visual identity, lesson presentation slides, and printable study workbook typography designed for schools, trainers, and SMEs.',
    deliverables: 'Brand palette guide, 15-slide editable deck, and print-safe PDF export',
    credentials_summary: 'IFIOK-EN Verified Design Team',
    delivery_days: 4,
    price_pi: 8.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 4,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK-EN Editorial Faculty',
    freelancer_country: 'Global',
    title: 'Curriculum Documentation & Technical Copywriting',
    category: 'Writing',
    description:
      'Clear, factual documentation, course syllabi, marking rubrics, and business operating manuals written for international audiences.',
    deliverables: 'Structured multi-section handbook or course syllabus with answer keys',
    credentials_summary: 'IFIOK-EN Verified Curriculum Authors',
    delivery_days: 3,
    price_pi: 6.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 5,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK-EN Language Desk',
    freelancer_country: 'Global',
    title: 'Multilingual Course & Study Material Localization',
    category: 'Translation',
    description:
      'Accurate academic and commercial translation across English, French, Spanish, Portuguese, Arabic, Mandarin, Yoruba, Hausa, Igbo, and Swahili.',
    deliverables: 'Reviewed bilingual glossary and localized curriculum document',
    credentials_summary: 'IFIOK-EN Multilingual Review Desk',
    delivery_days: 4,
    price_pi: 7.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 6,
    freelancer_user_id: 1,
    freelancer_name: 'IFIOK Business Advisory Desk',
    freelancer_country: 'Global',
    title: 'SME Digital Venture Launch & Unit Economics Advisory',
    category: 'Consulting',
    description:
      'Structured review of business model canvas, pricing unit economics, Pi commerce compliance, and digital product packaging.',
    deliverables: 'Written feasibility brief, break-even worksheet review, and 30-day launch roadmap',
    credentials_summary: 'IFIOK-EN Business Hub Advisors',
    delivery_days: 5,
    price_pi: 10.0,
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Service Desk',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
];

export const SEED_OPPORTUNITIES: Opportunity[] = [
  {
    id: 1,
    poster_user_id: 1,
    poster_name: 'IFIOK-EN Editorial Faculty',
    title: 'IFIOK SCHOOL Curriculum Author Fellowship',
    opportunity_type: 'fellowship',
    organization_name: 'IFIOK SCHOOL Global Education Desk',
    location: 'Global',
    is_remote: 1,
    compensation_or_award: 'Pi Testnet Research Grant + Verified Author Attribution',
    deadline: '2026-12-31',
    description:
      'Open call for verified educators and subject specialists to author open-access 22-point curricula in STEM, Literacy, Finance, or Teacher Training.',
    requirements:
      'Submit sample 4-module syllabus outline, learning objectives, and original marking rubric with zero third-party copyright infringement.',
    eligibility: 'Certified teachers, lecturers, curriculum designers, and subject researchers globally.',
    external_url: 'https://ifiok-en.vercel.app/ifiok-school',
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Program',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 2,
    poster_user_id: 1,
    poster_name: 'IFIOK-EN Editorial Faculty',
    title: 'Pi Network Testnet Student Builder Micro-Grant',
    opportunity_type: 'grant',
    organization_name: 'IFIOK-EN Developer & Web3 Desk',
    location: 'Global',
    is_remote: 1,
    compensation_or_award: 'Up to 150 Pi Testnet Project Support + Technical Mentorship',
    deadline: '2026-12-31',
    description:
      'Supporting university and secondary learners building practical educational tools, accessibility utilities, or local commerce prototypes on Pi Testnet.',
    requirements:
      'Working Testnet prototype specification, open documentation, and commitment to Pi-compliant security standards.',
    eligibility: 'Active students and early-stage technical builders worldwide.',
    external_url: 'https://ifiok-en.vercel.app/opportunities',
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Program',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 3,
    poster_user_id: 1,
    poster_name: 'IFIOK-EN Editorial Faculty',
    title: 'Multilingual Educational Content Localization Internship',
    opportunity_type: 'internship',
    organization_name: 'IFIOK SCHOOL Language Program',
    location: 'Global',
    is_remote: 1,
    compensation_or_award: 'Mentorship + Verified Completion Certificate + Pi Stipend',
    deadline: '2026-12-15',
    description:
      'Remote seasonal internship helping adapt foundational Mathematics, Science, and Digital Literacy glossaries into regional and international languages.',
    requirements:
      'Strong bilingual proficiency, commitment to terminology accuracy, and familiarity with educational formatting.',
    eligibility: 'Senior students, language graduates, and bilingual teaching assistants.',
    external_url: 'https://ifiok-en.vercel.app/ifiok-school',
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Program',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: 4,
    poster_user_id: 1,
    poster_name: 'IFIOK-EN Editorial Faculty',
    title: 'Institutional School & Training Center Digital Onboarding Partnership',
    opportunity_type: 'partnership',
    organization_name: 'IFIOK Business Hub & IFIOK SCHOOL',
    location: 'Global',
    is_remote: 1,
    compensation_or_award: 'Verified Institutional Portal + Educator & Guardian Tools',
    deadline: '2026-12-31',
    description:
      'Partner with IFIOK SCHOOL to provision verified Student, Teacher, School Admin, and Parent/Guardian portals for accredited primary, secondary, or vocational institutions.',
    requirements:
      'Institutional contact verification, designated child-safety officer email, and curriculum alignment statement.',
    eligibility: 'Primary/secondary schools, colleges, and community training centers worldwide.',
    external_url: 'https://ifiok-en.vercel.app/school/admin-portal',
    approval_status: 'approved',
    source_origin: 'IFIOK-EN Official Program',
    availability_status: 'available',
    last_verified_at: SEED_TIMESTAMP,
    created_at: SEED_TIMESTAMP,
  },
];

export function buildSeedPublicSummary(): PublicSummary {
  return {
    settings: DEFAULT_PLATFORM_SETTINGS,
    stats: {
      members: SEED_MEMBERS_COUNT,
      verifiedBusinesses: SEED_BUSINESSES_COUNT,
      approvedCourses: SEED_COURSES.length,
      approvedOpportunities: SEED_OPPORTUNITIES.length,
      approvedProducts: SEED_MARKET_LISTINGS.length,
      approvedServices: SEED_FREELANCE_SERVICES.length,
    },
    courses: SEED_COURSES.slice(0, 6),
    businesses: [],
    opportunities: SEED_OPPORTUNITIES.slice(0, 6),
    products: SEED_MARKET_LISTINGS.slice(0, 6),
    services: SEED_FREELANCE_SERVICES.slice(0, 6),
    communityPosts: [],
  };
}

function mergeByKey<T>(seedItems: T[], liveItems: T[], getKey: (item: T) => string): T[] {
  const liveMap = new Map<string, T>();
  const extraLive: T[] = [];
  const seedKeys = new Set(seedItems.map(getKey));

  for (const item of liveItems) {
    const key = getKey(item);
    if (seedKeys.has(key)) {
      liveMap.set(key, item);
    } else {
      extraLive.push(item);
    }
  }

  const mergedSeeds = seedItems.map((seedItem) => liveMap.get(getKey(seedItem)) ?? seedItem);
  return [...mergedSeeds, ...extraLive];
}

export function mergeSummaryWithSeed(live?: Partial<PublicSummary> | null): PublicSummary {
  const base = buildSeedPublicSummary();
  if (!live) return base;

  const courses = mergeByKey<Course>(SEED_COURSES, live.courses ?? [], (c) => c.slug || c.title.toLowerCase());
  const products = mergeByKey<Product>(SEED_MARKET_LISTINGS, live.products ?? [], (p) => p.title.toLowerCase());
  const services = mergeByKey<FreelanceService>(SEED_FREELANCE_SERVICES, live.services ?? [], (s) => s.title.toLowerCase());
  const opportunities = mergeByKey<Opportunity>(SEED_OPPORTUNITIES, live.opportunities ?? [], (o) => o.title.toLowerCase());

  return {
    settings: { ...base.settings, ...(live.settings ?? {}) },
    stats: {
      members: Math.max(live.stats?.members ?? 0, SEED_MEMBERS_COUNT),
      verifiedBusinesses: Math.max(live.stats?.verifiedBusinesses ?? 0, SEED_BUSINESSES_COUNT),
      approvedCourses: Math.max(live.stats?.approvedCourses ?? 0, courses.length, SEED_COURSES.length),
      approvedOpportunities: Math.max(live.stats?.approvedOpportunities ?? 0, opportunities.length, SEED_OPPORTUNITIES.length),
      approvedProducts: Math.max(live.stats?.approvedProducts ?? 0, products.length, SEED_MARKET_LISTINGS.length),
      approvedServices: Math.max(live.stats?.approvedServices ?? 0, services.length, SEED_FREELANCE_SERVICES.length),
    },
    courses: courses.slice(0, 6),
    businesses: live.businesses ?? [],
    opportunities: opportunities.slice(0, 6),
    products: products.slice(0, 6),
    services: services.slice(0, 6),
    communityPosts: live.communityPosts ?? [],
  };
}

export function filterAndMergeCourses(
  liveCourses: Course[],
  filters: { subject?: string; category?: string; language?: string; q?: string } = {}
): Course[] {
  const merged = mergeByKey<Course>(SEED_COURSES, liveCourses, (c) => c.slug || c.title.toLowerCase());
  const subject = (filters.subject || '').trim();
  const category = (filters.category || '').trim();
  const language = (filters.language || '').trim();
  const q = (filters.q || '').trim().toLowerCase();

  return merged.filter((row) => {
    if (category && category !== 'All' && row.category !== category) return false;
    if (subject && subject !== 'All' && row.subject !== subject && row.category !== subject) return false;
    if (language && language !== 'all' && (row.language_code || 'en') !== language) return false;
    if (q) {
      const hay = `${row.title} ${row.description} ${row.category} ${row.subject || ''} ${row.instructor_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterAndMergeProducts(
  liveProducts: Product[],
  filters: { type?: string; suite?: string; category?: string; q?: string } = {}
): Product[] {
  const merged = mergeByKey<Product>(SEED_MARKET_LISTINGS, liveProducts, (p) => p.title.toLowerCase());
  const type = (filters.type || '').trim();
  const suite = (filters.suite || '').trim();
  const category = (filters.category || '').trim();
  const q = (filters.q || '').trim().toLowerCase();

  return merged.filter((row) => {
    if (type && type !== 'all' && type !== 'All' && row.product_type !== type) return false;
    if (suite && suite !== 'all' && row.market_suite !== suite) return false;
    if (category && category !== 'All' && row.category !== category) return false;
    if (q) {
      const hay = `${row.title} ${row.description} ${row.category} ${row.store_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterAndMergeServices(
  liveServices: FreelanceService[],
  filters: { category?: string; q?: string } = {}
): FreelanceService[] {
  const merged = mergeByKey<FreelanceService>(SEED_FREELANCE_SERVICES, liveServices, (s) => s.title.toLowerCase());
  const category = (filters.category || '').trim();
  const q = (filters.q || '').trim().toLowerCase();

  return merged.filter((row) => {
    if (category && category !== 'All' && row.category !== category) return false;
    if (q) {
      const hay = `${row.title} ${row.description} ${row.category} ${row.freelancer_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterAndMergeOpportunities(
  liveOpportunities: Opportunity[],
  filters: { type?: string; q?: string } = {}
): Opportunity[] {
  const merged = mergeByKey<Opportunity>(SEED_OPPORTUNITIES, liveOpportunities, (o) => o.title.toLowerCase());
  const type = (filters.type || '').trim();
  const q = (filters.q || '').trim().toLowerCase();

  return merged.filter((row) => {
    if (type && type !== 'all' && type !== 'All' && row.opportunity_type !== type) return false;
    if (q) {
      const hay = `${row.title} ${row.description} ${row.organization_name} ${row.opportunity_type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function searchSeedCatalog(rawQuery: string): Array<{
  id: number;
  title: string;
  subtitle: string;
  pricePi: number | null;
  source_origin?: string;
  division: DivisionTab;
}> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const productMatches = filterAndMergeProducts([], { q })
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.category,
      pricePi: p.price_pi,
      source_origin: p.source_origin,
      division: 'market' as DivisionTab,
    }));

  const courseMatches = filterAndMergeCourses([], { q })
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.category,
      pricePi: c.price_pi,
      source_origin: c.source_origin,
      division: 'academy' as DivisionTab,
    }));

  const serviceMatches = filterAndMergeServices([], { q })
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.category,
      pricePi: s.price_pi,
      source_origin: s.source_origin,
      division: 'freelance' as DivisionTab,
    }));

  const oppMatches = filterAndMergeOpportunities([], { q })
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      title: o.title,
      subtitle: `${o.opportunity_type} · ${o.organization_name}`,
      pricePi: null,
      source_origin: o.source_origin,
      division: 'opportunities' as DivisionTab,
    }));

  return [...productMatches, ...courseMatches, ...serviceMatches, ...oppMatches];
}
