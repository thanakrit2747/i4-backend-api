'use strict';

const express = require('express');
const { pool } = require('../db');
const { HttpError } = require('../utils/httpError');
const { verifyPassword, randomToken } = require('../utils/password');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SESSION_DAYS = 30;

function sanitizeUser(u) {
  return { id: u.id, username: u.username, name: u.name, dept: u.dept, title: u.title, email: u.email, role: u.role };
}

// POST /api/auth/login  { username, password }  — username เป็นได้ทั้ง username หรือ email
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'กรุณากรอก username และ password');

  const [[user]] = await pool.query(
    `SELECT * FROM users WHERE (username = ? OR email = ?) AND deleted_at IS NULL LIMIT 1`,
    [username, username],
  );
  if (!user) throw new HttpError(401, 'ไม่พบผู้ใช้นี้ในระบบ');
  if (!user.can_login) throw new HttpError(403, 'บัญชีนี้ถูกระงับการเข้าสู่ระบบ');
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, user.id, expiresAt]);

  res.json({ token, user: sanitizeUser(user) });
});

// POST /api/auth/logout — ต้อง login อยู่ก่อน
router.post('/auth/logout', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token = ?', [req.authToken]);
  res.status(204).end();
});

// GET /api/auth/me — เช็คว่า token ยังใช้ได้ไหม + คืนข้อมูลผู้ใช้ปัจจุบัน
router.get('/auth/me', requireAuth, async (req, res) => {
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json(sanitizeUser(user));
});

// PUT /api/auth/me/password — เปลี่ยนรหัสผ่านตัวเอง { currentPassword, newPassword }
router.put('/auth/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) throw new HttpError(400, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!verifyPassword(currentPassword || '', user.password_hash)) throw new HttpError(401, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  const { hashPassword } = require('../utils/password');
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
