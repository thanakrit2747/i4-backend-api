'use strict';

const express = require('express');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');
const { recordAuditEvent } = require('./auditEvents');

const router = express.Router();

const VALID_METRIC_KEYS = [
  'ProductionAutomation', 'ProductionNetwork', 'SmartProduction',
  'EnterpriseAutomation', 'EnterpriseNetwork', 'SmartEnterprise',
  'FacilityAutomation', 'FacilityNetwork', 'SmartFacility',
  'InternalIntegration', 'ExternalIntegration',
  'MarketAnalysis', 'ProductLifeCycle',
  'TopDownManagement', 'I4Strategy', 'InterCompanyCollaboration', 'WorkforceLearning',
];

async function upsertOne(assessmentId, metricKey, score, rowCount) {
  await pool.query(
    `INSERT INTO dimension_scores (assessment_id, metric_key, score, row_count)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), row_count = VALUES(row_count)`,
    [assessmentId, metricKey, score, rowCount ?? null],
  );
}

// GET /api/assessments/:id/dimension-scores
router.get('/assessments/:id/dimension-scores', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const [rows] = await pool.query('SELECT * FROM dimension_scores WHERE assessment_id = ?', [id]);
  res.json(rows);
});

// PUT /api/assessments/:id/dimension-scores/:metricKey — บันทึกทีละมิติ
router.put('/assessments/:id/dimension-scores/:metricKey', async (req, res) => {
  const { id, metricKey } = req.params;
  assertUuid(id, 'id');
  if (!VALID_METRIC_KEYS.includes(metricKey)) {
    throw new HttpError(400, `metric_key ไม่ถูกต้อง ต้องเป็นหนึ่งใน 17 มิติที่กำหนด`);
  }
  const { score, row_count } = req.body || {};
  const s = parseFloat(score);
  if (Number.isNaN(s)) throw new HttpError(400, 'score ต้องเป็นตัวเลข');

  await upsertOne(id, metricKey, s, row_count);
  const [[row]] = await pool.query(
    'SELECT * FROM dimension_scores WHERE assessment_id = ? AND metric_key = ?',
    [id, metricKey],
  );
  res.json(row);
});

// PUT /api/assessments/:id/dimension-scores — บันทึกทีเดียวหลายมิติ
// body: [{ metric_key, score, row_count }, ...]
router.put('/assessments/:id/dimension-scores', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const items = Array.isArray(req.body) ? req.body : [];
  if (items.length === 0) throw new HttpError(400, 'ต้องส่ง array ของ {metric_key, score}');

  for (const item of items) {
    if (!VALID_METRIC_KEYS.includes(item.metric_key)) {
      throw new HttpError(400, `metric_key ไม่ถูกต้อง: ${item.metric_key}`);
    }
    const s = parseFloat(item.score);
    if (Number.isNaN(s)) throw new HttpError(400, `score ไม่ถูกต้องสำหรับ ${item.metric_key}`);
    await upsertOne(id, item.metric_key, s, item.row_count);
  }

  await recordAuditEvent({ assessmentId: id, sheet: 'dimension_scores', action: 'edit', target: 'bulk-save', userName: req.body?.updated_by });
  const [rows] = await pool.query('SELECT * FROM dimension_scores WHERE assessment_id = ?', [id]);
  res.json(rows);
});

module.exports = router;
