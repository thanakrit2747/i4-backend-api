'use strict';

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');
const { recordAuditEvent } = require('./auditEvents');

const router = express.Router();

// ชื่อ Metric ที่แสดงผล (ตรงกับ buildMetricsFromState เดิมใน frontend) ผูกกับ metric_key ใน DB
const METRIC_LABELS = {
  ProductionAutomation: 'Production Automation',
  ProductionNetwork: 'Production Network',
  SmartProduction: 'Smart Production',
  EnterpriseAutomation: 'Enterprise Automation',
  EnterpriseNetwork: 'Enterprise Network',
  SmartEnterprise: 'Smart Enterprise',
  FacilityAutomation: 'Facility Automation',
  FacilityNetwork: 'Facility Network',
  SmartFacility: 'Smart Facility',
  InternalIntegration: 'Internal Integration',
  ExternalIntegration: 'External Integration',
  MarketAnalysis: 'Market Analysis',
  ProductLifeCycle: 'Product Life Cycle',
  TopDownManagement: 'Top-down Management',
  I4Strategy: 'i4.0 Strategy',
  InterCompanyCollaboration: 'Inter-company Collaboration',
  WorkforceLearning: 'Workforce Learning',
};

const COMPANY_FIELDS = [
  'name_th', 'name_en', 'scope', 'organization', 'assess_date', 'business_desc',
  'industry', 'sector', 'revenue', 'enterprise_size', 'assess_year_be', 'status', 'current_page',
  'internal_no_integration', 'external_no_integration', 'market_no_process', 'plc_no_process',
];

function pickCompanyFields(body) {
  const out = {};
  COMPANY_FIELDS.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
  });
  return out;
}

// GET /api/assessments?industry=&year=&include=scores
router.get('/assessments', async (req, res) => {
  const { industry, year, include } = req.query;
  const where = [];
  const params = [];
  if (industry) { where.push('industry = ?'); params.push(industry); }
  if (year) { where.push('assess_year_be = ?'); params.push(parseInt(year, 10)); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT * FROM assessments ${whereSql} ORDER BY updated_at DESC`,
    params,
  );

  if (include !== 'scores' || rows.length === 0) {
    return res.json(rows);
  }

  const ids = rows.map((r) => r.id);
  const [scoreRows] = await pool.query(
    `SELECT assessment_id, metric_key, score FROM dimension_scores WHERE assessment_id IN (?)`,
    [ids],
  );
  const scoresByAssessment = {};
  scoreRows.forEach((s) => {
    (scoresByAssessment[s.assessment_id] ||= []).push({
      Metric: METRIC_LABELS[s.metric_key] || s.metric_key,
      Score: Number(s.score),
    });
  });
  res.json(rows.map((r) => ({ ...r, metrics: scoresByAssessment[r.id] || [] })));
});

// GET /api/assessments/:id
router.get('/assessments/:id', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const [[assessment]] = await pool.query('SELECT * FROM assessments WHERE id = ?', [id]);
  if (!assessment) throw new HttpError(404, `ไม่พบ assessment id: ${id}`);

  const [assessors] = await pool.query(
    'SELECT * FROM assessment_assessors WHERE assessment_id = ? ORDER BY type, sort_order',
    [id],
  );
  res.json({ ...assessment, assessors });
});

// POST /api/assessments — สร้างการประเมินใหม่ (companyInfo)
router.post('/assessments', async (req, res) => {
  const body = req.body || {};
  if (!body.name_th || !String(body.name_th).trim()) {
    throw new HttpError(400, 'ต้องระบุ name_th (ชื่อบริษัทภาษาไทย)');
  }

  const fields = pickCompanyFields(body);
  const newId = crypto.randomUUID();
  const colNames = ['id', ...Object.keys(fields)];
  const values = [newId, ...Object.values(fields)];
  const placeholders = colNames.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO assessments (\`${colNames.join('`, `')}\`) VALUES (${placeholders})`,
    values,
  );
  const [[created]] = await pool.query('SELECT * FROM assessments WHERE id = ?', [newId]);

  // ถ้าส่ง assessors มาด้วยตอนสร้าง ให้ insert ต่อเลย
  if (Array.isArray(body.assessors)) {
    for (const a of body.assessors) {
      await pool.query(
        `INSERT INTO assessment_assessors (assessment_id, type, name, position, email, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [created.id, a.type === 'assistant' ? 'assistant' : 'primary', a.name || '', a.position || '', a.email || null, a.sort_order || 0],
      );
    }
  }

  await recordAuditEvent({ assessmentId: created.id, sheet: 'company', action: 'add', target: 'assessment', userName: body.updated_by });
  res.status(201).json(created);
});

// PUT /api/assessments/:id — แก้ไข company info
router.put('/assessments/:id', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const fields = pickCompanyFields(req.body || {});
  if (Object.keys(fields).length === 0) throw new HttpError(400, 'ไม่มีฟิลด์ให้อัปเดต');

  const setClauses = Object.keys(fields).map((k) => `\`${k}\` = ?`);
  const values = [...Object.values(fields), id];

  const [result] = await pool.query(
    `UPDATE assessments SET ${setClauses.join(', ')} WHERE id = ?`,
    values,
  );
  if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบ assessment id: ${id}`);

  const [[updated]] = await pool.query('SELECT * FROM assessments WHERE id = ?', [id]);
  await recordAuditEvent({ assessmentId: id, sheet: 'company', action: 'edit', target: 'companyInfo', userName: req.body?.updated_by });
  res.json(updated);
});

// DELETE /api/assessments/:id — ลบทั้งชุด (CASCADE ลบข้อมูลลูกทั้งหมดตาม schema)
router.delete('/assessments/:id', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const [result] = await pool.query('DELETE FROM assessments WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบ assessment id: ${id}`);
  res.status(204).end();
});

// ---- Assessors sub-resource ----

// POST /api/assessments/:id/assessors
router.post('/assessments/:id/assessors', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const { type, name, position, email, sort_order } = req.body || {};
  const [result] = await pool.query(
    `INSERT INTO assessment_assessors (assessment_id, type, name, position, email, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, type === 'assistant' ? 'assistant' : 'primary', name || '', position || '', email || null, sort_order || 0],
  );
  const [[created]] = await pool.query('SELECT * FROM assessment_assessors WHERE id = ?', [result.insertId]);
  res.status(201).json(created);
});

// PUT /api/assessors/:assessorId
router.put('/assessors/:assessorId', async (req, res) => {
  const { assessorId } = req.params;
  const { name, position, email, sort_order, type } = req.body || {};
  const setClauses = [];
  const values = [];
  if (name !== undefined) { setClauses.push('name = ?'); values.push(name); }
  if (position !== undefined) { setClauses.push('position = ?'); values.push(position); }
  if (email !== undefined) { setClauses.push('email = ?'); values.push(email); }
  if (sort_order !== undefined) { setClauses.push('sort_order = ?'); values.push(sort_order); }
  if (type !== undefined) { setClauses.push('type = ?'); values.push(type === 'assistant' ? 'assistant' : 'primary'); }
  if (setClauses.length === 0) throw new HttpError(400, 'ไม่มีฟิลด์ให้อัปเดต');
  values.push(assessorId);

  const [result] = await pool.query(`UPDATE assessment_assessors SET ${setClauses.join(', ')} WHERE id = ?`, values);
  if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบ assessor id: ${assessorId}`);
  const [[updated]] = await pool.query('SELECT * FROM assessment_assessors WHERE id = ?', [assessorId]);
  res.json(updated);
});

// DELETE /api/assessors/:assessorId
router.delete('/assessors/:assessorId', async (req, res) => {
  const { assessorId } = req.params;
  const [result] = await pool.query('DELETE FROM assessment_assessors WHERE id = ?', [assessorId]);
  if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบ assessor id: ${assessorId}`);
  res.status(204).end();
});

module.exports = router;
