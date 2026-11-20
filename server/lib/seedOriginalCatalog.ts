import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, PRIVATE_ASSETS_DIR } from '../db.ts';
import { evaluateCourseCompleteness } from './courseCompleteness.ts';
import { encryptSensitive } from './crypto.ts';
import { buildValidDocx, buildValidPdf, buildValidXlsx, buildValidZip } from './documentBuilder.ts';
import { SEED_FREELANCE_SERVICES, SEED_OPPORTUNITIES } from '../../src/lib/seed.ts';

interface CourseBlueprint {
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
  modulesNotes: Array<{ topic: string; notes: string }>;
  slidesResources: string[];
  workbooksExercises: string[];
  assignments: string[];
  quizzes: string[];
  examQuestions: string[];
  answerKeysText: string;
  examMarkingGuide: string;
  pdfFileName: string;
}

const PUB_DATE = '2026-11-18';
const COURSE_RIGHTS = 'Original IFIOK-EN Curriculum Work. Licensed to enrolled learners for personal and classroom study; commercial redistribution prohibited.';
const COURSE_MAPPING = 'Independent structured curriculum authored by IFIOK-EN Editorial Faculty; does not claim external ministry, university, or national board accreditation.';

const COURSE_BLUEPRINTS: CourseBlueprint[] = [
  {
    slug: 'ifiok-math-foundations',
    title: 'Mathematics Foundations',
    subject: 'Mathematics',
    category: 'Mathematics',
    level: 'Beginner',
    durationHours: 16,
    pricePi: 0,
    description: 'Core global numeracy curriculum covering place value, operations, fractions, percentages, linear equations, and everyday geometric measurement with worked examples.',
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
    modulesNotes: [
      { topic: 'Whole Numbers & Order of Operations', notes: 'Place value groups units, tens, hundreds, and powers of ten. Evaluate brackets first, followed by exponents, division/multiplication left to right, and addition/subtraction left to right.' },
      { topic: 'Fractions, Ratios & Percentages', notes: 'A fraction represents part of a whole (numerator/denominator). To convert a/b to a percentage, divide a by b and multiply by 100. Ratios compare quantities in shared units.' },
      { topic: 'Introduction to Linear Algebra', notes: 'Variables represent unknown numbers. Maintain equation balance by applying identical inverse operations to both sides of the equals sign.' },
      { topic: 'Practical Geometry & Data', notes: 'Perimeter sums outer boundary lengths; rectangle area equals length x width; triangle area equals 0.5 x base x height. Mean equals sum divided by count.' },
    ],
    slidesResources: ['Workbook Pack: Mathematics Foundations Reference Slides & Formula Sheet (PDF)'],
    workbooksExercises: ['Practice Set A: 24 stepped arithmetic, fraction, and linear equation drills with check grids'],
    assignments: ['Applied Budget & Household Measurement Worksheet (10 real-world word problems)'],
    quizzes: ['Module Check Quiz 1: Fractions, Percentages & Order of Operations (10 items)'],
    examQuestions: [
      'Q1 (10 pts): Simplify 3 + 4 x (12 - 7) and explain each step.',
      'Q2 (15 pts): A book costs 40 units and receives a 15% discount. Calculate the final price.',
      'Q3 (15 pts): Solve for x: 3x - 7 = 20, and verify by substituting your answer back.',
      'Q4 (10 pts): Find the area and perimeter of a rectangular garden 14 m long and 9 m wide.',
    ],
    answerKeysText: 'Q1: 23 (brackets first -> 12-7=5, multiply -> 4x5=20, add -> 3+20=23). Q2: Discount=6, final price=34 units. Q3: 3x=27 -> x=9 (check: 3(9)-7=20). Q4: Area=126 sq m, Perimeter=46 m.',
    examMarkingGuide: 'Award 60% marks for correct logical method and intermediate equations, 40% for accurate final numeric answer and correct units.',
    pdfFileName: 'IFIOK_SCHOOL_Mathematics_Foundations.pdf',
  },
  {
    slug: 'ifiok-english-foundations',
    title: 'English Language Foundations',
    subject: 'English Language',
    category: 'English Language',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 0,
    description: 'Essential grammar, reading comprehension, sentence clarity, vocabulary building, and structured paragraph writing for international students and lifelong learners.',
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
    modulesNotes: [
      { topic: 'Parts of Speech & Clauses', notes: 'Every complete English clause requires a subject and a finite verb. Independent clauses express a complete thought; dependent clauses add context via subordinators.' },
      { topic: 'Verb Tenses & Agreement', notes: 'Singular subjects take singular verbs (She writes); plural subjects take plural verbs (They write). Keep tense consistent within a narrative timeline.' },
      { topic: 'Reading Comprehension Strategy', notes: 'Preview headings, locate the topic sentence in each paragraph, underline transition words (however, therefore, meanwhile), and verify answers against passage text.' },
      { topic: 'Paragraph & Formal Writing', notes: 'Structure paragraphs using Topic Sentence + Supporting Evidence + Explanation + Concluding Link. Avoid run-on sentences with clear periods or conjunctions.' },
    ],
    slidesResources: ['Grammar & Punctuation Quick-Reference Deck (PDF)'],
    workbooksExercises: ['Workbook: 20 Sentence Correction & Comprehension Drills'],
    assignments: ['Write a 180-word structured persuasive paragraph on community learning access'],
    quizzes: ['Grammar & Tense Agreement Assessment Quiz (12 items)'],
    examQuestions: [
      'Q1 (15 pts): Identify subject, verb, and object in: "Careful readers verify unfamiliar sources."',
      'Q2 (15 pts): Correct the errors: "Neither of the students have submitted their essay yesterday."',
      'Q3 (20 pts): Write a formal 120-word paragraph requesting library study resources for a school club.',
    ],
    answerKeysText: 'Q1: Subject="Careful readers", Verb="verify", Object="unfamiliar sources". Q2: "Neither of the students has submitted an essay" (or past tense "submitted his or her essay yesterday"). Q3: Evaluated against rubric.',
    examMarkingGuide: 'Grade Q1/Q2 strictly for grammatical precision (30 pts). Grade Q3 on clarity (8 pts), polite tone (6 pts), and mechanics/spelling (6 pts).',
    pdfFileName: 'IFIOK_SCHOOL_English_Language_Foundations.pdf',
  },
  {
    slug: 'ifiok-basic-science',
    title: 'Basic Science Foundations',
    subject: 'Biology & Life Sciences',
    category: 'Physics & Applied Sciences',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 0,
    description: 'Inquiry-based foundational science exploring the scientific method, matter and energy, living cells, ecosystems, Earth systems, and safe observation habits.',
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
    modulesNotes: [
      { topic: 'The Scientific Method', notes: 'Science tests ideas against repeatable evidence. Keep control variables constant while altering only one independent variable so measured effects remain valid.' },
      { topic: 'Matter & Energy Transfer', notes: 'Solids have fixed volume and shape; liquids flow to fit containers; gases expand to fill space. Heat transfers via conduction, convection, and radiation.' },
      { topic: 'Living Systems & Ecology', notes: 'Plants convert sunlight, water, and carbon dioxide into glucose and oxygen inside chloroplasts. Decomposers recycle nutrients back into soil ecosystems.' },
      { topic: 'Earth & Water Systems', notes: 'Solar energy drives evaporation from oceans and transpiration from plants, forming clouds by condensation before precipitation returns water to land.' },
    ],
    slidesResources: ['Visual Study Guide: Matter, Cells & Ecosystems Handbook (PDF)'],
    workbooksExercises: ['Lab Notebook Exercises: Variable Identification & Water Cycle Diagramming'],
    assignments: ['Home Observation Log: Track 5 reversible vs. irreversible physical/chemical changes safely'],
    quizzes: ['Matter & Life Science Checkpoint Quiz (10 questions)'],
    examQuestions: [
      'Q1 (15 pts): Explain the difference between an independent variable and a control variable with an example.',
      'Q2 (15 pts): Write the word equation for photosynthesis and identify the energy source.',
      'Q3 (20 pts): Compare particle spacing and movement in ice, liquid water, and steam.',
    ],
    answerKeysText: 'Q1: Independent variable is intentionally changed (e.g., sunlight hours); control variables stay constant (soil type, water volume). Q2: Carbon dioxide + Water (+ sunlight/chlorophyll) -> Glucose + Oxygen. Q3: Ice particles vibrate in fixed positions; liquid slides past each other; steam moves rapidly far apart.',
    examMarkingGuide: 'Award full marks when scientific terms are accurate and linked clearly to observable physical behavior.',
    pdfFileName: 'IFIOK_SCHOOL_Basic_Science_Foundations.pdf',
  },
  {
    slug: 'ifiok-computer-skills',
    title: 'Computer Skills for Beginners',
    subject: 'Computer Science & Software Engineering',
    category: 'Digital Literacy & Productivity',
    level: 'Beginner',
    durationHours: 12,
    pricePi: 0,
    description: 'Practical digital literacy covering operating systems, folder hygiene, word processing, spreadsheets, cloud safety, password hygiene, and troubleshooting.',
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
    modulesNotes: [
      { topic: 'File Systems & Extensions', notes: 'Recognize .pdf, .docx, .xlsx, .csv, .png, and .zip extensions. Never open unexpected executable attachments (.exe, .bat, .js) from unknown senders.' },
      { topic: 'Spreadsheets & Office Productivity', notes: 'Rows use numbers, columns use letters. Formulas start with "=" such as =SUM(B2:B10) and =AVERAGE(C2:C10) to eliminate manual arithmetic errors.' },
      { topic: 'Digital Security Hygiene', notes: 'Use unique passphrases managed carefully, inspect domain spelling before entering credentials, and never share wallet recovery phrases or one-time codes.' },
    ],
    slidesResources: ['Beginner Digital Shortcuts & Cybersecurity Checklist (PDF)'],
    workbooksExercises: ['Guided Drill: Building a Personal Expense Sheet with SUM & AVERAGE Formulas'],
    assignments: ['Organize a mock student study directory tree and inspect 5 sample phishing URLs'],
    quizzes: ['Digital Literacy & Cyber Hygiene Quiz (10 questions)'],
    examQuestions: [
      'Q1 (15 pts): Explain three warning signs of a phishing email or lookalike login page.',
      'Q2 (15 pts): Write a spreadsheet formula to calculate the average of cells D2 through D15.',
      'Q3 (20 pts): Describe the 3-2-1 backup principle and why cloud-only sync without versioning is risky.',
    ],
    answerKeysText: 'Q1: Mismatched sender/link domain, urgent/threatening language requesting secrets, unexpected attachment or login prompt. Q2: =AVERAGE(D2:D15). Q3: 3 copies of data, 2 different media types, 1 offsite copy; sync mirrors accidental deletions unless versioned.',
    examMarkingGuide: 'Credit clarity, accurate formula syntax, and practical safety reasoning.',
    pdfFileName: 'IFIOK_SCHOOL_Computer_Skills_For_Beginners.pdf',
  },
  {
    slug: 'ifiok-intro-programming',
    title: 'Introduction to Programming',
    subject: 'Computer Science & Software Engineering',
    category: 'Computer Science & Software Engineering',
    level: 'Beginner',
    durationHours: 20,
    pricePi: 3.0,
    description: 'Structured software foundations covering variables, control flow, functions, arrays/lists, problem decomposition, debugging, and writing clean readable logic.',
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
    modulesNotes: [
      { topic: 'Variables & Type Discipline', notes: 'Always distinguish string text ("42") from numeric integer (42). Prefer explicit, descriptive variable names like totalScore over single letters.' },
      { topic: 'Loops & Control Flow', notes: 'Avoid infinite loops by ensuring loop termination conditions advance monotonically on every iteration. Test boundary cases (0, empty list, negative inputs).' },
      { topic: 'Functions & Decomposition', notes: 'Break large tasks into small functions that do one clear job. Pure functions avoid hidden global mutations and are easy to verify.' },
    ],
    slidesResources: ['Algorithm Design & Trace Table Reference Pack (PDF)'],
    workbooksExercises: ['Coding Logic Workbook: 15 Trace-Table & Pseudocode Exercises'],
    assignments: ['Design & trace a Grade Calculator algorithm handling invalid inputs gracefully'],
    quizzes: ['Loops, Functions & Data Structures Assessment (12 questions)'],
    examQuestions: [
      'Q1 (15 pts): Trace what a loop prints for i = 1 to 5 summing only even values.',
      'Q2 (20 pts): Write a clean function (Python or JS) that takes a list of scores and returns the highest valid score or null if empty.',
      'Q3 (15 pts): Explain the difference between syntax errors, runtime exceptions, and logical bugs.',
    ],
    answerKeysText: 'Q1: Even values 2 and 4 -> sum is 6. Q2: Checks empty array -> returns null; iterates keeping max variable initialized to array[0]. Q3: Syntax prevents parsing; runtime crashes during execution; logic runs without crashing but outputs wrong result.',
    examMarkingGuide: 'Award credit for handling edge cases (empty list), clear variable naming, and accurate distinction of bug classes.',
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_Programming.pdf',
  },
  {
    slug: 'ifiok-intro-ai',
    title: 'Introduction to Artificial Intelligence',
    subject: 'Artificial Intelligence & Data Science',
    category: 'Artificial Intelligence & Data Science',
    level: 'Intermediate',
    durationHours: 18,
    pricePi: 3.5,
    description: 'Clear conceptual foundation in machine learning, supervised vs. unsupervised models, neural networks, large language models, prompt verification, and AI ethics.',
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
    modulesNotes: [
      { topic: 'Supervised vs. Unsupervised Learning', notes: 'Supervised learning trains on labeled input-output pairs (e.g., exam score prediction). Unsupervised learning discovers hidden structure or clusters without labels.' },
      { topic: 'Generalization & Overfitting', notes: 'A model that memorizes training examples scores well in practice but fails on unseen test inputs. Always evaluate accuracy on held-out test splits.' },
      { topic: 'Generative AI Limitations', notes: 'LLMs generate statistically plausible continuations, not verified facts. Grounded Retrieval-Augmented Generation (RAG) binds answers to verified source records.' },
    ],
    slidesResources: ['AI Architecture, Evaluation Metrics & Ethics Deck (PDF)'],
    workbooksExercises: ['Dataset Audit Worksheet: Spotting Data Leakage, Class Imbalance & Hallucinations'],
    assignments: ['Compare zero-shot vs. grounded RAG prompts on a documented school study sheet'],
    quizzes: ['Machine Learning & AI Safety Quiz (12 questions)'],
    examQuestions: [
      'Q1 (15 pts): Why must test data never be mixed into model training sets?',
      'Q2 (20 pts): Explain why Large Language Models can invent plausible-sounding false citations and how RAG mitigates this.',
      'Q3 (15 pts): Identify two privacy risks when pasting student records into external AI tools.',
    ],
    answerKeysText: 'Q1: Mixing causes data leakage, hiding overfitting and inflating apparent accuracy. Q2: LLMs sample next tokens probabilistically; RAG supplies verified reference excerpts and enforces source grounding. Q3: Exposure of PII/minor data and third-party model retention/logging.',
    examMarkingGuide: 'Prioritize conceptual accuracy over hype; verify clear understanding of generalization and privacy controls.',
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_AI.pdf',
  },
  {
    slug: 'ifiok-entrepreneurship',
    title: 'Entrepreneurship Fundamentals',
    subject: 'Business Management & Entrepreneurship',
    category: 'Business Management & Entrepreneurship',
    level: 'Beginner',
    durationHours: 15,
    pricePi: 2.5,
    description: 'Actionable venture building covering customer problem discovery, value propositions, unit economics, pricing, lean MVP testing, and compliant business operations.',
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
    modulesNotes: [
      { topic: 'Customer Discovery Discipline', notes: 'Ask about past customer behavior and real costs incurred rather than hypothetical compliments ("Would you use this?").' },
      { topic: 'Unit Economics & Break-Even', notes: 'Contribution margin = Selling Price - Variable Cost per unit. Break-even quantity = Fixed Costs / Contribution Margin.' },
      { topic: 'Sustainable Operations', notes: 'Keep customer records, tax/license compliance, and transparent refund terms from day one to build compounding trust.' },
    ],
    slidesResources: ['Lean Venture Canvas & Pricing Workbook Slides (PDF)'],
    workbooksExercises: ['Break-Even & Customer Discovery Script Workbook'],
    assignments: ['Complete a 1-page Lean Canvas and unit-economics breakdown for a local service idea'],
    quizzes: ['Venture Validation & Unit Economics Quiz (10 questions)'],
    examQuestions: [
      'Q1 (20 pts): Fixed monthly rent/tools cost 600 units. Product price is 25 units and variable cost is 10 units. Compute contribution margin and break-even sales count.',
      'Q2 (15 pts): Why is asking friends "Do you like my idea?" weak validation?',
      'Q3 (15 pts): Outline three operational steps to protect buyer trust in a digital marketplace.',
    ],
    answerKeysText: 'Q1: Contribution margin = 25 - 10 = 15 units. Break-even = 600 / 15 = 40 sales/month. Q2: Social politeness produces false positives without payment evidence. Q3: Transparent terms, verifiable delivery tracking, and prompt dispute resolution.',
    examMarkingGuide: 'Check exact math on Q1 (20 pts) and practical commercial reasoning on Q2–Q3.',
    pdfFileName: 'IFIOK_SCHOOL_Entrepreneurship_Fundamentals.pdf',
  },
  {
    slug: 'ifiok-financial-literacy',
    title: 'Personal Financial Literacy',
    subject: 'Economics, Finance & Accounting',
    category: 'Economics, Finance & Accounting',
    level: 'Beginner',
    durationHours: 12,
    pricePi: 2.0,
    description: 'Practical money management covering budgeting systems, emergency reserves, compound interest vs. debt cost, scam prevention, and long-term financial planning.',
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
    modulesNotes: [
      { topic: 'Zero-Based & 50/30/20 Budgeting', notes: 'Track every inflow and outflow for 30 days before locking a target budget. Prioritize an emergency reserve covering 3–6 months of core essentials.' },
      { topic: 'Interest Cost vs. Compounding', notes: 'Compare Annual Percentage Rate (APR) and compounding frequency carefully before borrowing. High compounding works in favor of savers and against revolving borrowers.' },
      { topic: 'Fraud & Scam Protection', notes: 'Any offer promising guaranteed risk-free high returns or pressuring immediate secret transfers is a fraud indicator. Never pay advance fees for prizes or unverified jobs.' },
    ],
    slidesResources: ['Personal Cashflow & Debt Math Reference Slides (PDF)'],
    workbooksExercises: ['30-Day Expense Audit & Compound Interest Comparison Sheet'],
    assignments: ['Build a realistic 3-month personal budget including an emergency fund target'],
    quizzes: ['Interest, Budgeting & Scam Defense Quiz (10 questions)'],
    examQuestions: [
      'Q1 (15 pts): Calculate the value of 1,000 units after 2 years at 10% annual compound interest.',
      'Q2 (15 pts): Distinguish between fixed and variable monthly expenses with two examples each.',
      'Q3 (20 pts): Identify four warning signals of a financial scam.',
    ],
    answerKeysText: 'Q1: Year 1 = 1,100; Year 2 = 1,210 units. Q2: Fixed: rent, loan repayment; Variable: groceries, transport/utilities usage. Q3: Guaranteed extreme returns, artificial urgency, secrecy, requests for private keys/seed phrases or upfront fees.',
    examMarkingGuide: 'Verify compound calculation (1,210) and thorough fraud-prevention awareness.',
    pdfFileName: 'IFIOK_SCHOOL_Personal_Financial_Literacy.pdf',
  },
  {
    slug: 'ifiok-digital-marketing',
    title: 'Digital Marketing Fundamentals',
    subject: 'Digital Marketing & E-Commerce',
    category: 'Digital Marketing & E-Commerce',
    level: 'Beginner',
    durationHours: 14,
    pricePi: 2.5,
    description: 'Ethical growth and digital commerce fundamentals covering audience positioning, search intent (SEO), content funnels, email retention, and conversion analytics.',
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
    modulesNotes: [
      { topic: 'Intent-First SEO', notes: 'Answer real buyer questions clearly with clean headings, fast pages, accurate metadata, and zero keyword stuffing.' },
      { topic: 'Funnel Diagnostics', notes: 'If traffic is high but conversions are low, examine message-market mismatch, confusing pricing, or missing social/governance proof.' },
      { topic: 'Permission Marketing Ethics', notes: 'Never buy unsolicited email lists. Honor opt-outs immediately and represent product capabilities honestly.' },
    ],
    slidesResources: ['Digital Funnel & KPI Analytics Reference Guide (PDF)'],
    workbooksExercises: ['Campaign Audit & Conversion Math Worksheet'],
    assignments: ['Write an ethical SEO page outline + 3-email onboarding sequence for a real digital guide'],
    quizzes: ['SEO, Funnels & Analytics Quiz (10 questions)'],
    examQuestions: [
      'Q1 (15 pts): 2,000 impressions produce 80 clicks and 4 purchases. Compute CTR and visitor-to-buyer conversion rate.',
      'Q2 (15 pts): Explain why vanity social views without conversion quality can hurt a small business.',
      'Q3 (20 pts): List three on-page elements that improve organic search clarity.',
    ],
    answerKeysText: 'Q1: CTR = 80/2000 = 4.0%; Conversion Rate = 4/80 = 5.0%. Q2: Unqualified traffic inflates acquisition/support costs without sustainable revenue. Q3: Clear title tag & H1 matching query intent, structured subheadings, fast mobile accessibility.',
    examMarkingGuide: 'Check exact percentages on Q1 and actionable specificity on Q2–Q3.',
    pdfFileName: 'IFIOK_SCHOOL_Digital_Marketing_Fundamentals.pdf',
  },
  {
    slug: 'ifiok-web3-blockchain',
    title: 'Introduction to Web3 and Blockchain',
    subject: 'Web3, Blockchain & Pi Ecosystem',
    category: 'Web3, Blockchain & Pi Ecosystem',
    level: 'Intermediate',
    durationHours: 16,
    pricePi: 3.0,
    description: 'Vendor-neutral technical primer on cryptographic hashing, public-key signatures, distributed consensus, utility tokens, smart contracts, and wallet security.',
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
    modulesNotes: [
      { topic: 'Cryptography Before Coins', notes: 'Public keys verify digital signatures and receive transfers; private keys authorize spends. Never enter your 24-word passphrase into any website or chat form.' },
      { topic: 'Server-Verified Payment Architecture', notes: 'Client payment callbacks alone must never unlock paid goods. Always verify payment ID, amount, and TXID server-side against official blockchain/platform APIs.' },
      { topic: 'Evaluating Utility vs. Speculation', notes: 'Durable digital economies tie payment settlement to genuine products, education, services, and transparent dispute governance.' },
    ],
    slidesResources: ['Cryptography, Consensus & Wallet Safety Reference Deck (PDF)'],
    workbooksExercises: ['Payment Verification Flow Audit & Security Threat Checklist'],
    assignments: ['Diagram a secure 3-step Approve -> Sign -> Complete user-to-app payment flow'],
    quizzes: ['Cryptography, Consensus & Payment Security Quiz (12 questions)'],
    examQuestions: [
      'Q1 (15 pts): Why can a public address be shared openly while a passphrase must never be disclosed?',
      'Q2 (20 pts): Why must an app backend verify transaction IDs and exact amounts before unlocking digital files?',
      'Q3 (15 pts): Explain one real-world benefit and one limitation of immutable public ledgers.',
    ],
    answerKeysText: 'Q1: Public address only allows verification/receiving; passphrase derives private keys controlling all assets irreversibly. Q2: Client requests can be forged or replayed; server verification ensures authentic confirmed settlement and amount integrity. Q3: Benefit: tamper-evident auditability; Limitation: irreversible mistakes and privacy exposure.',
    examMarkingGuide: 'Focus strictly on security accuracy and clear architectural reasoning.',
    pdfFileName: 'IFIOK_SCHOOL_Introduction_to_Web3_Blockchain.pdf',
  },
  {
    slug: 'ifiok-professional-comm',
    title: 'Professional Communication',
    subject: 'Leadership, Governance & Ethics',
    category: 'Leadership, Governance & Ethics',
    level: 'Beginner',
    durationHours: 10,
    pricePi: 2.0,
    description: 'Workplace and cross-cultural communication skills covering active listening, structured briefing, meeting agendas, constructive feedback, and conflict resolution.',
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
    modulesNotes: [
      { topic: 'BLUF (Bottom Line Up Front)', notes: 'Start busy emails with the decision or action required, follow with key dates/facts, and put supporting background below.' },
      { topic: 'SBI Feedback Framework', notes: 'Describe the Situation, observable Behavior, and concrete Impact rather than judging character or assuming intent.' },
      { topic: 'Async & Cross-Cultural Respect', notes: 'Avoid unexplained idioms and specify UTC or local timezones clearly when scheduling international collaborators.' },
    ],
    slidesResources: ['Workplace Writing, Meetings & Feedback Playbook (PDF)'],
    workbooksExercises: ['10 Email Rewrite & Agenda Tightening Scenarios'],
    assignments: ['Rewrite a 300-word rambling update into a crisp 100-word BLUF project brief'],
    quizzes: ['Professional Communication & Feedback Quiz (10 questions)'],
    examQuestions: [
      'Q1 (20 pts): Draft a calm 100-word message updating a client on a 48-hour delivery delay with a concrete mitigation plan.',
      'Q2 (15 pts): Explain the three parts of the SBI feedback framework with an example.',
      'Q3 (15 pts): List four elements every productive meeting agenda must contain.',
    ],
    answerKeysText: 'Q1: Acknowledge delay early, state concrete cause neutrally, give exact revised delivery timestamp, offer review checkpoint. Q2: Situation (when/where), Behavior (observable action), Impact (measurable result). Q3: Goal, timed topics, required participants/owners, pre-read or expected decision.',
    examMarkingGuide: 'Score clarity, professionalism, accountability, and structural precision.',
    pdfFileName: 'IFIOK_SCHOOL_Professional_Communication.pdf',
  },
  {
    slug: 'ifiok-teacher-resource-course',
    title: 'Teacher Resource Pack',
    subject: 'Pedagogy & Teacher Training',
    category: 'Pedagogy & Teacher Training',
    level: 'Intermediate',
    durationHours: 12,
    pricePi: 0,
    description: 'Comprehensive educator methodology course and downloadable templates for lesson planning, formative assessment, grading rubrics, accessibility, and child safeguarding.',
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
    modulesNotes: [
      { topic: 'Backward Design', notes: 'Start with what students must demonstrate at the end of the lesson, build the assessment evidence next, then plan instructional examples and guided practice.' },
      { topic: 'Analytic Grading Rubrics', notes: 'Break marks into clear dimensions (e.g., accuracy, reasoning, clarity) so students understand how to improve rather than receiving arbitrary scores.' },
      { topic: 'Educator Safeguarding & Licensing', notes: 'Upload only original or properly licensed teaching resources. Never share identifiable student PII publicly or feed private student records into unverified tools.' },
    ],
    slidesResources: ['Educator Lesson Design, Rubric & Accessibility Guide (PDF)'],
    workbooksExercises: ['Customizable 45-Minute Lesson Plan & 4-Level Rubric Workshop'],
    assignments: ['Submit a complete lesson plan with 3 measurable outcomes and matching rubric'],
    quizzes: ['Pedagogy, Assessment & Safeguarding Quiz (10 questions)'],
    examQuestions: [
      'Q1 (15 pts): Explain Backward Design in three steps.',
      'Q2 (20 pts): Design a 3-criterion grading rubric totaling 30 points for a short student science report.',
      'Q3 (15 pts): State three non-negotiable child safeguarding practices for online classrooms.',
    ],
    answerKeysText: 'Q1: 1) Identify desired learning outcomes, 2) Determine acceptable assessment evidence, 3) Plan learning experiences/instruction. Q2: e.g., Evidence/Accuracy (12), Structure/Reasoning (10), Clarity/Citations (8). Q3: Consent for minors, zero public PII exposure, strict private communication boundaries.',
    examMarkingGuide: 'Evaluate alignment between objectives, rubric structure, and child safeguarding rigor.',
    pdfFileName: 'IFIOK_SCHOOL_Teacher_Resource_Pack.pdf',
  },
];

interface ProductBlueprint {
  title: string;
  category: string;
  marketSuite: string;
  pricePi: number;
  description: string;
  version: string;
  supportInfo: string;
  previewHighlights: string[];
  fileName: string;
  fileFormat: string;
  buildBuffer: () => Buffer;
  lockedSummary: string;
}

const PRODUCT_BLUEPRINTS: ProductBlueprint[] = [
  {
    title: 'IFIOK Business Starter Kit',
    category: 'Business Templates & Toolkits',
    marketSuite: 'business_professional_templates',
    pricePi: 6.0,
    version: '1.2.0',
    supportInfo: 'Includes PDF launch guide, Lean Canvas markdown worksheet, and operational checklist. 14-day verified Pi defect support.',
    description: 'Complete digital venture launch bundle containing a step-by-step Business Planning Guide (PDF), editable Lean Canvas template (MD), and Compliance & Launch Readiness Checklist (PDF).',
    previewHighlights: [
      'Business_Launch_Handbook.pdf — 4-section planning & validation guide',
      'Lean_Canvas_Worksheet.md — editable 9-block strategy worksheet',
      'Operations_Readiness_Checklist.pdf — licensing, banking & invoicing steps',
    ],
    fileName: 'IFIOK_Business_Starter_Kit_v1.2.zip',
    fileFormat: 'ZIP',
    lockedSummary: 'Unlocked Package: IFIOK Business Starter Kit v1.2.0 (.zip containing PDF Launch Handbook, Markdown Lean Canvas & Compliance Checklist). Download securely via your verified Vault link below.',
    buildBuffer: () =>
      buildValidZip([
        {
          name: '01_Business_Launch_Handbook.pdf',
          data: buildValidPdf({
            title: 'IFIOK Business Starter Kit — Launch Handbook',
            subtitle: 'Structured Venture Planning, Customer Validation & Operations Guide',
            author: 'IFIOK DIGITAL Publishing Team',
            date: PUB_DATE,
            rights: 'Single-Buyer Commercial Use License (IFIOK DIGITAL)',
            sections: [
              { heading: '1. Executive Clarity & Problem Definition', lines: ['Define the target customer segment, the specific recurring problem solved, and measurable alternatives currently used.', 'Avoid broad claims; document at least 10 customer conversations before committing fixed overhead.'] },
              { heading: '2. Revenue & Pricing Architecture', lines: ['Price based on delivered value and positive unit contribution margin.', 'Contribution Margin = Unit Price - Direct Variable Cost (fulfillment, payment fees, materials).'] },
              { heading: '3. 30-60-90 Day Launch Roadmap', lines: ['Days 1-30: Validate offer, register business name, set accounting ledger.', 'Days 31-60: Fulfill initial 10 orders, capture verified customer feedback, refine onboarding.', 'Days 61-90: Formalize SOPs, automate recurring invoicing, review monthly cashflow.'] },
            ],
          }),
        },
        {
          name: '02_Lean_Canvas_Worksheet.md',
          data: [
            '# IFIOK Business Starter Kit — Lean Canvas Worksheet',
            '',
            '## 1. Customer Segments',
            '- Primary Buyer Profile:',
            '- Early Adopters:',
            '',
            '## 2. Problem & Existing Alternatives',
            '- Top 3 Customer Pains:',
            '- How they solve it today:',
            '',
            '## 3. Unique Value Proposition',
            '- Clear single-sentence promise:',
            '',
            '## 4. Solution & Key Metrics',
            '- Core Deliverable:',
            '- Weekly KPIs Tracked:',
            '',
            '## 5. Cost Structure & Revenue Streams',
            '- Monthly Fixed Costs:',
            '- Unit Pricing & Margin:',
          ].join('\n'),
        },
        {
          name: '03_Launch_Compliance_Checklist.pdf',
          data: buildValidPdf({
            title: 'Operations & Compliance Readiness Checklist',
            subtitle: 'Essential Pre-Launch Verification Items',
            author: 'IFIOK DIGITAL Publishing Team',
            date: PUB_DATE,
            rights: 'Single-Buyer Commercial Use License (IFIOK DIGITAL)',
            sections: [
              { heading: 'Pre-Launch Checklist', lines: ['[ ] Business structure & local tax/registration filing confirmed', '[ ] Separate business accounting workbook / bank tracking initialized', '[ ] Written Terms of Sale, Refund Policy, and Privacy Notice published', '[ ] Digital backups configured (3-2-1 rule)'] },
            ],
          }),
        },
      ]),
  },
  {
    title: 'IFIOK Small Business Accounting Workbook',
    category: 'Accounting & Finance Workbooks',
    marketSuite: 'business_professional_templates',
    pricePi: 5.5,
    version: '1.1.0',
    supportInfo: 'Native .xlsx spreadsheet compatible with Excel, LibreOffice Calc & Google Sheets. 14-day Pi support.',
    description: 'Ready-to-use multi-sheet Excel/OOXML bookkeeping workbook featuring Income Ledger, Expense Tracker, Monthly Cashflow Summary, and Break-Even Calculator.',
    previewHighlights: [
      'Sheet 1: Financial_Summary — revenue, expenses, net margin & cash runway overview',
      'Sheet 2: Income_Ledger — structured invoice date, client, category & amount columns',
      'Sheet 3: Expense_Ledger — vendor, deductible category, tax note & payment method',
    ],
    fileName: 'IFIOK_Small_Business_Accounting_Workbook.xlsx',
    fileFormat: 'XLSX',
    lockedSummary: 'Unlocked Package: IFIOK Small Business Accounting Workbook (.xlsx multi-sheet OOXML spreadsheet). Open directly in Excel, Google Sheets, or LibreOffice Calc.',
    buildBuffer: () =>
      buildValidXlsx({
        sheets: [
          {
            name: 'Financial_Summary',
            rows: [
              ['IFIOK DIGITAL — Small Business Accounting Summary', 'Metric Value', 'Notes'],
              ['Reporting Period', 'Sample Year 2026', 'Update ledger sheets to populate your business figures'],
              ['Sample Gross Revenue', 4800, 'From Income_Ledger'],
              ['Sample Operating Expenses', 1950, 'From Expense_Ledger'],
              ['Net Operating Surplus', 2850, 'Revenue minus Operating Expenses'],
              ['Tax Reserve Target (15%)', 427.5, 'Set aside monthly in dedicated reserve'],
            ],
          },
          {
            name: 'Income_Ledger',
            rows: [
              ['Date', 'Invoice_No', 'Client_or_Channel', 'Category', 'Gross_Amount', 'Status'],
              ['2026-01-10', 'INV-001', 'Sample Retail Client A', 'Consulting', 1500, 'Paid'],
              ['2026-01-18', 'INV-002', 'Sample Training Cohort', 'Workshops', 2100, 'Paid'],
              ['2026-01-25', 'INV-003', 'Sample Digital Bundle', 'Digital Sales', 1200, 'Paid'],
            ],
          },
          {
            name: 'Expense_Ledger',
            rows: [
              ['Date', 'Receipt_Ref', 'Vendor', 'Category', 'Amount', 'Deductible'],
              ['2026-01-03', 'EXP-101', 'Cloud Hosting Provider', 'Infrastructure', 120, 'Yes'],
              ['2026-01-08', 'EXP-102', 'Office Supplies Co.', 'Operations', 330, 'Yes'],
              ['2026-01-20', 'EXP-103', 'Contract Bookkeeper', 'Professional Fees', 1500, 'Yes'],
            ],
          },
        ],
      }),
  },
  {
    title: 'IFIOK Professional CV Kit',
    category: 'CV & Career Kits',
    marketSuite: 'career_freelance_kits',
    pricePi: 4.0,
    version: '1.0.0',
    supportInfo: 'Editable Microsoft Word / Google Docs (.docx) CV, executive summary guide, and cover letter pack.',
    description: 'Clean, ATS-compatible Word (.docx) CV & Cover Letter template kit engineered for international job applications, with quantified achievement formulas and action verbs.',
    previewHighlights: [
      'ATS-friendly single-column layout without graphics that confuse parsers',
      'Quantified Experience Bullet Formula (Action Verb + Scope + Measurable Result)',
      'Structured Cover Letter template adaptable across tech, education & business',
    ],
    fileName: 'IFIOK_Professional_CV_Kit.docx',
    fileFormat: 'DOCX',
    lockedSummary: 'Unlocked Package: IFIOK Professional CV Kit (.docx). Edit placeholders directly in Microsoft Word, Google Docs, or LibreOffice Writer.',
    buildBuffer: () =>
      buildValidDocx({
        title: 'FULL NAME — TARGET ROLE TITLE',
        subtitle: 'City, Country | email@domain.com | +CountryCode Phone | Portfolio URL',
        sections: [
          {
            heading: 'PROFESSIONAL SUMMARY',
            paragraphs: [
              'Results-oriented [Your Role] with [X]+ years of experience delivering [Key Specialty 1] and [Key Specialty 2]. Proven record of improving [Metric] by [Y%] across cross-functional international teams.',
            ],
          },
          {
            heading: 'CORE COMPETENCIES & TOOLS',
            paragraphs: [
              'Technical / Domain Skills: [Skill 1] | [Skill 2] | [Skill 3] | [Skill 4]',
              'Collaboration & Languages: [Language 1 (Native)] | [Language 2 (Professional)]',
            ],
          },
          {
            heading: 'PROFESSIONAL EXPERIENCE',
            paragraphs: [
              '[Organization Name] — [Job Title] | [Month Year] – [Present]',
              '• Led [specific initiative] for [audience/team], achieving [quantifiable outcome % or time saved].',
              '• Streamlined [workflow/process] using [tool/method], reducing errors by [X%] within [timeframe].',
              '• Collaborated with [stakeholders] to deliver [milestone] ahead of deadline.',
            ],
          },
          {
            heading: 'EDUCATION & VERIFIED TRAINING',
            paragraphs: [
              '[Degree or Verified Certificate] — [Institution Name], [Year]',
            ],
          },
          {
            heading: 'COVER LETTER TEMPLATE',
            paragraphs: [
              'Dear Hiring Manager,',
              'I am writing to apply for the [Role Title] position at [Organization]. With hands-on experience in [Core Area], I recently [quantified achievement relevant to their team].',
              'In particular, your focus on [Company Goal] aligns strongly with my background in [Skill]. Thank you for your time and consideration.',
              'Sincerely, [Full Name]',
            ],
          },
        ],
      }),
  },
  {
    title: 'IFIOK Digital Marketing Kit',
    category: 'Digital Marketing Kits',
    marketSuite: 'marketing_growth_assets',
    pricePi: 5.0,
    version: '1.0.0',
    supportInfo: 'Downloadable PDF workbook with funnel audits, SEO checklists & 30-day content planner.',
    description: 'Practical digital growth toolkit for creators and SMEs containing SEO on-page checklists, conversion funnel audit sheets, campaign KPI calculators, and ethical email templates.',
    previewHighlights: [
      'On-Page SEO & Search Intent Audit Checklist',
      'Landing Page Messaging & Trust Block Blueprint',
      '30-Day Educational Content & Newsletter Calendar',
    ],
    fileName: 'IFIOK_Digital_Marketing_Kit.pdf',
    fileFormat: 'PDF',
    lockedSummary: 'Unlocked Package: IFIOK Digital Marketing Kit (PDF). Download from your Vault to access all checklists, copy templates, and KPI benchmarks.',
    buildBuffer: () =>
      buildValidPdf({
        title: 'IFIOK Digital Marketing Kit',
        subtitle: 'Ethical Growth Strategy, SEO Audit & Conversion Funnel Playbook',
        author: 'IFIOK DIGITAL Publishing Team',
        date: PUB_DATE,
        rights: 'Single-Buyer Business License (IFIOK DIGITAL)',
        sections: [
          { heading: '1. Search Intent & On-Page SEO Audit', lines: ['Match page H1, URL slug, and meta description to the exact problem buyers search.', 'Include descriptive image alt attributes, clean heading hierarchy, and concise FAQ answers.'] },
          { heading: '2. High-Trust Landing Structure', lines: ['Above the fold: Clear problem statement + outcome + direct call to action.', 'Proof section: Verified deliverables, transparent licensing, refund policy, and honest limitations.'] },
          { heading: '3. Campaign KPI Formulas', lines: ['CTR (%) = (Clicks / Impressions) x 100', 'Conversion Rate (%) = (Completed Orders / Landing Visits) x 100', 'CAC = Total Campaign Spend / New Paying Customers'] },
        ],
      }),
  },
  {
    title: 'IFIOK Mathematics Practice Pack',
    category: 'Education & Study Packs',
    marketSuite: 'digital_learning_publishing',
    pricePi: 3.5,
    version: '1.0.0',
    supportInfo: 'Structured multi-page PDF study pack with worked solutions & self-test key.',
    description: 'Graded mathematics drill workbook with 4 topic tiers (Arithmetic, Fractions & Ratios, Linear Algebra, Practical Geometry), step-by-step worked examples, and complete answer keys.',
    previewHighlights: [
      '40+ graded practice problems across 4 progressive difficulty levels',
      'Step-by-step worked solutions showing intermediate method steps',
      'Self-check formula sheet for exam & homework preparation',
    ],
    fileName: 'IFIOK_Mathematics_Practice_Pack.pdf',
    fileFormat: 'PDF',
    lockedSummary: 'Unlocked Package: IFIOK Mathematics Practice Pack (PDF). Includes drills, worked examples, and verified answer key.',
    buildBuffer: () =>
      buildValidPdf({
        title: 'IFIOK Mathematics Practice Pack',
        subtitle: 'Worked Examples, Topic Drills & Complete Answer Key',
        author: 'IFIOK-EN Mathematics Faculty',
        date: PUB_DATE,
        rights: 'Personal & Classroom Study License (IFIOK DIGITAL)',
        sections: [
          { heading: 'Set 1: Operations, Powers & Fractions', lines: ['1) Evaluate 48 / (4 x 3) + 7 = 4 + 7 = 11.', '2) Add 3/4 + 5/6 -> common denominator 12 -> 9/12 + 10/12 = 19/12 = 1 7/12.', '3) Express 0.375 as a percentage and reduced fraction: 37.5% and 3/8.'] },
          { heading: 'Set 2: Ratios & Percentages', lines: ['1) Share 180 units in ratio 2:3:4 -> 9 parts total -> 1 part = 20 -> shares are 40, 60, 80.', '2) Price rises from 80 to 92 -> increase 12 -> 12/80 = 15% increase.'] },
          { heading: 'Set 3: Linear Equations & Geometry', lines: ['1) Solve 5(y - 2) = 3y + 6 -> 5y - 10 = 3y + 6 -> 2y = 16 -> y = 8.', '2) Right triangle with base 12 cm and height 9 cm: Area = 0.5 x 12 x 9 = 54 sq cm.'] },
        ],
      }),
  },
  {
    title: 'IFIOK Computer Skills Guide',
    category: 'eBooks & Guides',
    marketSuite: 'digital_learning_publishing',
    pricePi: 3.0,
    version: '1.0.0',
    supportInfo: 'Printable PDF handbook covering essential desktop, spreadsheet & online safety workflows.',
    description: 'Accessible illustrated-structure PDF handbook teaching everyday file management, keyboard shortcuts, office documents, spreadsheet formulas, cloud hygiene, and phishing defense.',
    previewHighlights: [
      'Complete Keyboard Shortcut Reference for Windows, macOS & Browsers',
      'Essential Spreadsheet Formulas Guide (SUM, AVERAGE, IF, COUNTIF)',
      'Personal & Workplace Phishing + Password Hygiene Field Manual',
    ],
    fileName: 'IFIOK_Computer_Skills_Guide.pdf',
    fileFormat: 'PDF',
    lockedSummary: 'Unlocked Package: IFIOK Computer Skills Guide (PDF). Full reference manual ready in your Download Vault.',
    buildBuffer: () =>
      buildValidPdf({
        title: 'IFIOK Computer Skills Guide',
        subtitle: 'Practical Digital Literacy, Office Productivity & Cyber Safety Handbook',
        author: 'IFIOK DIGITAL Publishing Team',
        date: PUB_DATE,
        rights: 'Single-Buyer Personal Study License (IFIOK DIGITAL)',
        sections: [
          { heading: 'Chapter 1: Smart File & Folder Organization', lines: ['Use YYYY-MM-DD prefixes on dated documents so folders sort chronologically automatically.', 'Keep raw source files separate from exported PDF deliverables inside project subfolders.'] },
          { heading: 'Chapter 2: Essential Spreadsheet Productivity', lines: ['=SUM(A2:A20) totals values; =AVERAGE(A2:A20) computes mean; =IF(B2>=50,"Pass","Review") automates grading thresholds.'] },
          { heading: 'Chapter 3: Cybersecurity & Account Protection', lines: ['Verify exact website domain names before logging in. Enable authenticator-app 2FA and store recovery backups offline securely.'] },
        ],
      }),
  },
  {
    title: 'IFIOK Entrepreneurship Guide',
    category: 'Business Templates & Toolkits',
    marketSuite: 'business_professional_templates',
    pricePi: 4.5,
    version: '1.0.0',
    supportInfo: 'Comprehensive founder handbook in portable PDF format.',
    description: 'Step-by-step entrepreneurship field manual covering customer discovery questions, MVP testing, gross vs. net margin math, vendor contracts, and early hiring readiness.',
    previewHighlights: [
      '20 Non-Leading Customer Discovery Interview Questions',
      'Unit Economics, Break-Even & Working Capital Formula Sheet',
      'Operational Risk & Governance Checklist for Growing SMEs',
    ],
    fileName: 'IFIOK_Entrepreneurship_Guide.pdf',
    fileFormat: 'PDF',
    lockedSummary: 'Unlocked Package: IFIOK Entrepreneurship Guide (PDF). Complete founder manual ready for download.',
    buildBuffer: () =>
      buildValidPdf({
        title: 'IFIOK Entrepreneurship Guide',
        subtitle: 'From Problem Validation to Profitable Unit Economics',
        author: 'IFIOK DIGITAL Business Faculty',
        date: PUB_DATE,
        rights: 'Single-Buyer Business License (IFIOK DIGITAL)',
        sections: [
          { heading: '1. Validate Before Building', lines: ['Interview target users about the last time they faced the problem, what workaround cost them time/money, and who holds budget authority.'] },
          { heading: '2. Pricing & Cashflow Discipline', lines: ['Never confuse top-line revenue with cash profit. Track accounts receivable delays and keep 60+ days of operating buffer.'] },
          { heading: '3. Repeatable Customer Trust', lines: ['Publish clear turnaround timelines, invoice transparently, and treat customer support feedback as product R&D.'] },
        ],
      }),
  },
  {
    title: 'IFIOK Web3 Learning Pack',
    category: 'Tech & Web3 Learning Packs',
    marketSuite: 'web3_pi_ai_utilities',
    pricePi: 4.5,
    version: '1.0.0',
    supportInfo: 'Educational PDF pack on cryptography, consensus, wallet safety & Testnet architecture.',
    description: 'Technical and beginner-accessible Web3 study pack explaining cryptographic hashes, non-custodial wallets, consensus models, server-side payment verification, and Pi Testnet builder checklists.',
    previewHighlights: [
      'Visual Walkthrough: Hashing, Digital Signatures & Public Ledgers',
      'Wallet Seed Phrase Security & Scam Avoidance Rules',
      'Server-Verified Payment Security Architecture Blueprint',
    ],
    fileName: 'IFIOK_Web3_Learning_Pack.pdf',
    fileFormat: 'PDF',
    lockedSummary: 'Unlocked Package: IFIOK Web3 Learning Pack (PDF). Ready for offline reading and developer reference.',
    buildBuffer: () =>
      buildValidPdf({
        title: 'IFIOK Web3 Learning Pack',
        subtitle: 'Cryptography, Consensus, Security & Real Utility Ecosystems',
        author: 'IFIOK DIGITAL Web3 Education Desk',
        date: PUB_DATE,
        rights: 'Single-Buyer Educational License (IFIOK DIGITAL)',
        sections: [
          { heading: '1. Cryptographic Integrity', lines: ['SHA-256 produces a unique 64-character hex fingerprint for any file. Changing a single byte alters the entire hash digest.'] },
          { heading: '2. Custody & Passphrase Hygiene', lines: ['Your seed phrase generates your private signing keys. No legitimate administrator, moderator, or support agent will ever ask for it.'] },
          { heading: '3. Production Payment Security', lines: ['Always verify payment status, exact amount, and TXID server-side using official APIs before unlocking entitlements or shipping goods.'] },
        ],
      }),
  },
  {
    title: 'IFIOK Website Starter Kit',
    category: 'Website & Software Starter Kits',
    marketSuite: 'software_productivity',
    pricePi: 7.0,
    version: '1.0.0',
    supportInfo: 'Clean responsive HTML5 + CSS3 starter archive (.zip) with accessibility & SEO guide.',
    description: 'Production-ready static website starter archive (.zip) featuring semantic HTML5 landing page, responsive mobile-first CSS stylesheet, SEO metadata checklist, and deployment notes.',
    previewHighlights: [
      'index.html — Accessible semantic HTML5 business & portfolio layout',
      'styles.css — Clean CSS variables, dark-ready tokens & responsive grid',
      'README.md — SEO, performance & deployment checklist',
    ],
    fileName: 'IFIOK_Website_Starter_Kit.zip',
    fileFormat: 'ZIP',
    lockedSummary: 'Unlocked Package: IFIOK Website Starter Kit (.zip containing semantic index.html, styles.css, and README.md deployment guide).',
    buildBuffer: () =>
      buildValidZip([
        {
          name: 'index.html',
          data: [
            '<!doctype html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
            '  <title>Business Starter Site — Built with IFIOK Website Starter Kit</title>',
            '  <meta name="description" content="Clean responsive starter template for verified businesses and educators." />',
            '  <link rel="stylesheet" href="styles.css" />',
            '</head>',
            '<body>',
            '  <header class="container"><h1>Your Organization Name</h1><p>Clear value proposition and contact path.</p></header>',
            '  <main class="container"><section class="grid"><article><h2>Core Offering</h2><p>Describe deliverables and transparent pricing.</p></article><article><h2>Trust & Support</h2><p>Publish support email and refund policy.</p></article></section></main>',
            '  <footer class="container"><small>Licensed via IFIOK Website Starter Kit</small></footer>',
            '</body>',
            '</html>',
          ].join('\n'),
        },
        {
          name: 'styles.css',
          data: [
            ':root { --bg: #f8fafc; --ink: #0f172a; --accent: #0e1a36; }',
            '* { box-sizing: border-box; }',
            'body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; }',
            '.container { max-width: 960px; margin: 0 auto; padding: 1.5rem; }',
            '.grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }',
            'article { background: #fff; padding: 1.25rem; border: 1px solid #e2e8f0; border-radius: 10px; }',
          ].join('\n'),
        },
        {
          name: 'README.md',
          data: '# IFIOK Website Starter Kit v1.0.0\n\n1. Update `<title>` and meta description in `index.html`.\n2. Replace placeholder copy and verify contrast ratios.\n3. Deploy to any HTTPS static host.\n',
        },
      ]),
  },
  {
    title: 'IFIOK Teacher Resource Pack',
    category: 'Teacher & Classroom Resources',
    marketSuite: 'digital_learning_publishing',
    pricePi: 4.0,
    version: '1.0.0',
    supportInfo: 'Multi-format classroom pack (.zip) containing Lesson Plan (.docx), Rubric (.pdf), and Gradebook (.xlsx).',
    description: 'Complete educator toolkit (.zip) combining an editable Lesson Plan Template (.docx), Student Assessment & Safeguarding Rubric (.pdf), and Classroom Attendance & Gradebook Tracker (.xlsx).',
    previewHighlights: [
      'Editable_Lesson_Plan_Template.docx — Objectives, warm-up, instruction & assessment blocks',
      'Grading_Rubric_and_Safeguarding_Guide.pdf — 4-tier analytic rubric & classroom ethics',
      'Classroom_Gradebook_Attendance.xlsx — Term roster, attendance & weighted average sheets',
    ],
    fileName: 'IFIOK_Teacher_Resource_Pack.zip',
    fileFormat: 'ZIP',
    lockedSummary: 'Unlocked Package: IFIOK Teacher Resource Pack (.zip containing DOCX Lesson Plan, PDF Rubric & XLSX Gradebook).',
    buildBuffer: () =>
      buildValidZip([
        {
          name: 'Editable_Lesson_Plan_Template.docx',
          data: buildValidDocx({
            title: 'IFIOK SCHOOL — Structured Lesson Plan Template',
            subtitle: 'Subject: [Subject] | Grade / Level: [Grade] | Duration: [45 Minutes]',
            sections: [
              { heading: '1. Measurable Learning Objectives', paragraphs: ['By the end of this lesson, students will be able to: (a) ..., (b) ...'] },
              { heading: '2. Prior Knowledge & Accessibility Notes', paragraphs: ['Prerequisites needed and visual/reading accommodations provided.'] },
              { heading: '3. Lesson Sequence (Warm-Up / Direct Instruction / Practice / Exit Ticket)', paragraphs: ['0-10 min: Retrieval warm-up', '10-25 min: Worked modeling', '25-40 min: Guided group practice', '40-45 min: Formative exit check'] },
            ],
          }),
        },
        {
          name: 'Grading_Rubric_and_Safeguarding_Guide.pdf',
          data: buildValidPdf({
            title: 'Analytic Rubric & Educator Safeguarding Guide',
            subtitle: 'IFIOK DIGITAL Teacher Resource Pack Component',
            author: 'IFIOK-EN Pedagogy Desk',
            date: PUB_DATE,
            rights: 'Educator Classroom License (IFIOK DIGITAL)',
            sections: [
              { heading: '4-Level Analytic Rubric Framework', lines: ['Level 4 (90-100%): Complete accuracy, clear reasoning, verified citations.', 'Level 3 (75-89%): Solid understanding with minor procedural gaps.', 'Level 2 (60-74%): Partial mastery requiring targeted teacher feedback.', 'Level 1 (<60%): Needs foundational remediation and worked review.'] },
              { heading: 'Child Protection & Classroom Privacy', lines: ['Never expose student names or grades publicly. Obtain verifiable guardian consent for learners under 13.'] },
            ],
          }),
        },
        {
          name: 'Classroom_Gradebook_Attendance.xlsx',
          data: buildValidXlsx({
            sheets: [
              {
                name: 'Attendance_Roster',
                rows: [
                  ['Student_ID', 'Full_Name', 'Week_1_Present', 'Week_2_Present', 'Notes'],
                  ['STU-001', 'Sample Learner A', 5, 5, 'Full attendance'],
                  ['STU-002', 'Sample Learner B', 4, 5, '1 excused absence'],
                ],
              },
              {
                name: 'Assessment_Scores',
                rows: [
                  ['Student_ID', 'Quiz_1_Pct', 'Assignment_1_Pct', 'Exam_Pct', 'Overall_Average'],
                  ['STU-001', 88, 92, 90, 90],
                  ['STU-002', 76, 84, 82, 80.7],
                ],
              },
            ],
          }),
        },
      ]),
  },
];

export function seedOriginalCatalogIfNeeded(): void {
  const nowIso = new Date().toISOString();

  // 1. Ensure official non-interactive publishing faculty account exists
  const editorialEmail = 'editorial@ifiok-en.org';
  let facultyUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get(editorialEmail) as { id: number } | undefined;
  if (!facultyUser) {
    const randomHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
    const insUser = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, bio, country, timezone, account_type, status, email_verified)
      VALUES (?, ?, 'IFIOK-EN Editorial Faculty', 'Official curriculum authors and IFIOK DIGITAL publishing team.', 'Global', 'UTC', 'organisation', 'active', 1)
    `).run(editorialEmail, randomHash);
    facultyUser = { id: Number(insUser.lastInsertRowid) };
  }

  let facultyInstructor = db.prepare(`SELECT id, credentials FROM instructors WHERE user_id = ?`).get(facultyUser.id) as
    | { id: number; credentials: string }
    | undefined;
  if (!facultyInstructor) {
    const insInst = db.prepare(`
      INSERT INTO instructors (user_id, headline, bio, expertise, credentials, approval_status)
      VALUES (?, 'IFIOK SCHOOL Curriculum Team', 'Global educators developing verified, accessible multi-level courses and study packs.', 'STEM, Languages, Business, Computing & Pedagogy', 'IFIOK-EN Verified Curriculum Faculty', 'approved')
    `).run(facultyUser.id);
    facultyInstructor = { id: Number(insInst.lastInsertRowid), credentials: 'IFIOK-EN Verified Curriculum Faculty' };
  }

  let digitalSeller = db.prepare(`SELECT id FROM sellers WHERE user_id = ?`).get(facultyUser.id) as { id: number } | undefined;
  if (!digitalSeller) {
    const insSel = db.prepare(`
      INSERT INTO sellers (user_id, store_name, description, country, verification_status)
      VALUES (?, 'IFIOK DIGITAL Official Publishing', 'Authentic digital workbooks, templates, software starter kits, and study packs.', 'Global', 'verified')
    `).run(facultyUser.id);
    digitalSeller = { id: Number(insSel.lastInsertRowid) };
  }

  // 2. Seed / repair 12 Original 22-point IFIOK SCHOOL courses + binary PDF assets
  const getCourseBySlug = db.prepare(`SELECT id, course_files_json, completeness_score FROM courses WHERE slug = ?`);
  const insertCourse = db.prepare(`
    INSERT INTO courses (
      instructor_id, title, slug, category, subject, language_code, issuing_organization,
      level, duration_hours, price_pi, syllabus_json, description,
      learning_objectives_json, modules_notes_json, media_lesson_url, slides_resources_json,
      workbooks_exercises_json, assignments_json, quizzes_json, exam_questions_json, answer_keys_text,
      exam_marking_guide, instructor_qualifications_snapshot,
      prerequisites, target_audience, copyright_permission, certificate_criteria, course_files_json, completeness_score,
      approval_status, is_featured, source_origin, availability_status, last_verified_at, locked_materials_enc,
      author_name, publication_date, version, review_status, rights_info, curriculum_mapping
    ) VALUES (?, ?, ?, ?, ?, 'en', 'IFIOK SCHOOL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, 'IFIOK-EN Original Curriculum', 'available', ?, ?, 'IFIOK-EN Editorial Faculty', ?, '1.0.0', 'Published', ?, ?)
  `);

  for (const bp of COURSE_BLUEPRINTS) {
    const storageKey = `seed-course-${bp.slug}.pdf`;
    const diskPath = path.join(PRIVATE_ASSETS_DIR, storageKey);
    const pdfBuf = buildValidPdf({
      title: bp.title,
      subtitle: `${bp.subject} · Level: ${bp.level} · Estimated Duration: ${bp.durationHours} hours`,
      author: 'IFIOK-EN Editorial Faculty',
      date: PUB_DATE,
      rights: COURSE_RIGHTS,
      sections: [
        { heading: 'Course Overview & Prerequisites', lines: [bp.description, `Prerequisites: ${bp.prerequisites}`, `Target Learners: ${bp.targetAudience}`, `Curriculum Mapping Note: ${COURSE_MAPPING}`] },
        { heading: 'Learning Objectives', lines: bp.learningObjectives.map((o, i) => `${i + 1}. ${o}`) },
        ...bp.modulesNotes.map((m, i) => ({
          heading: `Module ${i + 1}: ${m.topic}`,
          lines: [m.notes],
        })),
        { heading: 'Practice Workbook & Assignments', lines: [...bp.workbooksExercises, ...bp.assignments] },
        { heading: 'Self-Check Quizzes & Final Examination Questions', lines: [...bp.quizzes, ...bp.examQuestions] },
        { heading: 'Verified Answer Keys & Marking Guide', lines: [bp.answerKeysText, `Marking Guide: ${bp.examMarkingGuide}`] },
      ],
    });
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).size === 0) {
      fs.writeFileSync(diskPath, pdfBuf, { mode: 0o600 });
    }
    const sha256 = crypto.createHash('sha256').update(pdfBuf).digest('hex');
    const courseFiles = [
      {
        storageKey,
        originalName: bp.pdfFileName,
        fileFormat: 'PDF',
        fileSizeBytes: pdfBuf.length,
        fileSha256: sha256,
      },
    ];

    const lockedMaterialsPlain = [
      `Course Study Pack Unlocked: ${bp.title}`,
      `Author: IFIOK-EN Editorial Faculty | Version: 1.0.0 | Publication Date: ${PUB_DATE}`,
      `Rights: ${COURSE_RIGHTS}`,
      `Mapping Note: ${COURSE_MAPPING}`,
      '',
      'Download the complete multi-page PDF study guide & answer key in the Encrypted Course Vault Files section below.',
    ].join('\n');

    const encryptedMaterials = encryptSensitive(lockedMaterialsPlain);
    const mediaUrl = `https://ifiok-en.vercel.app/#course-${bp.slug}`;

    const completeness = evaluateCourseCompleteness(
      {
        title: bp.title,
        description: bp.description,
        subject: bp.subject,
        category: bp.category,
        syllabus_json: bp.syllabus,
        learning_objectives_json: bp.learningObjectives,
        modules_notes_json: bp.modulesNotes,
        media_lesson_url: mediaUrl,
        locked_materials_enc: encryptedMaterials,
        slides_resources_json: bp.slidesResources,
        course_files_json: courseFiles,
        workbooks_exercises_json: bp.workbooksExercises,
        assignments_json: bp.assignments,
        quizzes_json: bp.quizzes,
        exam_questions_json: bp.examQuestions,
        answer_keys_text: bp.answerKeysText,
        exam_marking_guide: bp.examMarkingGuide,
        instructor_qualifications_snapshot: facultyInstructor.credentials,
        duration_hours: bp.durationHours,
        level: bp.level,
        language_code: 'en',
        prerequisites: bp.prerequisites,
        target_audience: bp.targetAudience,
        copyright_permission: COURSE_RIGHTS,
        certificate_criteria: 'Complete all 4 modules, practice assignments, and achieve >=70% on the assessment rubric.',
      },
      facultyInstructor
    );

    const existing = getCourseBySlug.get(bp.slug) as { id: number; course_files_json: string; completeness_score: number } | undefined;
    if (!existing) {
      insertCourse.run(
        facultyInstructor.id,
        bp.title,
        bp.slug,
        bp.category,
        bp.subject,
        bp.level,
        bp.durationHours,
        bp.pricePi,
        JSON.stringify(bp.syllabus),
        bp.description,
        JSON.stringify(bp.learningObjectives),
        JSON.stringify(bp.modulesNotes),
        mediaUrl,
        JSON.stringify(bp.slidesResources),
        JSON.stringify(bp.workbooksExercises),
        JSON.stringify(bp.assignments),
        JSON.stringify(bp.quizzes),
        JSON.stringify(bp.examQuestions),
        bp.answerKeysText,
        bp.examMarkingGuide,
        facultyInstructor.credentials,
        bp.prerequisites,
        bp.targetAudience,
        COURSE_RIGHTS,
        'Complete all 4 modules, practice assignments, and achieve >=70% on the assessment rubric.',
        JSON.stringify(courseFiles),
        completeness.score,
        nowIso,
        encryptedMaterials,
        PUB_DATE,
        COURSE_RIGHTS,
        COURSE_MAPPING
      );
    } else if (!existing.course_files_json || existing.course_files_json === '[]' || existing.completeness_score < 22) {
      db.prepare(`
        UPDATE courses SET course_files_json = ?, completeness_score = ?, review_status = 'Published', publication_date = ?
        WHERE id = ?
      `).run(JSON.stringify(courseFiles), completeness.score, PUB_DATE, existing.id);
    }
  }

  // 3. Seed / repair 10 Flagship IFIOK DIGITAL products across categories with real Vault binary downloads
  const getProductByTitle = db.prepare(`SELECT id, file_storage_key FROM products WHERE seller_id = ? AND title = ?`);
  const insertProduct = db.prepare(`
    INSERT INTO products (
      seller_id, title, category, market_suite, product_type, description, price_pi, stock_qty,
      approval_status, lifecycle_status, file_storage_key, file_original_name, file_format,
      file_size_bytes, file_sha256, malware_scan_status, version, preview_images_json, support_info,
      creator_ownership_attested, license_verified_at, file_verified_at, source_origin,
      distribution_permission, delivery_method, refund_support_terms, availability_status,
      last_verified_at, locked_content_enc
    ) VALUES (?, ?, ?, ?, 'digital', ?, ?, 999, 'approved', 'published', ?, ?, ?, ?, ?, 'clean_verified', ?, ?, ?, 1, ?, ?, 'IFIOK DIGITAL Official Publishing', 'Original IFIOK-EN Digital Product License — Single-Buyer Personal & Commercial Use', 'instant_digital_download', '14-day Pi Network verified defect & download support via ifiok82@gmail.com', 'available', ?, ?)
  `);

  for (const pb of PRODUCT_BLUEPRINTS) {
    const slugKey = pb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const storageKey = `seed-product-${slugKey}.${pb.fileFormat.toLowerCase()}`;
    const diskPath = path.join(PRIVATE_ASSETS_DIR, storageKey);
    const buf = pb.buildBuffer();
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).size === 0) {
      fs.writeFileSync(diskPath, buf, { mode: 0o600 });
    }
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

    const existingProd = getProductByTitle.get(digitalSeller.id, pb.title) as { id: number; file_storage_key: string } | undefined;
    if (!existingProd) {
      insertProduct.run(
        digitalSeller.id,
        pb.title,
        pb.category,
        pb.marketSuite,
        pb.description,
        pb.pricePi,
        storageKey,
        pb.fileName,
        pb.fileFormat,
        buf.length,
        sha256,
        pb.version,
        JSON.stringify(pb.previewHighlights),
        pb.supportInfo,
        nowIso,
        nowIso,
        nowIso,
        encryptSensitive(pb.lockedSummary)
      );
    } else if (!existingProd.file_storage_key) {
      db.prepare(`
        UPDATE products
        SET file_storage_key = ?, file_original_name = ?, file_format = ?, file_size_bytes = ?, file_sha256 = ?,
            malware_scan_status = 'clean_verified', lifecycle_status = 'published', preview_images_json = ?
        WHERE id = ?
      `).run(storageKey, pb.fileName, pb.fileFormat, buf.length, sha256, JSON.stringify(pb.previewHighlights), existingProd.id);
    }
  }

  // 4. Seed 6 official IFIOK-EN Freelance Services if missing
  const getServiceByTitle = db.prepare(`SELECT id FROM freelance_services WHERE freelancer_user_id = ? AND title = ?`);
  const insertService = db.prepare(`
    INSERT INTO freelance_services (
      freelancer_user_id, title, category, description, deliverables, credentials_summary,
      delivery_days, price_pi, approval_status, source_origin, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, 'available', ?)
  `);
  for (const svc of SEED_FREELANCE_SERVICES) {
    const existingSvc = getServiceByTitle.get(facultyUser.id, svc.title) as { id: number } | undefined;
    if (!existingSvc) {
      insertService.run(
        facultyUser.id,
        svc.title,
        svc.category,
        svc.description,
        svc.deliverables || '',
        svc.credentials_summary || '',
        svc.delivery_days,
        svc.price_pi,
        svc.source_origin || 'IFIOK-EN Official Service Desk',
        nowIso
      );
    }
  }

  // 5. Seed 4 official IFIOK-EN Opportunities if missing
  const getOppByTitle = db.prepare(`SELECT id FROM opportunities WHERE poster_user_id = ? AND title = ?`);
  const insertOpp = db.prepare(`
    INSERT INTO opportunities (
      poster_user_id, title, opportunity_type, organization_name, location, is_remote,
      compensation_or_award, deadline, description, requirements, eligibility, external_url,
      approval_status, source_origin, availability_status, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, 'available', ?)
  `);
  for (const opp of SEED_OPPORTUNITIES) {
    const existingOpp = getOppByTitle.get(facultyUser.id, opp.title) as { id: number } | undefined;
    if (!existingOpp) {
      insertOpp.run(
        facultyUser.id,
        opp.title,
        opp.opportunity_type,
        opp.organization_name,
        opp.location,
        opp.is_remote,
        opp.compensation_or_award,
        opp.deadline,
        opp.description,
        opp.requirements,
        opp.eligibility || '',
        opp.external_url,
        opp.source_origin || 'IFIOK-EN Official Program',
        nowIso
      );
    }
  }
}
