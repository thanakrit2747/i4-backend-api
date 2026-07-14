'use strict';

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { assertUuid } = require('../utils/httpError');

const router = express.Router();

/**
 * บันทึก audit event — เรียกใช้จากทุกจุดที่มีการแก้ไขข้อมูล (sheetRows.js, assessments.js ฯลฯ)
 * ตั้งใจให้ "ไม่ throw" ออกไปทำลาย request หลัก ถ้าบันทึก audit ไม่สำเร็จ (เช่นเดียวกับพฤติกรรม
 * เดิมของ 11-audit-state.js ที่ recordAuditEvent ไม่เคยทำให้ flow หลักพัง)
 */
async function recordAuditEvent({ assessmentId, sheet, action, target, oldVal, newVal, userName, dept }) {
  if (!assessmentId) return;
  try {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO audit_events (id, assessment_id, user_name, dept, sheet, action, target, old_val, new_val)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        assessmentId,
        userName || 'ผู้ใช้ (ไม่ระบุ)',
        dept || null,
        sheet || '',
        action || 'edit',
        target ? String(target).substring(0, 255) : null,
        oldVal !== undefined && oldVal !== null ? String(oldVal).substring(0, 200) : null,
        newVal !== undefined && newVal !== null ? String(newVal).substring(0, 200) : null,
      ],
    );
  } catch (err) {
    console.error('[audit] บันทึก audit event ไม่สำเร็จ:', err.message);
  }
}

// GET /api/assessments/:assessmentId/audit-events?limit=500
router.get('/assessments/:assessmentId/audit-events', async (req, res) => {
  const { assessmentId } = req.params;
  assertUuid(assessmentId, 'assessmentId');
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 500);
  const [rows] = await pool.query(
    `SELECT * FROM audit_events WHERE assessment_id = ? ORDER BY created_at DESC LIMIT ?`,
    [assessmentId, limit],
  );
  res.json(rows);
});

// POST /api/assessments/:assessmentId/audit-events — บันทึกเองจากหน้าที่ไม่ใช่ 7 ชีทตาราง
// (เช่น Company Info, Strategy levels, KPI selection)
router.post('/assessments/:assessmentId/audit-events', async (req, res) => {
  const { assessmentId } = req.params;
  assertUuid(assessmentId, 'assessmentId');
  const { sheet, action, target, oldVal, newVal, userName, dept } = req.body || {};
  await recordAuditEvent({ assessmentId, sheet, action, target, oldVal, newVal, userName, dept });
  res.status(201).json({ ok: true });
});

module.exports = { router, recordAuditEvent };
