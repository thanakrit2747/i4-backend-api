# i4 Backend API

REST API (Node.js + Express + MySQL) สำหรับ i4.0 Insight System — คุยกับฐานข้อมูลตาม
`mysql-schema-proposal.sql` (16 ตาราง) ที่ import เข้า MySQL Workbench ไปแล้ว

ทดสอบผ่านแล้ว 44/44 test case (CRUD ครบทุก endpoint, validation, cascade delete,
boolean/JSON coercion) ก่อนส่งมอบ

---

## 1. ติดตั้ง

ต้องมี **Node.js** (v18 ขึ้นไป) และฐานข้อมูล `i4_assessment` ที่สร้างไว้แล้วใน MySQL Workbench

```bash
cd i4-backend-api
npm install
```

## 2. ตั้งค่าเชื่อมต่อฐานข้อมูล

คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่าให้ตรงกับ MySQL Workbench ในเครื่อง:

```bash
cp .env.example .env       # Windows: copy .env.example .env
```

แก้ไฟล์ `.env`:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root                  # หรือ user อื่นที่ตั้งไว้
DB_PASSWORD=รหัสผ่าน MySQL ของคุณ
DB_NAME=i4_assessment
PORT=3001
CORS_ORIGIN=http://127.0.0.1:5500,http://localhost:5500
```

> **แนะนำ**: อย่าใช้ `root` ตรงๆ ใน production — สร้าง user แยกสำหรับ app:
> ```sql
> CREATE USER 'i4_app'@'%' IDENTIFIED BY 'เลือกรหัสผ่านเอง';
> GRANT ALL PRIVILEGES ON i4_assessment.* TO 'i4_app'@'%';
> FLUSH PRIVILEGES;
> ```

## 3. รัน

```bash
npm start
```

ถ้าขึ้น:
```
✅ เชื่อมต่อ MySQL สำเร็จ
🚀 i4 Backend API รันที่ http://localhost:3001
```
แปลว่าใช้งานได้แล้ว ลองเปิดเบราว์เซอร์ไปที่ `http://localhost:3001/api/health`
ควรได้ `{"ok":true,"db":"connected",...}`

(`npm run dev` = เหมือนกันแต่ auto-restart เวลาแก้โค้ด)

---

## 4. โครงสร้างโปรเจกต์

```
i4-backend-api/
├── src/
│   ├── server.js              ← entry point, ผูก middleware + router ทั้งหมด
│   ├── db.js                  ← mysql2 connection pool
│   ├── config/sheets.js       ← config คอลัมน์ของ 7 ชีทตาราง (Production...PLC)
│   ├── utils/httpError.js     ← HttpError class + UUID validator
│   └── routes/
│       ├── assessments.js     ← company info + assessors
│       ├── sheetRows.js       ← CRUD generic ของ 7 ชีทตาราง (ใช้ config/sheets.js)
│       ├── strategyLevels.js  ← Topdown/i4Strategy/InterCompany/Workforce
│       ├── dimensionScores.js ← คะแนน Band 17 มิติ
│       ├── kpi.js             ← KPI catalog + KPI selections
│       ├── cellComments.js    ← คอมเมนต์ threaded ต่อช่อง
│       └── auditEvents.js     ← audit trail + recordAuditEvent() ใช้ร่วมกับไฟล์อื่น
```

---

## 5. Endpoint ทั้งหมด

### Assessments (การประเมิน = company info)
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/api/assessments` | list ทั้งหมด — `?industry=&year=` filter ได้, `?include=scores` แนบ `metrics[]` (shape เดียวกับ `currentData.metrics` เดิม) |
| GET | `/api/assessments/:id` | 1 รายการ พร้อม `assessors[]` |
| POST | `/api/assessments` | สร้างใหม่ — ต้องมี `name_th`, ส่ง `assessors[]` แนบมาด้วยได้เลย |
| PUT | `/api/assessments/:id` | แก้ company info (partial update) |
| DELETE | `/api/assessments/:id` | ลบ — **CASCADE ลบทุกอย่างที่ผูกกับ assessment นี้ทั้งหมด** |

### Assessors
| Method | Path |
|---|---|
| POST | `/api/assessments/:id/assessors` |
| PUT | `/api/assessors/:assessorId` |
| DELETE | `/api/assessors/:assessorId` |

### 7 ชีทตาราง (Production/Enterprise/Facility/Internal/External/Market/PLC)
รูปแบบเดียวกันหมด แทน `<segment>` ด้วย: `production-rows`, `enterprise-rows`, `facility-rows`,
`internal-integration-rows`, `external-integration-rows`, `market-analysis-rows`, `plc-rows`

| Method | Path |
|---|---|
| GET | `/api/assessments/:id/<segment>` — list เรียงตาม row_order |
| POST | `/api/assessments/:id/<segment>` — เพิ่มแถว (ไม่ส่ง `row_order` มา = ต่อท้ายอัตโนมัติ) |
| PUT | `/api/<segment>/:rowUuid` — แก้ไข (partial update — ส่งเฉพาะ field ที่เปลี่ยน) |
| DELETE | `/api/<segment>/:rowUuid` |

ฟิลด์ `cyber` (เฉพาะ production/enterprise/facility) ส่ง/รับเป็น JSON object
`{hw,net,sw,hr,info,dataProt,backup,behavior,filter,other}` ตรงกับโค้ดเดิมเป๊ะ

### Strategy Levels (Topdown / i4Strategy / InterCompany / Workforce)
| Method | Path |
|---|---|
| GET | `/api/assessments/:id/strategy-levels` |
| PUT | `/api/assessments/:id/strategy-levels/:dimension` — `dimension` = `topdown`\|`i4strategy`\|`intercompany`\|`workforce`, body `{levels:[v1..v6], comment}` |

### Dimension Scores (คะแนน Band 1-6 ของ 17 มิติ)
| Method | Path |
|---|---|
| GET | `/api/assessments/:id/dimension-scores` |
| PUT | `/api/assessments/:id/dimension-scores/:metricKey` — body `{score, row_count}` |
| PUT | `/api/assessments/:id/dimension-scores` — บันทึกทีเดียวหลายมิติ, body = array `[{metric_key, score, row_count}]` |

`metricKey` ที่ใช้ได้ 17 ค่า: `ProductionAutomation, ProductionNetwork, SmartProduction,
EnterpriseAutomation, EnterpriseNetwork, SmartEnterprise, FacilityAutomation, FacilityNetwork,
SmartFacility, InternalIntegration, ExternalIntegration, MarketAnalysis, ProductLifeCycle,
TopDownManagement, I4Strategy, InterCompanyCollaboration, WorkforceLearning`

### KPI
| Method | Path |
|---|---|
| GET | `/api/kpi-catalog` | รายการ KPI คงที่ 15 ตัว |
| GET | `/api/assessments/:id/kpi-selections` | คืนพร้อม join ชื่อ/หมวดจาก catalog |
| PUT | `/api/assessments/:id/kpi-selections` | แทนที่ทั้งชุด (สูงสุด 5), body = array `[{kpi_id, rank_order, importance_level}]` |
| DELETE | `/api/assessments/:id/kpi-selections` | ล้างทั้งหมด |

### Cell Comments
| Method | Path |
|---|---|
| GET | `/api/assessments/:id/comments?sheet=&row_uuid=&field=` |
| POST | `/api/assessments/:id/comments` — body `{sheet_key, row_uuid, field_key, author, comment_text}` |
| DELETE | `/api/comments/:commentId` |

### Audit Events
| Method | Path |
|---|---|
| GET | `/api/assessments/:id/audit-events?limit=500` |
| POST | `/api/assessments/:id/audit-events` — บันทึกเองจากหน้าที่ไม่ใช่ 7 ชีทตาราง |

> หมายเหตุ: endpoint POST/PUT/DELETE ของ assessments/sheetRows/strategyLevels/dimensionScores/kpi
> จะเรียก `recordAuditEvent()` บันทึก audit trail ให้อัตโนมัติอยู่แล้ว ไม่ต้องยิง POST audit-events
> ซ้ำเอง ยกเว้นอยากบันทึก action พิเศษเพิ่มเติม

### Health check
`GET /api/health` → `{ok, db, time}` เช็คว่า server คุยกับ DB ได้จริง

---

## 6. ตัวอย่างการเรียกจาก Frontend (JS เดิม)

```js
const API_BASE = 'http://localhost:3001/api';

async function createAssessment(companyInfo) {
  const res = await fetch(`${API_BASE}/assessments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(companyInfo),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json(); // { id, name_th, ... }
}

async function addProductionRow(assessmentId, row) {
  const res = await fetch(`${API_BASE}/assessments/${assessmentId}/production-rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
  return res.json();
}
```

---

## 7. ข้อควรระวัง / ยังไม่ได้ทำในเวอร์ชันนี้

- **ยังไม่มี authentication/authorization จริง** — ทุก endpoint เปิดเข้าถึงได้หมด (ตรงกับที่ระบบเดิม
  ก็ไม่มี login จริงอยู่แล้ว) ถ้าจะ deploy จริงต้องเพิ่ม JWT/session ก่อน
- **คะแนน Band (dimension_scores) backend ไม่ได้คำนวณเอง** — endpoint แค่เก็บค่าที่ frontend
  คำนวณมาส่งให้ (ตามตรรกะเดิมใน `32-38-band-fix-*.js`) ยังไม่ได้ port สูตรคำนวณมาไว้ฝั่ง server
  (ถ้าต้องการ ให้บอกได้ — พอร์ตสูตร VDMA/resolveBand มาเป็น pure function ฝั่ง Node ได้)
- **rate limiting / request size limit** อยู่ระดับพื้นฐาน (`express.json({limit:'5mb'})`) เท่านั้น
- CORS เปิดเฉพาะ origin ใน `.env` (`CORS_ORIGIN`) — ถ้า deploy จริงต้องแก้เป็น domain จริง
