'use strict';

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { HttpError, assertUuid } = require('../utils/httpError');

const router = express.Router();
const VALID_SHEETS = ['production', 'enterprise', 'facility', 'internal', 'external', 'market', 'plc'];

// GET /api/assessments/:id/comments?sheet=&row_uuid=&field=
router.get('/assessments/:id/comments', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const { sheet, row_uuid: rowUuid, field } = req.query;

  const where = ['assessment_id = ?'];
  const params = [id];
  if (sheet) { where.push('sheet_key = ?'); params.push(sheet); }
  if (rowUuid) { where.push('row_uuid = ?'); params.push(rowUuid); }
  if (field) { where.push('field_key = ?'); params.push(field); }

  const [rows] = await pool.query(
    `SELECT * FROM cell_comments WHERE ${where.join(' AND ')} ORDER BY created_at ASC`,
    params,
  );
  res.json(rows);
});

// POST /api/assessments/:id/comments
// body: { sheet_key, row_uuid, field_key, author, comment_text }
router.post('/assessments/:id/comments', async (req, res) => {
  const { id } = req.params;
  assertUuid(id, 'id');
  const { sheet_key: sheetKey, row_uuid: rowUuid, field_key: fieldKey, author, comment_text: commentText } = req.body || {};

  if (!VALID_SHEETS.includes(sheetKey)) throw new HttpError(400, `sheet_key ต้องเป็นหนึ่งใน: ${VALID_SHEETS.join(', ')}`);
  assertUuid(rowUuid, 'row_uuid');
  if (!fieldKey) throw new HttpError(400, 'ต้องระบุ field_key');
  if (!commentText || !String(commentText).trim()) throw new HttpError(400, 'ต้องระบุ comment_text');

  const newId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO cell_comments (id, assessment_id, sheet_key, row_uuid, field_key, author, comment_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId, id, sheetKey, rowUuid, fieldKey, author || 'ไม่ระบุชื่อ', commentText],
  );
  const [[created]] = await pool.query('SELECT * FROM cell_comments WHERE id = ?', [newId]);
  res.status(201).json(created);
});

// DELETE /api/comments/:commentId
router.delete('/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  assertUuid(commentId, 'commentId');
  const [result] = await pool.query('DELETE FROM cell_comments WHERE id = ?', [commentId]);
  if (result.affectedRows === 0) throw new HttpError(404, `ไม่พบ comment id: ${commentId}`);
  res.status(204).end();
});

module.exports = router;
