'use strict';

const { pool } = require('../db');
const { HttpError } = require('../utils/httpError');

const ROLE_RANK = { user: 1, admin: 2, superuser: 3 };

/** ตรวจ token จาก header Authorization: Bearer <token> — ต้อง login อยู่ถึงจะผ่าน */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ (ไม่พบ token)');

    const [[session]] = await pool.query(
      `SELECT s.user_id, s.expires_at, u.id, u.username, u.name, u.email, u.role, u.can_login, u.deleted_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token],
    );
    if (!session) throw new HttpError(401, 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
      throw new HttpError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    if (session.deleted_at) throw new HttpError(403, 'บัญชีนี้ถูกปิดใช้งานแล้ว');
    if (!session.can_login) throw new HttpError(403, 'บัญชีนี้ถูกระงับการเข้าสู่ระบบ');

    req.user = { id: session.id, username: session.username, name: session.name, email: session.email, role: session.role };
    req.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/** ต้องมี role อย่างน้อยเท่ากับที่กำหนด (ใช้ต่อจาก requireAuth เสมอ) — เช่น requireRole('admin') ผ่านได้ทั้ง admin และ superuser */
function requireRole(minRole) {
  const minRank = ROLE_RANK[minRole] || 999;
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'กรุณาเข้าสู่ระบบ'));
    const userRank = ROLE_RANK[req.user.role] || 0;
    if (userRank < minRank) {
      return next(new HttpError(403, `ต้องมีสิทธิ์ระดับ ${minRole} ขึ้นไป`));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ROLE_RANK };
