'use strict';
/**
 * ใช้ตั้ง/รีเซ็ตรหัสผ่านผู้ใช้แบบ command line (ตอนยังไม่มีใคร login เข้าไปตั้งเองได้)
 * วิธีใช้:  node scripts/set-password.js <username หรือ email> <รหัสผ่านใหม่>
 * ตัวอย่าง: node scripts/set-password.js s6613031620139 MySecurePass123
 */
require('dotenv').config();
const { pool } = require('../src/db');
const { hashPassword } = require('../src/utils/password');

async function main() {
  const [, , usernameOrEmail, newPassword] = process.argv;
  if (!usernameOrEmail || !newPassword) {
    console.error('วิธีใช้: node scripts/set-password.js <username หรือ email> <รหัสผ่านใหม่>');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    process.exit(1);
  }

  const [[user]] = await pool.query(
    'SELECT id, username, email, role FROM users WHERE username = ? OR email = ?',
    [usernameOrEmail, usernameOrEmail],
  );
  if (!user) {
    console.error(`ไม่พบผู้ใช้ที่มี username/email = "${usernameOrEmail}"`);
    console.error('ต้องรัน migration-002-auth.sql ก่อน (จะ seed superuser คนแรกให้อัตโนมัติ)');
    process.exit(1);
  }

  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), user.id]);
  console.log(`✅ ตั้งรหัสผ่านให้ "${user.username}" (${user.email}, role: ${user.role}) สำเร็จ`);
  process.exit(0);
}

main().catch((e) => { console.error('เกิดข้อผิดพลาด:', e.message); process.exit(1); });
