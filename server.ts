import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase } from './server/db.ts';
import { csrfOriginGuard } from './server/middleware/auth.ts';
import adminRoutes from './server/routes/admin.ts';
import aiRoutes from './server/routes/ai.ts';
import authRoutes from './server/routes/auth.ts';
import dashboardRoutes from './server/routes/dashboard.ts';
import divisionRoutes from './server/routes/divisions.ts';
import paymentRoutes from './server/routes/payments.ts';
import schoolRoutes from './server/routes/school.ts';
import uploadRoutes from './server/routes/uploads.ts';

dotenv.config();

initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please retry shortly.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', csrfOriginGuard);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/divisions', apiLimiter, divisionRoutes);
app.use('/api/payments', apiLimiter, paymentRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/uploads', apiLimiter, uploadRoutes);
app.use('/api/academy/ai', apiLimiter, aiRoutes);
app.use('/api/academy/schools', apiLimiter, schoolRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'IFIOK-EN', environment: 'testnet' });
});

function getBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured.startsWith('http')) {
    return configured.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type('text/plain');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Allow: /ifiok-school',
      'Allow: /school/student-portal',
      'Allow: /school/teacher-portal',
      'Allow: /school/admin-portal',
      'Allow: /school/guardian-portal',
      'Allow: /ifiok-professor',
      'Allow: /school/verify-certificate',
      'Allow: /business-hub',
      'Allow: /freelance',
      'Allow: /opportunities',
      'Allow: /market',
      'Allow: /community',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /dashboard',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const staticPaths = [
    '/',
    '/ifiok-school',
    '/school/student-portal',
    '/school/teacher-portal',
    '/school/admin-portal',
    '/school/guardian-portal',
    '/ifiok-professor',
    '/school/verify-certificate',
    '/business-hub',
    '/freelance',
    '/opportunities',
    '/market',
    '/community',
  ];

  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = staticPaths.map((p) => ({
    loc: `${baseUrl}${p}`,
    priority: p === '/' ? '1.0' : '0.8',
  }));

  const courses = db.prepare(`SELECT id, last_verified_at, created_at FROM courses WHERE approval_status = 'approved' LIMIT 100`).all() as Array<{
    id: number;
    last_verified_at: string | null;
    created_at: string;
  }>;
  for (const c of courses) {
    urls.push({
      loc: `${baseUrl}/ifiok-school?course=${c.id}`,
      lastmod: (c.last_verified_at || c.created_at).slice(0, 10),
      priority: '0.7',
    });
  }

  const businesses = db.prepare(`SELECT id, last_verified_at, created_at FROM business_profiles WHERE verification_status = 'verified' LIMIT 100`).all() as Array<{
    id: number;
    last_verified_at: string | null;
    created_at: string;
  }>;
  for (const b of businesses) {
    urls.push({
      loc: `${baseUrl}/business-hub?business=${b.id}`,
      lastmod: (b.last_verified_at || b.created_at).slice(0, 10),
      priority: '0.7',
    });
  }

  const products = db.prepare(`SELECT id, last_verified_at, created_at FROM products WHERE approval_status = 'approved' LIMIT 100`).all() as Array<{
    id: number;
    last_verified_at: string | null;
    created_at: string;
  }>;
  for (const p of products) {
    urls.push({
      loc: `${baseUrl}/market?product=${p.id}`,
      lastmod: (p.last_verified_at || p.created_at).slice(0, 10),
      priority: '0.7',
    });
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url><loc>${escXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`
    ),
    '</urlset>',
  ].join('\n');

  res.type('application/xml');
  res.send(xml);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IFIOK-EN server running on http://localhost:${PORT}`);
  });
}

startServer();
