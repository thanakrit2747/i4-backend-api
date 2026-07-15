# คู่มือติดตั้งระบบ Login + Role + People Management

ระบบนี้เพิ่ม **login บังคับ** ก่อนใช้งานเว็บได้ทั้งหมด + ระบบ role (Superuser/Admin/User) + หน้า
"People" จัดการผู้ใช้ ทดสอบผ่านแล้ว 26 test case (login, role permission, session, soft delete ฯลฯ)

---

## ขั้นที่ 1 — รัน migration บน MySQL (Aiven) ที่ใช้งานจริงอยู่

**ไม่ลบข้อมูลเดิมเลย** (production_rows, assessments ฯลฯ ที่มีอยู่ปลอดภัย 100%) — แค่ขยายตาราง
`users` เดิม (ที่ไม่เคยใช้งานจริง) ให้รองรับ login + เพิ่มตาราง `sessions` ใหม่

1. เปิด MySQL Workbench → connection "Aiven i4"
2. `File → Open SQL Script...` → เลือกไฟล์ `migration-002-auth.sql`
3. รันทั้งไฟล์ (ปุ่ม Execute SQL script)
4. เช็คว่ามีแถวหนึ่งใน `users` แล้ว (username `s6613031620139`, role `superuser`) — ยังไม่มี password
   ใช้งานได้ในขั้นนี้ (ตั้งรหัสในขั้นถัดไป)

## ขั้นที่ 2 — ตั้งรหัสผ่านให้ superuser คนแรก

ต้องรันจากเครื่องที่ต่อ MySQL (Aiven) ได้ — ใช้เครื่องเดิมที่เคยรัน `npm start` ทดสอบ local:

1. เปิด VS Code ที่โฟลเดอร์ `i4-backend-api`
2. แก้ไฟล์ `.env` ให้ชี้ไปที่ **Aiven** ชั่วคราว (ค่าเดียวกับที่ตั้งไว้ใน Render Environment Variables):
   ```
   DB_HOST=<host จาก Aiven>
   DB_PORT=<port จาก Aiven>
   DB_USER=avnadmin
   DB_PASSWORD=<password จาก Aiven>
   DB_NAME=defaultdb
   DB_SSL=true
   ```
3. เปิด Terminal ในโฟลเดอร์นั้น รัน:
   ```
   node scripts/set-password.js s6613031620139 ใส่รหัสผ่านที่ต้องการ
   ```
   ตัวอย่าง: `node scripts/set-password.js s6613031620139 MySecurePass2026`
4. เห็นข้อความ `✅ ตั้งรหัสผ่านให้ "s6613031620139" ... สำเร็จ` แปลว่าเรียบร้อย
5. **จดรหัสผ่านนี้ไว้ใช้ login** (นี่คือรหัสผ่านจริงที่จะใช้เข้าเว็บ)

> ใช้สคริปต์เดียวกันนี้ตั้ง/รีเซ็ตรหัสผ่านให้ใครก็ได้ในอนาคต แค่เปลี่ยน username ตัวแรก

## ขั้นที่ 3 — Push โค้ด backend ใหม่ขึ้น Render

เหมือนทุกรอบที่ผ่านมา — คัดลอกไฟล์ที่เปลี่ยน/เพิ่มใหม่ทั้งหมดไปที่โฟลเดอร์ที่เชื่อม GitHub:
```
src/db.js                      (แก้)
src/server.js                  (แก้ — เพิ่ม auth gate ให้ทุก endpoint)
src/middleware/auth.js         (ใหม่)
src/routes/auth.js             (ใหม่)
src/routes/users.js            (ใหม่)
src/utils/password.js          (ใหม่)
scripts/set-password.js        (ใหม่)
```
วิธีง่ายสุด: **ลบทั้งโฟลเดอร์ `src` และ `scripts` เดิมในโฟลเดอร์ที่เชื่อม Git ทิ้ง แล้วคัดลอกจากโฟลเดอร์
ที่เพิ่งแตก zip ใหม่ไปแทนทั้งหมด** (ชัวร์กว่าคัดลอกทีละไฟล์) จากนั้น commit + push ตามปกติ

## ขั้นที่ 4 — Deploy frontend ใหม่ขึ้น Netlify

ลากโฟลเดอร์ `i4-assessment-system` ใหม่ไปวางที่ "Production deploys" เหมือนทุกรอบที่ผ่านมา

## ขั้นที่ 5 — ทดสอบ

1. เปิดเว็บ (URL Netlify เดิม) — **ครั้งนี้ควรเจอหน้า Login ทันที** ไม่ใช่เว็บปกติ
2. กรอก username `s6613031620139` + รหัสผ่านที่ตั้งไว้ขั้นที่ 2 → เข้าสู่ระบบ
3. ควรเห็นเว็บตามปกติ + เมนู **"People"** โผล่ในแถบซ้าย (ใต้ Audit Trail) เพราะเป็น superuser
4. ลองกดเมนู People → "+ เพิ่มผู้ใช้" → สร้างบัญชีทดสอบ role `user` ดู
5. เปิด **Incognito** → login ด้วยบัญชีทดสอบนั้น → ไม่ควรเห็นเมนู People (role ธรรมดา)
6. ลอง logout (คลิกวิดเจ็ตมุมขวาบน → ออกจากระบบ) → ควรเด้งกลับหน้า login ทันที

## ข้อควรรู้

- **ลิงก์เดิมที่เคยส่งให้หัวหน้าใช้ไม่ได้แบบเดิมอีกต่อไป** ต้องมี username+password ก่อนเข้าได้ — ต้องสร้าง
  บัญชีให้หัวหน้าด้วยผ่านหน้า People (หรือให้หัวหน้าใช้บัญชี superuser ชั่วคราวก็ได้)
- Role มี 3 ระดับ: **Superuser** (สูงสุด จัดการทุกคนได้) > **Admin** (จัดการ user ธรรมดาได้ สร้าง/แก้ไม่ได้
  ถ้าสูงกว่าตัวเอง) > **User** (ใช้เว็บประเมินได้ปกติ จัดการคนอื่นไม่ได้)
- ห้ามลบ/ลดสิทธิ์บัญชีตัวเอง (กันล็อกตัวเองออกจากระบบ) — ต้องให้ superuser คนอื่นทำแทน
- Session อยู่ได้ 30 วันหลัง login (ไม่ต้อง login ใหม่ทุกครั้งที่เปิดเว็บ)
