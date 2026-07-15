'use strict';

const crypto = require('crypto');

const KEY_LEN = 64;

/** สร้าง hash จาก password แบบ "salt:hash" (hex) เก็บลง password_hash column */
function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

/** เทียบ password ที่กรอกกับ hash ที่เก็บไว้ — ใช้ timing-safe compare กัน timing attack */
function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hashHex] = storedHash.split(':');
  const hashBuffer = Buffer.from(hashHex, 'hex');
  const testBuffer = crypto.scryptSync(plainPassword, salt, KEY_LEN);
  if (hashBuffer.length !== testBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, testBuffer);
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 ตัวอักษร ตรงกับ sessions.token CHAR(64)
}

module.exports = { hashPassword, verifyPassword, randomToken };
