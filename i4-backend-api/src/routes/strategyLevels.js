'use strict';

const express = require('express');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');
const { recordAuditEvent } = require('./auditEvents');

const router = express.Router();
const VALID_DIMENSIONS = ['topdown', 'i4strategy', 'intercompany', 'workforce'];

// GET /api/assessments/:id/strategy-levels — คืนทั้ง 4 มิติ (ที่ยังไม่เคยบันทึกจะไม่อยู่ใน array)
router.get('/assessments/:id/strategy-levels', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const [rows] = await pool.query('SELECT * FROM strategy_levels WHERE assessment_id = ?', [id]);
  res.json(rows);
});

// PUT /api/assessments/:id/strategy-levels/:dimension — upsert
// body: { levels: [v1..v6], comment }
router.put('/assessments/:id/strategy-levels/:dimension', async (req, res) => {
  const { id, dimension } = req.params;
  assertUuid(id, 'id');
  if (!VALID_DIMENSIONS.includes(dimension)) {
    throw new HttpError(400, `dimension ต้องเป็นหนึ่งใน: ${VALID_DIMENSIONS.join(', ')}`);
  }
  const { levels, comment } = req.body || {};
  const lv = Array.isArray(levels) ? levels : [0, 0, 0, 0, 0, 0];
  const vals = [0, 1, 2, 3, 4, 5].map((i) => parseFloat(lv[i]) || 0);

  await pool.query(
    `INSERT INTO strategy_levels (assessment_id, dimension, level_1, level_2, level_3, level_4, level_5, level_6, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       level_1 = VALUES(level_1), level_2 = VALUES(level_2), level_3 = VALUES(level_3),
       level_4 = VALUES(level_4), level_5 = VALUES(level_5), level_6 = VALUES(level_6),
       comment = VALUES(comment)`,
    [id, dimension, ...vals, comment ?? null],
  );

  const [[row]] = await pool.query(
    'SELECT * FROM strategy_levels WHERE assessment_id = ? AND dimension = ?',
    [id, dimension],
  );
  await recordAuditEvent({ assessmentId: id, sheet: dimension, action: 'edit', target: dimension, userName: req.body?.updated_by });
  res.json(row);
});

module.exports = router;
