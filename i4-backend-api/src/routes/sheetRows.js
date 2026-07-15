'use strict';

const crypto = require('crypto');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');
const { SHEETS } = require('../config/sheets');
const { recordAuditEvent } = require('./auditEvents');

// ---- แปลงค่าจาก request body ตาม type ที่กำหนดไว้ใน config ----
function coerceValue(col, rawValue) {
  if (col.type === 'number') {
    const n = parseFloat(rawValue);
    return Number.isNaN(n) ? 0 : n;
  }
  if (col.type === 'bool') {
    return rawValue ? 1 : 0;
  }
  if (col.type === 'json') {
    return JSON.stringify(rawValue ?? col.default ?? null);
  }
  // text
  return rawValue === undefined || rawValue === null ? '' : String(rawValue);
}

// ---- แปลงค่าที่อ่านจาก DB กลับเป็น shape ที่ frontend ใช้ (bool จริงแทน 0/1) ----
function shapeRow(sheetConfig, row) {
  const out = { ...row };
  sheetConfig.columns.forEach((col) => {
    if (col.type === 'bool') {
      out[col.name] = !!out[col.name];
    } else if (col.type === 'json' && typeof out[col.name] === 'string') {
      // mysql2 บางเวอร์ชัน/บาง query mode คืน JSON column เป็น string ดิบ ไม่ auto-parse ให้
      try { out[col.name] = JSON.parse(out[col.name]); } catch (e) { /* เก็บ string เดิมไว้ถ้า parse ไม่ได้ */ }
    }
  });
  return out;
}

/**
 * ผูก endpoint CRUD ทั้ง 4 ตัวของ 1 ชีทเข้ากับ app โดยตรง (ไม่ใช้ sub-router/rewrite)
 *   GET    /api/assessments/:assessmentId/<urlSegment>
 *   POST   /api/assessments/:assessmentId/<urlSegment>
 *   PUT    /api/<urlSegment>/:rowUuid
 *   DELETE /api/<urlSegment>/:rowUuid
 */
function registerSheetRoutes(app, sheetKey) {
  const sheetConfig = SHEETS[sheetKey];
  if (!sheetConfig) throw new Error(`ไม่รู้จัก sheetKey: ${sheetKey}`);
  const { table, columns, urlSegment } = sheetConfig;

  const listPath = `/api/assessments/:assessmentId/${urlSegment}`;
  const itemPath = `/api/${urlSegment}/:rowUuid`;

  // ---- GET list ----
  app.get(listPath, async (req, res) => {
    const { assessmentId } = req.params;
    assertUuid(assessmentId, 'assessmentId');
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` WHERE assessment_id = ? ORDER BY row_order ASC, updated_at ASC`,
      [assessmentId],
    );
    res.json(rows.map((r) => shapeRow(sheetConfig, r)));
  });

  // ---- POST create ----
  app.post(listPath, async (req, res) => {
    const { assessmentId } = req.params;
    assertUuid(assessmentId, 'assessmentId');
    const body = req.body || {};

    let rowOrder = body.row_order;
    if (rowOrder === undefined || rowOrder === null) {
      const [[{ maxOrder }]] = await pool.query(
        `SELECT COALESCE(MAX(row_order), -1) AS maxOrder FROM \`${table}\` WHERE assessment_id = ?`,
        [assessmentId],
      );
      rowOrder = maxOrder + 1;
    }

    const newRowUuid = crypto.randomUUID();
    const colNames = ['row_uuid', 'assessment_id', 'row_order', ...columns.map((c) => c.name), 'updated_by'];
    const values = [
      newRowUuid,
      assessmentId,
      rowOrder,
      ...columns.map((c) => coerceValue(c, body[c.name])),
      body.updated_by || body.updatedBy || null,
    ];
    const placeholders = colNames.map(() => '?').join(', ');

    try {
      await pool.query(
        `INSERT INTO \`${table}\` (\`${colNames.join('`, `')}\`) VALUES (${placeholders})`,
        values,
      );
      const [[created]] = await pool.query(`SELECT * FROM \`${table}\` WHERE row_uuid = ?`, [newRowUuid]);
      await recordAuditEvent({
        assessmentId, sheet: sheetKey, action: 'add',
        target: created?.row_uuid, userName: body.updated_by || body.updatedBy,
      });
      res.status(201).json(shapeRow(sheetConfig, created));
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new HttpError(404, `ไม่พบ assessment id: ${assessmentId}`);
      }
      throw err;
    }
  });

  // ---- PUT update ----
  app.put(itemPath, async (req, res) => {
    const { rowUuid } = req.params;
    assertUuid(rowUuid, 'rowUuid');
    const body = req.body || {};

    const setClauses = [];
    const values = [];

    if (body.row_order !== undefined) {
      setClauses.push('row_order = ?');
      values.push(parseInt(body.row_order, 10) || 0);
    }
    columns.forEach((col) => {
      if (Object.prototype.hasOwnProperty.call(body, col.name)) {
        setClauses.push(`\`${col.name}\` = ?`);
        values.push(coerceValue(col, body[col.name]));
      }
    });
    if (setClauses.length === 0) {
      throw new HttpError(400, 'ไม่มีฟิลด์ให้อัปเดต');
    }
    setClauses.push('updated_by = ?');
    values.push(body.updated_by || body.updatedBy || null);
    values.push(rowUuid);

    const [result] = await pool.query(
      `UPDATE \`${table}\` SET ${setClauses.join(', ')} WHERE row_uuid = ?`,
      values,
    );
    if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบแถว row_uuid: ${rowUuid}`);

    const [[updated]] = await pool.query(`SELECT * FROM \`${table}\` WHERE row_uuid = ?`, [rowUuid]);
    await recordAuditEvent({
      assessmentId: updated.assessment_id, sheet: sheetKey, action: 'edit',
      target: rowUuid, userName: body.updated_by || body.updatedBy,
    });
    res.json(shapeRow(sheetConfig, updated));
  });

  // ---- DELETE ----
  app.delete(itemPath, async (req, res) => {
    const { rowUuid } = req.params;
    assertUuid(rowUuid, 'rowUuid');

    const [[existing]] = await pool.query(`SELECT assessment_id FROM \`${table}\` WHERE row_uuid = ?`, [rowUuid]);
    if (!existing) throw new HttpError(404, `ไม่พบแถว row_uuid: ${rowUuid}`);

    await pool.query(`DELETE FROM \`${table}\` WHERE row_uuid = ?`, [rowUuid]);
    await recordAuditEvent({
      assessmentId: existing.assessment_id, sheet: sheetKey, action: 'delete',
      target: rowUuid, userName: req.body?.updated_by || req.body?.updatedBy || req.query?.updatedBy,
    });
    res.status(204).end();
  });
}

function mountAllSheetRouters(app) {
  Object.keys(SHEETS).forEach((sheetKey) => registerSheetRoutes(app, sheetKey));
}

module.exports = { mountAllSheetRouters };
