'use strict';

const mysql = require('mysql2/promise');

// managed MySQL อย่าง Aiven บังคับต่อผ่าน SSL — เปิดใช้ด้วย DB_SSL=true ใน .env
// (rejectUnauthorized: false เพราะไม่ได้ผูก CA cert file เฉพาะ — ยังเข้ารหัสการเชื่อมต่ออยู่
//  เหมาะกับงาน demo/prototype ถ้าจะขึ้น production จริงควรโหลด CA cert ของผู้ให้บริการมาผูกแทน)
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'i4_assessment',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // ให้ DATE/DATETIME กลับมาเป็น string ตรงๆ ไม่แปลงเป็น JS Date (กัน timezone เพี้ยน)
  decimalNumbers: true, // ให้คอลัมน์ DECIMAL กลับมาเป็น JS number จริง (1) ไม่ใช่ string ("1.000")
  // ถ้าเป็น string แล้วโค้ด frontend เอาไปบวกกัน (0 + "1.000") จะกลายเป็นการต่อข้อความแทนการบวกเลข
  // ทำให้คะแนน Band คำนวณผิดไปทั้งระบบ — จุดนี้สำคัญมาก ห้ามเอาออก
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, pingDb };
