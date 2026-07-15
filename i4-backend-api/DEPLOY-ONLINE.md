# คู่มือ Deploy ออนไลน์ฟรี — i4.0 Insight System

เป้าหมาย: ให้หัวหน้าเปิดดูผ่านลิงก์ได้จากที่ไหนก็ได้ ไม่ต้องเปิดคอมคุณค้างไว้

ใช้ 3 บริการฟรี (ไม่มีวันหมดอายุ ไม่ต้องใส่บัตรเครดิต):

| ส่วน | บริการ | หน้าที่ |
|---|---|---|
| Database | **Aiven** (aiven.io) | เก็บข้อมูล MySQL แทนเครื่องตัวเอง |
| Backend API | **Render** (render.com) | รัน `i4-backend-api` ให้ทำงาน 24 ชม. |
| Frontend | **Netlify** (netlify.com) | โฮสต์เว็บ `i4-assessment-system` |

**ข้อจำกัดที่ควรรู้ก่อนเริ่ม**: Render free tier จะ "หลับ" ถ้าไม่มีคนเข้าใช้ 15 นาที — เปิดเว็บครั้งแรกหลังจากหลับไปจะช้าประมาณ 30-60 วินาที (ต้องรอให้ server ตื่น) หลังจากนั้นจะเร็วปกติ ไม่เป็นปัญหาสำหรับ demo

---

## ขั้นที่ 1 — สร้าง Database บน Aiven

1. ไปที่ **aiven.io** → Sign up (กด "Sign up with GitHub" หรือ Google ได้เลย เร็วสุด ไม่ต้องใส่บัตร)
2. หลัง login เข้าหน้า Console → **Create service**
3. เลือก **MySQL** → เลือก **Free plan** (Hobbyist) → เลือก region ที่ใกล้ที่สุด (ถ้ามี Singapore เลือกอันนั้น)
4. ตั้งชื่อ service (เช่น `i4-db`) → **Create service** → รอสัก 2-3 นาทีจนสถานะเป็น 🟢 **Running**
5. คลิกเข้า service ที่สร้าง → แท็บ **Overview** จะมี **Connection Information**:
   - Host (เช่น `i4-db-xxxx.aivencloud.com`)
   - Port (เช่น `12345`)
   - User: `avnadmin`
   - Password (กดปุ่มตาเพื่อดู)
   - **จดทั้งหมดนี้ไว้ ใช้ในขั้นที่ 2**
6. สร้าง database ชื่อ `i4_assessment`: ในหน้า service เดียวกัน หาแท็บ **Databases and Tables** (หรือใช้ Query Editor ที่ Aiven มีให้) → สร้าง database ใหม่ชื่อ `i4_assessment`

### Import schema เข้า Aiven

เปิด **MySQL Workbench** ที่มีอยู่แล้ว → สร้าง connection ใหม่ (ไอคอน `+` ข้าง MySQL Connections):
- Connection Name: `Aiven i4`
- Hostname: (จากข้อ 5)
- Port: (จากข้อ 5)
- Username: `avnadmin`
- คลิก **Advanced** → แท็บ **SSL** → Use SSL: `Require`
- Test Connection (ใส่ password ตอนถาม) → ควรขึ้น "Successfully made the MySQL connection"

เชื่อมต่อเข้าไปแล้ว → เปิดไฟล์ `mysql-schema-proposal.sql` เดิม (ที่เคยรันตอน setup local) → เลือก schema `i4_assessment` เป็น default → รันทั้งไฟล์เหมือนที่เคยทำตอนติดตั้งเครื่องตัวเอง

---

## ขั้นที่ 2 — Deploy Backend บน Render

Render ต้อง deploy จาก **GitHub repo** — ถ้ายังไม่เคยมี repo ของโปรเจกต์นี้ ต้องสร้างก่อน:

### 2.1 Push โค้ด `i4-backend-api` ขึ้น GitHub
1. เปิด VS Code ที่โฟลเดอร์ `i4-backend-api`
2. คลิกไอคอน **Source Control** (แถบซ้าย รูปกิ่งไม้) → **Initialize Repository**
3. คลิก **Publish to GitHub** → เลือก **Publish to GitHub public/private repository** → ตั้งชื่อ repo เช่น `i4-backend-api`
4. รอ push เสร็จ (VS Code จะเปิดหน้า GitHub repo ให้อัตโนมัติ)

### 2.2 Deploy บน Render
1. ไปที่ **render.com** → Sign up ด้วย GitHub (เชื่อม repo อัตโนมัติ)
2. **New +** → **Web Service** → เลือก repo `i4-backend-api` ที่เพิ่ง push
3. ตั้งค่า:
   - **Name**: `i4-backend-api` (หรือชื่ออะไรก็ได้ จะกลายเป็นส่วนหนึ่งของ URL)
   - **Region**: Singapore ถ้ามี
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
4. เลื่อนลงหา **Environment Variables** → เพิ่มทีละตัว (ค่าจากขั้นที่ 1):
   ```
   DB_HOST     = <host จาก Aiven>
   DB_PORT     = <port จาก Aiven>
   DB_USER     = avnadmin
   DB_PASSWORD = <password จาก Aiven>
   DB_NAME     = i4_assessment
   DB_SSL      = true
   CORS_ORIGIN = http://localhost (ใส่ไปก่อน จะกลับมาแก้ในขั้นที่ 4)
   ```
   (ไม่ต้องใส่ `PORT` — Render กำหนดให้เองอัตโนมัติ โค้ดรองรับอยู่แล้ว)
5. **Create Web Service** → รอ build (สัก 2-3 นาที) จนขึ้น 🟢 **Live**
6. จะได้ URL แบบ `https://i4-backend-api-xxxx.onrender.com`
7. ทดสอบ: เปิด `https://i4-backend-api-xxxx.onrender.com/api/health` ในเบราว์เซอร์ ควรได้ `{"ok":true,"db":"connected",...}`

---

## ขั้นที่ 3 — Deploy Frontend บน Netlify

ง่ายสุดในสามขั้น ไม่ต้องมี GitHub ก็ได้:

1. ไปที่ **app.netlify.com/drop**
2. **ลากโฟลเดอร์ `i4-assessment-system` ทั้งโฟลเดอร์** วางลงในหน้าเว็บนั้นเลย (ลาก drag จาก File Explorer)
3. รอไม่กี่วินาที จะได้ URL แบบ `https://random-name-12345.netlify.app`
4. (แนะนำ) กด **Sign up** ทีหลังเพื่อผูก URL นี้กับบัญชี ไม่งั้นถ้าไม่ล็อกอินไซต์อาจถูกลบได้ถ้าไม่ได้ผูกบัญชีไว้ — สมัครฟรีด้วย GitHub/Google ก็ได้

---

## ขั้นที่ 4 — เชื่อมทุกอย่างเข้าด้วยกัน

### 4.1 อัปเดต CORS ที่ Render
กลับไปหน้า Render → service `i4-backend-api` → แท็บ **Environment** → แก้ `CORS_ORIGIN` เป็น URL ของ Netlify จริงจากขั้นที่ 3:
```
CORS_ORIGIN = https://random-name-12345.netlify.app
```
กด **Save Changes** → Render จะ redeploy ให้อัตโนมัติ (รอสัก 1-2 นาที)

### 4.2 บอกเว็บ (frontend) ว่า backend อยู่ที่ไหน
เปิดเว็บที่ URL ของ Netlify → กด **F12** เปิด Console → พิมพ์ (แทนด้วย URL ของ Render จริง):
```js
window.setBackendApiBase('https://i4-backend-api-xxxx.onrender.com/api')
```
กด Enter → **รีเฟรชหน้าเว็บ** — ค่านี้จะถูกจำไว้ในเบราว์เซอร์นั้นตลอด ไม่ต้องพิมพ์ซ้ำอีก

### 4.3 ทดสอบ
1. กรอกข้อมูลบริษัท + Production สักหน่อย
2. กด ☁️ → บันทึกทั้งหมด (รอนานกว่าปกตินิดหน่อยถ้าเป็นการเรียกครั้งแรก เพราะ Render กำลัง "ตื่น")
3. เช็ค MySQL ผ่าน Workbench (connection ที่ต่อ Aiven จากขั้นที่ 1) ว่าข้อมูลเข้าจริง

---

## สรุป URL ที่ต้องส่งให้หัวหน้า

**แค่ URL เดียว** — ลิงก์ Netlify จากขั้นที่ 3 (เช่น `https://random-name-12345.netlify.app`)
หัวหน้าไม่ต้องรู้เรื่อง Render/Aiven เลย เปิดลิงก์นี้ก็ใช้งานได้ทันที (แค่ครั้งแรกอาจรอ server ตื่นสัก 30-60 วิ)

## ถ้าเจอปัญหา
- เว็บเปิดได้แต่กดบันทึกไม่ขึ้นอะไร → เปิด Console (F12) เช็ค error, มักเป็นเรื่อง CORS_ORIGIN ที่ Render ไม่ตรงกับ URL Netlify เป๊ะๆ (ต้องตรงตัวอักษรทุกตัว รวม https://)
- Render ขึ้น "Deploy failed" → เข้าไปดู **Logs** ในหน้า Render จะบอก error ชัดเจน ส่งข้อความมาให้ดูได้
