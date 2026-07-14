'use strict';

const express = require('express');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');
const { recordAuditEvent } = require('./auditEvents');

const router = express.Router();

// GET /api/kpi-catalog — รายการ KPI คงที่ 15 ตัว (reference data, seed มาแล้วตอนสร้าง schema)
router.get('/kpi-catalog', async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM kpi_catalog ORDER BY category, name');
  res.json(rows);
});

// GET /api/assessments/:id/kpi-selections — คืนพร้อมข้อมูล catalog (join)
router.get('/assessments/:id/kpi-selections', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const [rows] = await pool.query(
    `SELECT s.id, s.assessment_id, s.kpi_id, s.rank_order, s.importance_level,
            c.name, c.name_th, c.category, c.icon
     FROM kpi_selections s JOIN kpi_catalog c ON c.id = s.kpi_id
     WHERE s.assessment_id = ? ORDER BY s.rank_order ASC`,
    [id],
  );
  res.json(rows);
});

// PUT /api/assessments/:id/kpi-selections — แทนที่ทั้งชุด (สูงสุด 5 ตัว ตาม flow เดิม)
// body: [{ kpi_id, rank_order, importance_level }, ...]
router.put('/assessments/:id/kpi-selections', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const items = Array.isArray(req.body) ? req.body : [];
  if (items.length > 5) throw new HttpError(400, 'เลือก KPI ได้สูงสุด 5 ตัว');
  items.forEach((it) => {
    if (!it.kpi_id) throw new HttpError(400, 'ต้องระบุ kpi_id ทุกรายการ');
    if (!(it.rank_order >= 1 && it.rank_order <= 5)) throw new HttpError(400, 'rank_order ต้องอยู่ระหว่าง 1-5');
    const lvl = it.importance_level ?? 5;
    if (!(lvl >= 1 && lvl <= 5)) throw new HttpError(400, 'importance_level ต้องอยู่ระหว่าง 1-5');
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM kpi_selections WHERE assessment_id = ?', [id]);
    for (const it of items) {
      await conn.query(
        `INSERT INTO kpi_selections (assessment_id, kpi_id, rank_order, importance_level) VALUES (?, ?, ?, ?)`,
        [id, it.kpi_id, it.rank_order, it.importance_level ?? 5],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new HttpError(400, 'kpi_id ที่ส่งมาไม่ตรงกับ kpi_catalog');
    }
    throw err;
  } finally {
    conn.release();
  }

  await recordAuditEvent({ assessmentId: id, sheet: 'kpi', action: 'edit', target: 'kpi-selections', userName: req.body?.updated_by });
  const [rows] = await pool.query('SELECT * FROM kpi_selections WHERE assessment_id = ? ORDER BY rank_order', [id]);
  res.json(rows);
});

// DELETE /api/assessments/:id/kpi-selections — ล้างทั้งหมด
router.delete('/assessments/:id/kpi-selections', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  await pool.query('DELETE FROM kpi_selections WHERE assessment_id = ?', [id]);
  res.status(204).end();
});

module.exports = router;
