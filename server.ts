import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import adminRoutes from './server/routes/admin.ts';
import authRoutes from './server/routes/auth.ts';
import dashboardRoutes from './server/routes/dashboard.ts';
import divisionRoutes from './server/routes/divisions.ts';
import paymentRoutes from './server/routes/payments.ts';

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
app.use(express.json({ limit: '1mb' }));
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

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/divisions', apiLimiter, divisionRoutes);
app.use('/api/payments', apiLimiter, paymentRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'IFIOK-EN', environment: 'testnet' });
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
