'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { pingDb } = require('./db');
const { HttpError } = require('./utils/httpError');
const { mountAllSheetRouters } = require('./routes/sheetRows');
const assessmentsRouter = require('./routes/assessments');
const strategyLevelsRouter = require('./routes/strategyLevels');
const dimensionScoresRouter = require('./routes/dimensionScores');
const kpiRouter = require('./routes/kpi');
const cellCommentsRouter = require('./routes/cellComments');
const { router: auditEventsRouter } = require('./routes/auditEvents');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// health check — ใช้เช็คว่า server + DB คุยกันได้
app.get('/api/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'unreachable', error: err.message });
  }
});

// ---- Routers ----
app.use('/api', assessmentsRouter);
app.use('/api', strategyLevelsRouter);
app.use('/api', dimensionScoresRouter);
app.use('/api', kpiRouter);
app.use('/api', cellCommentsRouter);
app.use('/api', auditEventsRouter);
mountAllSheetRouters(app); // production/enterprise/facility/internal/external/market/plc rows

// 404 สำหรับ path ที่ไม่ตรง route ใดเลยใน /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: `ไม่พบ endpoint: ${req.method} ${req.originalUrl}` });
});

// ---- Central error handler (Express 5 ส่ง async error เข้ามาที่นี่อัตโนมัติ) ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'ข้อมูลซ้ำ (unique constraint)', details: err.sqlMessage });
  }
  if (err.code && err.code.startsWith('ER_')) {
    console.error('[DB ERROR]', err.code, err.sqlMessage);
    return res.status(400).json({ error: 'คำขอไม่ถูกต้องตามโครงสร้างฐานข้อมูล', details: err.sqlMessage });
  }
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await pingDb();
    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');
  } catch (err) {
    console.error('⚠️  เชื่อมต่อ MySQL ไม่สำเร็จ — เช็คไฟล์ .env (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME):', err.message);
  }
  app.listen(PORT, () => {
    console.log(`🚀 i4 Backend API รันที่ http://localhost:${PORT}`);
    console.log(`   ลอง: http://localhost:${PORT}/api/health`);
  });
})();

module.exports = app;
