-- =====================================================================
-- i4.0 Insight System — Proposed MySQL Schema
-- ออกแบบจากการอ่านโค้ดจริงใน i4-assessment-system/js/*.js (47 ไฟล์)
-- แนวคิดหลัก: ทุกตารางผูกกับ assessments.id แทนการเก็บ flat state เดิม
-- ทุกตารางแถว (rows) มี row_uuid เป็น PK แทน DOM row index เดิม
-- ใช้ MySQL 8.0+ (รองรับ JSON column, CHECK constraint, UUID())
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 0. USERS (สำหรับ auth จริงในอนาคต — ปัจจุบันระบบเดิมไม่มี login จริง
--    AUDIT_STATE.user เก็บแค่ชื่อ/แผนกที่พิมพ์เองใน localStorage)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    dept            VARCHAR(150) NULL,
    title           VARCHAR(150) NULL,
    location        VARCHAR(150) NULL,
    role            ENUM('superuser','admin','user') NOT NULL DEFAULT 'user',
    can_login       BOOLEAN NOT NULL DEFAULT TRUE,
    email           VARCHAR(190) NULL UNIQUE,
    password_hash   VARCHAR(255) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
    token       CHAR(64)     NOT NULL PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 1. ASSESSMENTS — แทน APP_STATE.companyInfo + เป็น root ของทุกตาราง
--    (1 แถว = การประเมิน 1 บริษัท 1 ครั้ง/ปี — เดิมระบบมีแค่ 1 ชุด active
--    ตอนนี้ทำให้รองรับหลายชุดพร้อมกันได้จริง)
-- ---------------------------------------------------------------------
CREATE TABLE assessments (
    id                  CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    owner_user_id       INT UNSIGNED NULL,
    name_th             VARCHAR(255) NOT NULL,          -- companyInfo.nameTh (required)
    name_en             VARCHAR(255) NULL,
    scope               VARCHAR(500) NULL,               -- ขอบเขตการประเมิน (required)
    organization        VARCHAR(255) NULL,
    assess_date         DATE NULL,                       -- required
    business_desc       TEXT NULL,                       -- required, ใช้ auto-detect industry
    industry            VARCHAR(255) NULL,                -- required
    sector              VARCHAR(255) NULL,
    revenue             DECIMAL(18,2) NULL,
    enterprise_size     VARCHAR(50) NULL,                 -- Micro/Small/Medium/Large (คำนวณจาก revenue)
    assess_year_be      SMALLINT NULL,                    -- ปี พ.ศ. ที่ประเมิน (ใช้ใน Multi-Company/Dashboard)
    status              ENUM('draft','completed') NOT NULL DEFAULT 'draft',
    current_page        VARCHAR(50) NULL,                 -- APP_STATE.currentPage (ทางเลือก เก็บไว้ resume ตำแหน่ง)
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_assess_name_year (name_th, assess_year_be),
    INDEX idx_assess_industry (industry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. ASSESSORS — companyInfo.assessors.primary[] / assistant[]
-- ---------------------------------------------------------------------
CREATE TABLE assessment_assessors (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    type            ENUM('primary','assistant') NOT NULL,
    name            VARCHAR(255) NULL,
    position        VARCHAR(255) NULL,
    email           VARCHAR(190) NULL,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_assessor_assessment (assessment_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. ชีทตาราง 7 ชีท — แต่ละตารางแทน createEmptyXxxRow() ของแต่ละไฟล์
--    row_uuid = PK ถาวร (เดิมโค้ดใช้แค่ array index — ต้องมี id จริง
--    ก่อนถึงจะผูก cell_comments/reorder/delete ได้อย่างปลอดภัย)
-- ---------------------------------------------------------------------

-- 3.1 Production (05-production-state.js, 47 Excel cols)
CREATE TABLE production_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    is_prod         BOOLEAN NOT NULL DEFAULT FALSE,
    is_support      BOOLEAN NOT NULL DEFAULT FALSE,
    l5_manual       DECIMAL(8,3) NOT NULL DEFAULT 0,
    l6_auto         DECIMAL(8,3) NOT NULL DEFAULT 0,
    l7_semi         DECIMAL(8,3) NOT NULL DEFAULT 0,
    l8_sw_minutes   DECIMAL(8,3) NOT NULL DEFAULT 0,
    l9_sw_manual    DECIMAL(8,3) NOT NULL DEFAULT 0,
    l10_sw_auto     DECIMAL(8,3) NOT NULL DEFAULT 0,
    l11_link        DECIMAL(8,3) NOT NULL DEFAULT 0,
    n1 DECIMAL(8,3) NOT NULL DEFAULT 0, n2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n3 DECIMAL(8,3) NOT NULL DEFAULT 0, n4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n5 DECIMAL(8,3) NOT NULL DEFAULT 0, n6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s1 DECIMAL(8,3) NOT NULL DEFAULT 0, s2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s3 DECIMAL(8,3) NOT NULL DEFAULT 0, s4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s5 DECIMAL(8,3) NOT NULL DEFAULT 0, s6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    wip25_manual    DECIMAL(8,3) NOT NULL DEFAULT 0,
    wip26_auto      DECIMAL(8,3) NOT NULL DEFAULT 0,
    note27_detail   TEXT NULL, note28_problem TEXT NULL,
    note29_machine  TEXT NULL, note30_other TEXT NULL,
    note31_scada    TEXT NULL, note32_no_scada TEXT NULL, note33_protocol TEXT NULL,
    cyber           JSON NULL,   -- {hw,net,sw,hr,info,dataProt,backup,behavior,filter,other}
    note44_other    TEXT NULL,
    note45_detect   TEXT NULL, note46_problem TEXT NULL, note47_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_pd_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.2 Enterprise (06-enterprise-state.js, 37 cols)
CREATE TABLE enterprise_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    dept            VARCHAR(255) NOT NULL DEFAULT '',
    a1_excel        DECIMAL(8,3) NOT NULL DEFAULT 0,
    a2_programs     DECIMAL(8,3) NOT NULL DEFAULT 0,
    a3_erp          DECIMAL(8,3) NOT NULL DEFAULT 0,
    a4_auto_transfer DECIMAL(8,3) NOT NULL DEFAULT 0,
    a5_workflow     DECIMAL(8,3) NOT NULL DEFAULT 0,
    a6_shopfloor    DECIMAL(8,3) NOT NULL DEFAULT 0,
    n1 DECIMAL(8,3) NOT NULL DEFAULT 0, n2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n3 DECIMAL(8,3) NOT NULL DEFAULT 0, n4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n5 DECIMAL(8,3) NOT NULL DEFAULT 0, n6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s1 DECIMAL(8,3) NOT NULL DEFAULT 0, s2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s3 DECIMAL(8,3) NOT NULL DEFAULT 0, s4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s5 DECIMAL(8,3) NOT NULL DEFAULT 0, s6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    note21_software TEXT NULL, note22_input TEXT NULL, note23_other TEXT NULL,
    note24_exchange TEXT NULL,
    cyber           JSON NULL,
    note35_other    TEXT NULL,
    note36_detect   TEXT NULL, note37_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_ent_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.3 Facility (07-facility-state.js, 41 cols)
CREATE TABLE facility_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    sys             VARCHAR(255) NOT NULL DEFAULT '',
    a1_manual       DECIMAL(8,3) NOT NULL DEFAULT 0,
    a23_auto        DECIMAL(8,3) NOT NULL DEFAULT 0,
    a4_no_human     DECIMAL(8,3) NOT NULL DEFAULT 0,
    a5_expand       DECIMAL(8,3) NOT NULL DEFAULT 0,
    a6_link         DECIMAL(8,3) NOT NULL DEFAULT 0,
    n1 DECIMAL(8,3) NOT NULL DEFAULT 0, n2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n3 DECIMAL(8,3) NOT NULL DEFAULT 0, n4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    n5 DECIMAL(8,3) NOT NULL DEFAULT 0, n6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s1 DECIMAL(8,3) NOT NULL DEFAULT 0, s2 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s3 DECIMAL(8,3) NOT NULL DEFAULT 0, s4 DECIMAL(8,3) NOT NULL DEFAULT 0,
    s5 DECIMAL(8,3) NOT NULL DEFAULT 0, s6 DECIMAL(8,3) NOT NULL DEFAULT 0,
    note20_log      TEXT NULL, note21_onoff TEXT NULL,
    note22_setpoint TEXT NULL, note23_other TEXT NULL,
    note24_control_room TEXT NULL, note25_no_control_room TEXT NULL,
    note26_protocol TEXT NULL, note27_problem TEXT NULL,
    cyber           JSON NULL,
    note38_other    TEXT NULL,
    note39_detect   TEXT NULL, note40_problem TEXT NULL, note41_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_fac_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.4 Internal Integration (08-internal-integration-state.js, 12 cols)
CREATE TABLE internal_integration_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    sys             VARCHAR(255) NOT NULL DEFAULT '',
    u1_no           DECIMAL(8,3) NOT NULL DEFAULT 0,
    u2_yes          DECIMAL(8,3) NOT NULL DEFAULT 0,
    b1_not_defined  DECIMAL(8,3) NOT NULL DEFAULT 0,
    b2_office       DECIMAL(8,3) NOT NULL DEFAULT 0,
    b3_software     DECIMAL(8,3) NOT NULL DEFAULT 0,
    i1_manual       DECIMAL(8,3) NOT NULL DEFAULT 0,
    i2_auto         DECIMAL(8,3) NOT NULL DEFAULT 0,
    i3_analytics    DECIMAL(8,3) NOT NULL DEFAULT 0,
    note_software   TEXT NULL, note_process TEXT NULL, note_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_ii_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.5 External Integration (08-internal-integration-state.js, 12 cols)
CREATE TABLE external_integration_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    dept            VARCHAR(255) NOT NULL DEFAULT '',
    p1_no           DECIMAL(8,3) NOT NULL DEFAULT 0,
    p2_yes          DECIMAL(8,3) NOT NULL DEFAULT 0,
    t1_analog       DECIMAL(8,3) NOT NULL DEFAULT 0,
    t2_digital      DECIMAL(8,3) NOT NULL DEFAULT 0,
    l3_no_link      DECIMAL(8,3) NOT NULL DEFAULT 0,
    l4_exchange     DECIMAL(8,3) NOT NULL DEFAULT 0,
    l5_auto         DECIMAL(8,3) NOT NULL DEFAULT 0,
    l6_yes          DECIMAL(8,3) NOT NULL DEFAULT 0,
    l6_no           DECIMAL(8,3) NOT NULL DEFAULT 0,
    note_method     TEXT NULL, note_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_ei_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.6 Market Analysis (09-external-integration-state.js, 12 cols)
CREATE TABLE market_analysis_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    sys             VARCHAR(255) NOT NULL DEFAULT '',
    p1_no           DECIMAL(8,3) NOT NULL DEFAULT 0,
    p2_office       DECIMAL(8,3) NOT NULL DEFAULT 0,
    p3_software     DECIMAL(8,3) NOT NULL DEFAULT 0,
    d1_experience   DECIMAL(8,3) NOT NULL DEFAULT 0,
    d2_survey       DECIMAL(8,3) NOT NULL DEFAULT 0,
    d3_tool         DECIMAL(8,3) NOT NULL DEFAULT 0,
    d4_search       DECIMAL(8,3) NOT NULL DEFAULT 0,
    d5_bigdata      DECIMAL(8,3) NOT NULL DEFAULT 0,
    d6_full         DECIMAL(8,3) NOT NULL DEFAULT 0,
    note_detail     TEXT NULL, note_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_ma_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.7 Product Life Cycle (09-external-integration-state.js, 12 cols)
CREATE TABLE plc_rows (
    row_uuid        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    row_order       INT NOT NULL DEFAULT 0,
    sys             VARCHAR(255) NOT NULL DEFAULT '',
    u1_no           DECIMAL(8,3) NOT NULL DEFAULT 0,
    u2_yes          DECIMAL(8,3) NOT NULL DEFAULT 0,
    p1_not_defined  DECIMAL(8,3) NOT NULL DEFAULT 0,
    p2_office       DECIMAL(8,3) NOT NULL DEFAULT 0,
    p3_software     DECIMAL(8,3) NOT NULL DEFAULT 0,
    i1_exchange     DECIMAL(8,3) NOT NULL DEFAULT 0,
    i2_auto         DECIMAL(8,3) NOT NULL DEFAULT 0,
    i3_analytics    DECIMAL(8,3) NOT NULL DEFAULT 0,
    note_software   TEXT NULL, note_method TEXT NULL, note_other TEXT NULL,
    updated_by      VARCHAR(150) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_plc_assessment_order (assessment_id, row_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- flag noIntegration/noProcess ของ Internal/External/Market/PLC (checkbox ระดับชีท ไม่ใช่ระดับแถว)
ALTER TABLE assessments
    ADD COLUMN internal_no_integration BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN external_no_integration BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN market_no_process       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN plc_no_process          BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- 4. Strategy & Organization / Human Capital — 4 มิติ single-answer 6-level
--    (10-strategy-levels.js: TOPDOWN_STATE, I4_STATE, IC_STATE, WF_STATE)
-- ---------------------------------------------------------------------
CREATE TABLE strategy_levels (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    dimension       ENUM('topdown','i4strategy','intercompany','workforce') NOT NULL,
    level_1 DECIMAL(4,3) NOT NULL DEFAULT 0,
    level_2 DECIMAL(4,3) NOT NULL DEFAULT 0,
    level_3 DECIMAL(4,3) NOT NULL DEFAULT 0,
    level_4 DECIMAL(4,3) NOT NULL DEFAULT 0,
    level_5 DECIMAL(4,3) NOT NULL DEFAULT 0,
    level_6 DECIMAL(4,3) NOT NULL DEFAULT 0,
    comment         TEXT NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    UNIQUE KEY uq_strategy_dim (assessment_id, dimension)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. DIMENSION SCORES — คะแนน Band สุดท้าย (1-6) ของ 17 มิติ แบบ normalized
--    แทน productionScores/enterpriseScores/...(JSON กระจัดกระจาย) ของเดิม
--    *** ค่านี้ควร derive ได้จาก raw rows เสมอ (deterministic) — เก็บไว้
--    เป็น cache สำหรับ query เร็วเท่านั้น ไม่ใช่ source of truth ***
-- ---------------------------------------------------------------------
CREATE TABLE dimension_scores (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    metric_key      ENUM(
        'ProductionAutomation','ProductionNetwork','SmartProduction',
        'EnterpriseAutomation','EnterpriseNetwork','SmartEnterprise',
        'FacilityAutomation','FacilityNetwork','SmartFacility',
        'InternalIntegration','ExternalIntegration',
        'MarketAnalysis','ProductLifeCycle',
        'TopDownManagement','I4Strategy','InterCompanyCollaboration','WorkforceLearning'
    ) NOT NULL,
    score           DECIMAL(3,1) NOT NULL,     -- Band 1.0 - 6.0
    row_count       INT NULL,                  -- เฉพาะชีทตาราง (production/enterprise/facility)
    computed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    UNIQUE KEY uq_dim_score (assessment_id, metric_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. KPI Prioritisation — ของเดิมไม่เคย persist เลย (KPI_STATE ไม่อยู่ใน
--    PERSIST_KEYS) ออกแบบใหม่ทั้งหมดตรงนี้
-- ---------------------------------------------------------------------
CREATE TABLE kpi_catalog (
    id          VARCHAR(50) PRIMARY KEY,     -- ตรงกับ KPI_LIST[].id เดิม เช่น 'asset','ttm'
    name        VARCHAR(255) NOT NULL,
    name_th     VARCHAR(255) NOT NULL,
    category    VARCHAR(100) NOT NULL,       -- Efficiency / Quality & Assurance / Speed & Flexibility
    icon        VARCHAR(50) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kpi_selections (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    kpi_id          VARCHAR(50) NOT NULL,
    rank_order      TINYINT NOT NULL,          -- 1-5 (ลำดับที่เลือก)
    importance_level TINYINT NOT NULL DEFAULT 5, -- 1-5
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (kpi_id) REFERENCES kpi_catalog(id),
    UNIQUE KEY uq_kpi_assessment (assessment_id, kpi_id),
    CHECK (rank_order BETWEEN 1 AND 5),
    CHECK (importance_level BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- seed ข้อมูล KPI คงที่ 15 ตัว (จาก 16-foundation-config.js บรรทัด 912-931)
INSERT INTO kpi_catalog (id, name, name_th, category, icon) VALUES
('asset','Asset & Equipment Efficiency','ประสิทธิภาพสินทรัพย์และเครื่องจักร','Efficiency','precision_manufacturing'),
('workforce','Workforce Efficiency','ประสิทธิภาพแรงงาน','Efficiency','engineering'),
('utilities','Utilities Efficiency','ประสิทธิภาพพลังงานและสาธารณูปโภค','Efficiency','bolt'),
('inventory','Inventory Efficiency','ประสิทธิภาพคลังสินค้า','Efficiency','inventory_2'),
('materials','Materials Efficiency','ประสิทธิภาพการใช้วัตถุดิบ','Efficiency','category'),
('process_q','Process Quality','คุณภาพกระบวนการ','Quality & Assurance','checklist'),
('product_q','Product Quality','คุณภาพผลิตภัณฑ์','Quality & Assurance','verified'),
('safety','Safety','ความปลอดภัย','Quality & Assurance','health_and_safety'),
('security','Security','ความมั่นคงปลอดภัย (Cyber)','Quality & Assurance','security'),
('planning','Planning & Scheduling Effectiveness','ประสิทธิผลการวางแผนและจัดตาราง','Speed & Flexibility','schedule'),
-- หมายเหตุ: โค้ดปัจจุบันตั้งชื่อ "Product Flexibility" แต่ SIRI/คู่มือไทยใช้ "Production Flexibility"
-- (naming discrepancy ที่ทราบอยู่แล้ว) — แก้ให้ตรง spec ตอน seed ลง DB จริง
('prod_flex','Production Flexibility','ความยืดหยุ่นในผลิตภัณฑ์','Speed & Flexibility','tune'),
('workforce_flex','Workforce Flexibility','ความยืดหยุ่นของแรงงาน','Speed & Flexibility','diversity_3'),
('ttm','Time to Market','ระยะเวลาสู่ตลาด','Speed & Flexibility','rocket_launch'),
('loyalty','Customer Loyalty','ความภักดีของลูกค้า','Speed & Flexibility','favorite'),
('ttd','Time to Delivery','ระยะเวลาส่งมอบ','Speed & Flexibility','local_shipping');

-- ---------------------------------------------------------------------
-- 7. CELL COMMENTS (threaded) — 39-cell-comments-v2.js
--    เปลี่ยนจาก key แบบ "gridRoot::rowIndex::field" (DOM position) เดิม
--    เป็นการอ้าง row_uuid + sheet_key + field_key ตรงๆ
-- ---------------------------------------------------------------------
CREATE TABLE cell_comments (
    id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    sheet_key       ENUM('production','enterprise','facility','internal',
                          'external','market','plc') NOT NULL,
    row_uuid        CHAR(36) NOT NULL,   -- FK แบบ soft (อ้างถึง row_uuid ใน 7 ตารางข้างบน ตาราง sheet_key ไหนก็ตาม)
    field_key       VARCHAR(100) NOT NULL,
    author          VARCHAR(150) NOT NULL,
    comment_text    TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_cmt_cell (assessment_id, sheet_key, row_uuid, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. AUDIT TRAIL — 11-audit-state.js
-- ---------------------------------------------------------------------
CREATE TABLE audit_events (
    id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    assessment_id   CHAR(36) NOT NULL,
    user_name       VARCHAR(150) NOT NULL,
    dept            VARCHAR(150) NULL,
    sheet           VARCHAR(50) NOT NULL,
    action          ENUM('edit','add','delete','clear','seed') NOT NULL,
    target          VARCHAR(255) NULL,
    old_val         VARCHAR(200) NULL,
    new_val         VARCHAR(200) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    INDEX idx_audit_assessment_time (assessment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- หมายเหตุ: ไม่ต้องมีตาราง "database"/"multi-company history" แยกต่างหาก
-- อีกต่อไป — เพราะ assessments + dimension_scores ที่ query ข้าม
-- company_name/industry/assess_year_be ทำหน้าที่แทนได้ทั้งหมด (Master
-- Dashboard, Multi-Company Comparison, BIC Benchmark ใช้ query เดียวกันนี้)
-- ---------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 1;
