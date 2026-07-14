'use strict';

/*
 * Config ของ 7 ชีทตาราง (Production/Enterprise/Facility/Internal/External/Market/PLC)
 * คอลัมน์ต้องตรงกับ mysql-schema-proposal.sql เป๊ะๆ — ถ้าแก้ schema ต้องมาแก้ตรงนี้คู่กัน
 *
 * type:
 *   'text'   -> string, default ''
 *   'number' -> DECIMAL, default 0
 *   'bool'   -> TINYINT(1)/BOOLEAN, default false
 *   'json'   -> JSON column (ใช้กับ cyber security 10 checkbox เท่านั้น)
 */

const DEFAULT_CYBER = {
  hw: false, net: false, sw: false, hr: false, info: false,
  dataProt: false, backup: false, behavior: false, filter: false, other: false,
};

const SHEETS = {
  production: {
    table: 'production_rows',
    urlSegment: 'production-rows',
    labelColumn: 'name',
    columns: [
      { name: 'name', type: 'text' },
      // isProd/isSupport เป็น "number" (0 หรือ 1) ไม่ใช่ boolean — สูตรคำนวณ Band จริงใน
      // 26-production-rewrite.js/32-band-fix-production.js ใช้ parseFloat(r.isProd) ถ้าเป็น
      // boolean true/false จะได้ NaN แล้วคะแนนพังทั้งชีท (ตรวจพบจากบั๊กจริงตอน sync ข้ามเครื่อง)
      { name: 'is_prod', type: 'number' },
      { name: 'is_support', type: 'number' },
      { name: 'l5_manual', type: 'number' }, { name: 'l6_auto', type: 'number' }, { name: 'l7_semi', type: 'number' },
      { name: 'l8_sw_minutes', type: 'number' }, { name: 'l9_sw_manual', type: 'number' },
      { name: 'l10_sw_auto', type: 'number' }, { name: 'l11_link', type: 'number' },
      { name: 'n1', type: 'number' }, { name: 'n2', type: 'number' }, { name: 'n3', type: 'number' },
      { name: 'n4', type: 'number' }, { name: 'n5', type: 'number' }, { name: 'n6', type: 'number' },
      { name: 's1', type: 'number' }, { name: 's2', type: 'number' }, { name: 's3', type: 'number' },
      { name: 's4', type: 'number' }, { name: 's5', type: 'number' }, { name: 's6', type: 'number' },
      { name: 'wip25_manual', type: 'number' }, { name: 'wip26_auto', type: 'number' },
      { name: 'note27_detail', type: 'text' }, { name: 'note28_problem', type: 'text' },
      { name: 'note29_machine', type: 'text' }, { name: 'note30_other', type: 'text' },
      { name: 'note31_scada', type: 'text' }, { name: 'note32_no_scada', type: 'text' },
      { name: 'note33_protocol', type: 'text' },
      { name: 'cyber', type: 'json', default: DEFAULT_CYBER },
      { name: 'note44_other', type: 'text' },
      { name: 'note45_detect', type: 'text' }, { name: 'note46_problem', type: 'text' },
      { name: 'note47_other', type: 'text' },
    ],
  },

  enterprise: {
    table: 'enterprise_rows',
    urlSegment: 'enterprise-rows',
    labelColumn: 'dept',
    columns: [
      { name: 'dept', type: 'text' },
      { name: 'a1_excel', type: 'number' }, { name: 'a2_programs', type: 'number' }, { name: 'a3_erp', type: 'number' },
      { name: 'a4_auto_transfer', type: 'number' }, { name: 'a5_workflow', type: 'number' }, { name: 'a6_shopfloor', type: 'number' },
      { name: 'n1', type: 'number' }, { name: 'n2', type: 'number' }, { name: 'n3', type: 'number' },
      { name: 'n4', type: 'number' }, { name: 'n5', type: 'number' }, { name: 'n6', type: 'number' },
      { name: 's1', type: 'number' }, { name: 's2', type: 'number' }, { name: 's3', type: 'number' },
      { name: 's4', type: 'number' }, { name: 's5', type: 'number' }, { name: 's6', type: 'number' },
      { name: 'note21_software', type: 'text' }, { name: 'note22_input', type: 'text' }, { name: 'note23_other', type: 'text' },
      { name: 'note24_exchange', type: 'text' },
      { name: 'cyber', type: 'json', default: DEFAULT_CYBER },
      { name: 'note35_other', type: 'text' },
      { name: 'note36_detect', type: 'text' }, { name: 'note37_other', type: 'text' },
    ],
  },

  facility: {
    table: 'facility_rows',
    urlSegment: 'facility-rows',
    labelColumn: 'sys',
    columns: [
      { name: 'sys', type: 'text' },
      { name: 'a1_manual', type: 'number' }, { name: 'a23_auto', type: 'number' }, { name: 'a4_no_human', type: 'number' },
      { name: 'a5_expand', type: 'number' }, { name: 'a6_link', type: 'number' },
      { name: 'n1', type: 'number' }, { name: 'n2', type: 'number' }, { name: 'n3', type: 'number' },
      { name: 'n4', type: 'number' }, { name: 'n5', type: 'number' }, { name: 'n6', type: 'number' },
      { name: 's1', type: 'number' }, { name: 's2', type: 'number' }, { name: 's3', type: 'number' },
      { name: 's4', type: 'number' }, { name: 's5', type: 'number' }, { name: 's6', type: 'number' },
      { name: 'note20_log', type: 'text' }, { name: 'note21_onoff', type: 'text' },
      { name: 'note22_setpoint', type: 'text' }, { name: 'note23_other', type: 'text' },
      { name: 'note24_control_room', type: 'text' }, { name: 'note25_no_control_room', type: 'text' },
      { name: 'note26_protocol', type: 'text' }, { name: 'note27_problem', type: 'text' },
      { name: 'cyber', type: 'json', default: DEFAULT_CYBER },
      { name: 'note38_other', type: 'text' },
      { name: 'note39_detect', type: 'text' }, { name: 'note40_problem', type: 'text' }, { name: 'note41_other', type: 'text' },
    ],
  },

  internal: {
    table: 'internal_integration_rows',
    urlSegment: 'internal-integration-rows',
    labelColumn: 'sys',
    columns: [
      { name: 'sys', type: 'text' },
      { name: 'u1_no', type: 'number' }, { name: 'u2_yes', type: 'number' },
      { name: 'b1_not_defined', type: 'number' }, { name: 'b2_office', type: 'number' }, { name: 'b3_software', type: 'number' },
      { name: 'i1_manual', type: 'number' }, { name: 'i2_auto', type: 'number' }, { name: 'i3_analytics', type: 'number' },
      { name: 'note_software', type: 'text' }, { name: 'note_process', type: 'text' }, { name: 'note_other', type: 'text' },
    ],
  },

  external: {
    table: 'external_integration_rows',
    urlSegment: 'external-integration-rows',
    labelColumn: 'dept',
    columns: [
      { name: 'dept', type: 'text' },
      { name: 'p1_no', type: 'number' }, { name: 'p2_yes', type: 'number' },
      { name: 't1_analog', type: 'number' }, { name: 't2_digital', type: 'number' },
      { name: 'l3_no_link', type: 'number' }, { name: 'l4_exchange', type: 'number' }, { name: 'l5_auto', type: 'number' },
      { name: 'l6_yes', type: 'number' }, { name: 'l6_no', type: 'number' },
      { name: 'note_method', type: 'text' }, { name: 'note_other', type: 'text' },
    ],
  },

  market: {
    table: 'market_analysis_rows',
    urlSegment: 'market-analysis-rows',
    labelColumn: 'sys',
    columns: [
      { name: 'sys', type: 'text' },
      { name: 'p1_no', type: 'number' }, { name: 'p2_office', type: 'number' }, { name: 'p3_software', type: 'number' },
      { name: 'd1_experience', type: 'number' }, { name: 'd2_survey', type: 'number' }, { name: 'd3_tool', type: 'number' },
      { name: 'd4_search', type: 'number' }, { name: 'd5_bigdata', type: 'number' }, { name: 'd6_full', type: 'number' },
      { name: 'note_detail', type: 'text' }, { name: 'note_other', type: 'text' },
    ],
  },

  plc: {
    table: 'plc_rows',
    urlSegment: 'plc-rows',
    labelColumn: 'sys',
    columns: [
      { name: 'sys', type: 'text' },
      { name: 'u1_no', type: 'number' }, { name: 'u2_yes', type: 'number' },
      { name: 'p1_not_defined', type: 'number' }, { name: 'p2_office', type: 'number' }, { name: 'p3_software', type: 'number' },
      { name: 'i1_exchange', type: 'number' }, { name: 'i2_auto', type: 'number' }, { name: 'i3_analytics', type: 'number' },
      { name: 'note_software', type: 'text' }, { name: 'note_method', type: 'text' }, { name: 'note_other', type: 'text' },
    ],
  },
};

module.exports = { SHEETS, DEFAULT_CYBER };
