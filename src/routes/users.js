'use strict';

const express = require('express');
const { pool } = require('../db');
const { HttpError } = require('../utils/httpError');
const { hashPassword } = require('../utils/password');
const { requireAuth, requireRole, ROLE_RANK } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(u) {
  return {
    id: u.id, username: u.username, name: u.name, dept: u.dept, title: u.title, location: u.location,
    email: u.email, role: u.role, can_login: !!u.can_login, deleted_at: u.deleted_at,
    created_at: u.created_at, updated_at: u.updated_at,
  };
}

// ผู้ใช้ role ต่ำกว่าจะ "แต่งตั้ง/แก้ไข" คนที่มี role สูงกว่าตัวเองไม่ได้ (admin แก้ superuser ไม่ได้)
function assertCanManageRole(actorRole, targetRole) {
  if ((ROLE_RANK[targetRole] || 0) > (ROLE_RANK[actorRole] || 0)) {
    throw new HttpError(403, 'ไม่มีสิทธิ์กำหนด role ที่สูงกว่าของตัวเอง');
  }
}

// ทุก endpoint ในไฟล์นี้ต้อง login ก่อนเสมอ
router.use(requireAuth);

// GET /api/users?role=&deleted=true&can_login=false — ดูรายชื่อได้ทุกคนที่ login แล้ว
router.get('/users', async (req, res) => {
  const { role, deleted, can_login: canLogin } = req.query;
  const where = [];
  const params = [];
  where.push(deleted === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
  if (role) { where.push('role = ?'); params.push(role); }
  if (canLogin !== undefined) { where.push('can_login = ?'); params.push(canLogin === 'true' ? 1 : 0); }

  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY created_at ASC`,
    params,
  );
  res.json(rows.map(sanitizeUser));
});

// GET /api/users/:id
router.get('/users/:id', async (req, res) => {
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้นี้');
  res.json(sanitizeUser(user));
});

// POST /api/users — สร้างผู้ใช้ใหม่ (ต้องเป็น admin ขึ้นไป)
router.post('/users', requireRole('admin'), async (req, res) => {
  const { username, name, password, email, dept, title, location, role = 'user', can_login: canLogin = true } = req.body || {};
  if (!username || !username.trim()) throw new HttpError(400, 'ต้องระบุ username');
  if (!name || !name.trim()) throw new HttpError(400, 'ต้องระบุชื่อ-นามสกุล');
  if (!password || password.length < 6) throw new HttpError(400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  assertCanManageRole(req.user.role, role);

  try {
    const [result] = await pool.query(
      `INSERT INTO users (username, name, email, dept, title, location, role, can_login, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username.trim(), name.trim(), email || null, dept || null, title || null, location || null, role, !!canLogin, hashPassword(password)],
    );
    const [[created]] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(sanitizeUser(created));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'username หรือ email นี้ถูกใช้ไปแล้ว');
    throw err;
  }
});

// PUT /api/users/:id — แก้ไขข้อมูลผู้ใช้ (admin ขึ้นไปแก้คนอื่นได้, ทุกคนแก้ข้อมูลตัวเองได้ยกเว้น role/can_login)
router.put('/users/:id', async (req, res) => {
  const targetId = Number(req.params.id);
  const isSelf = req.user.id === targetId;
  const isManager = ROLE_RANK[req.user.role] >= ROLE_RANK.admin;
  if (!isSelf && !isManager) throw new HttpError(403, 'ไม่มีสิทธิ์แก้ไขผู้ใช้อื่น');

  const [[target]] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target) throw new HttpError(404, 'ไม่พบผู้ใช้นี้');

  const body = req.body || {};
  const setClauses = [];
  const values = [];

  // ฟิลด์ที่แก้ได้เอง (ตัวเองหรือ admin+)
  ['name', 'email', 'dept', 'title', 'location'].forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(body, f)) { setClauses.push(`${f} = ?`); values.push(body[f] || null); }
  });
  if (body.password) {
    if (body.password.length < 6) throw new HttpError(400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    setClauses.push('password_hash = ?'); values.push(hashPassword(body.password));
  }

  // ฟิลด์ที่แก้ได้เฉพาะ admin ขึ้นไป และห้ามแก้ role/can_login ของตัวเอง (กันล็อกตัวเองออก)
  if (isManager && !isSelf) {
    if (body.role !== undefined) {
      assertCanManageRole(req.user.role, body.role);
      assertCanManageRole(req.user.role, target.role); // ห้ามแก้คนที่ role สูงกว่าตัวเองด้วย
      setClauses.push('role = ?'); values.push(body.role);
    }
    if (body.can_login !== undefined) { setClauses.push('can_login = ?'); values.push(!!body.can_login); }
    if (body.username !== undefined) { setClauses.push('username = ?'); values.push(body.username.trim()); }
  }

  if (setClauses.length === 0) throw new HttpError(400, 'ไม่มีฟิลด์ให้อัปเดต');
  values.push(targetId);

  try {
    await pool.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, values);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'username หรือ email นี้ถูกใช้ไปแล้ว');
    throw err;
  }
  const [[updated]] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
  res.json(sanitizeUser(updated));
});

// DELETE /api/users/:id — soft delete (admin ขึ้นไป, ห้ามลบตัวเอง, ห้ามลบคน role สูงกว่า)
router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.id === targetId) throw new HttpError(400, 'ไม่สามารถลบบัญชีตัวเองได้');
  const [[target]] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target) throw new HttpError(404, 'ไม่พบผู้ใช้นี้');
  assertCanManageRole(req.user.role, target.role);

  await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [targetId]);
  await pool.query('DELETE FROM sessions WHERE user_id = ?', [targetId]); // เตะออกจากระบบทันที
  res.status(204).end();
});

// POST /api/users/:id/restore — กู้คืนจากที่ลบไป (admin ขึ้นไป)
router.post('/users/:id/restore', requireRole('admin'), async (req, res) => {
  const [[target]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) throw new HttpError(404, 'ไม่พบผู้ใช้นี้');
  assertCanManageRole(req.user.role, target.role);
  await pool.query('UPDATE users SET deleted_at = NULL WHERE id = ?', [req.params.id]);
  const [[updated]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(sanitizeUser(updated));
});

module.exports = router;
