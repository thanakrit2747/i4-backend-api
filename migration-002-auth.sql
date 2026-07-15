-- =====================================================================
-- Migration 002: เพิ่มระบบ Login + Role + People Management
-- รันบน MySQL ที่มีข้อมูลอยู่แล้ว (Aiven) — ไม่ลบ/ไม่แตะตารางอื่นเลย
-- ปลอดภัย รันซ้ำได้ (ใช้ IF NOT EXISTS / ตรวจก่อนเพิ่มคอลัมน์)
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. ขยายตาราง users เดิม (มีอยู่แล้วแต่ว่างเปล่า ไม่เคยใช้งานจริง) ให้รองรับ
--    login จริง + role + people management
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN username    VARCHAR(100) NULL AFTER id,
    ADD COLUMN title       VARCHAR(150) NULL AFTER dept,
    ADD COLUMN location    VARCHAR(150) NULL AFTER title,
    ADD COLUMN role        ENUM('superuser','admin','user') NOT NULL DEFAULT 'user' AFTER location,
    ADD COLUMN can_login   BOOLEAN NOT NULL DEFAULT TRUE AFTER role,
    ADD COLUMN deleted_at  TIMESTAMP NULL AFTER created_at,
    ADD COLUMN updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER deleted_at,
    ADD UNIQUE KEY uq_username (username);

-- ---------------------------------------------------------------------
-- 2. ตาราง sessions — เก็บ token ตอน login (แทน JWT เพื่อความง่าย/revoke ได้ทันที)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    token       CHAR(64)     NOT NULL PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Seed superuser คนแรก — s6613031620139@email.kmutnb.ac.th
--    password_hash ใส่ตอนรัน script setup-superuser.js แยกต่างหาก (ดู README)
--    เพราะต้อง hash รหัสผ่านด้วยโค้ด ไม่ใช่ SQL ตรงๆ
-- ---------------------------------------------------------------------
INSERT INTO users (username, name, email, role, can_login)
VALUES ('s6613031620139', 'ผู้ดูแลระบบหลัก', 's6613031620139@email.kmutnb.ac.th', 'superuser', TRUE)
ON DUPLICATE KEY UPDATE role = 'superuser', can_login = TRUE;
