/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JalMitra Backend Server
 * Express.js API server for AI-powered groundwater & irrigation intelligence.
 */

import 'dotenv/config';
import express from 'express';
import advisoryRoutes from './routes/advisory.js';
import diagnosticRoutes from './routes/diagnostic.js';
import notificationRoutes from './routes/notification.js';
import telemetryRoutes from './routes/telemetry.js';
import committeeRoutes from './routes/committee.js';
import ttsRoutes from './routes/tts.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────
// CORS — allow frontend dev server
app.use((_req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  const origin = _req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Parse JSON bodies (up to 10MB for image uploads)
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/advisory', advisoryRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/tts', ttsRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'JalMitra Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE',
    timestamp: new Date().toISOString(),
  });
});

// ── Root ──────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'JalMitra API',
    description: 'AI-powered Groundwater & Irrigation Intelligence for Maharashtra Smallholder Farmers',
    endpoints: {
      health: 'GET /api/health',
      advisory: 'POST /api/advisory/generate',
      diagnostic: 'POST /api/diagnostic/analyze',
      notification: {
        dispatch: 'POST /api/notification/dispatch',
        log: 'GET /api/notification/log/:talukaId',
      },
      telemetry: {
        talukas: 'GET /api/telemetry/talukas',
        weather: 'GET /api/telemetry/weather/:talukaId',
      },
      committee: {
        submit: 'POST /api/committee/resolution',
        list: 'GET /api/committee/resolutions/:talukaId',
      },
    },
  });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║           🌾 JalMitra Backend Server 🌾          ║');
  console.log('  ║   AI Groundwater & Irrigation Intelligence API   ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ▸ Server:    http://localhost:${PORT}`);
  console.log(`  ▸ Health:    http://localhost:${PORT}/api/health`);
  console.log(`  ▸ Telemetry: http://localhost:${PORT}/api/telemetry/talukas`);
  console.log(`  ▸ Gemini AI: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? '✓ Configured' : '✗ Not configured (set GEMINI_API_KEY in .env)'}`);
  console.log('');
});

