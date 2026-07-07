/**
 * Engineering code dictionaries extracted from DEVELOPMENT_PLAN.md.
 * Keep drawing-specific naming/code rules here so UI, validation and exporters
 * can share the same domain vocabulary.
 */

export type CodeDefinition = {
  code: string;
  zh: string;
  en?: string;
  note?: string;
};

export const materialCodes: CodeDefinition[] = [
  { code: 'PL', zh: '工艺液体' },
  { code: 'PG', zh: '工艺气体' },
  { code: 'CWS', zh: '32℃循环水上水' },
  { code: 'CWR', zh: '32℃循环水回水' },
  { code: 'RWS', zh: '冷冻水上水', note: '-15℃, 0.4MPa' },
  { code: 'RWR', zh: '冷冻水回水' },
  { code: 'LS', zh: '饱和蒸汽', note: '160℃, 0.5MPa' },
  { code: 'SC', zh: '蒸汽冷凝水' },
  { code: 'CA', zh: '压缩空气', note: '0.8MPa' },
  { code: 'IA', zh: '仪表空气', note: '0.8MPa' },
  { code: 'PW', zh: '自来水' },
  { code: 'SO', zh: '二氧化硫' },
  { code: '1N', zh: '氮气', note: '0.18MPa' },
  { code: 'VT', zh: '尾气放空' },
  { code: 'HS', zh: '软管站' },
  { code: 'EW', zh: '安全喷淋和洗眼器' },
  { code: 'HWS', zh: '热水上水', note: '90℃, 0.3MPa' },
  { code: 'HWR', zh: '热水回水', note: '90℃, 0.3MPa' },
  { code: 'BA', zh: '10%液碱' },
  { code: 'DMF', zh: 'DMF（待核对）' },
  { code: 'DCM', zh: 'DCM（待核对）' },
  { code: 'DW', zh: '低压水/冷却水（待核对）' },
  { code: 'WW', zh: '废水/循环水（待核对）' },
  { code: 'SG', zh: '硅氧烷/甘油（待核对）' },
  { code: 'TFA', zh: '三氟乙酸（待核对）' },
  { code: 'TFAK', zh: 'TFAK（待核对）' },
  { code: 'TFSK', zh: 'TFSK（待核对）' },
  { code: 'PS', zh: '压缩空气支线（待核对）' },
];

export const pipePressureCodes: CodeDefinition[] = [
  { code: 'L', zh: '1.0MPa' },
  { code: 'M', zh: '1.6MPa' },
  { code: 'N', zh: '2.5MPa' },
  { code: 'P', zh: '4.0MPa' },
];

export const insulationCodes: CodeDefinition[] = [
  { code: 'H', zh: '保温' },
  { code: 'C', zh: '保冷' },
  { code: 'P', zh: '防烫' },
  { code: 'B', zh: '蒸汽伴热' },
  { code: 'J', zh: '夹套管热水或蒸汽伴热' },
  { code: 'E', zh: '电伴热' },
];

export const pipeMaterialSpecs: CodeDefinition[] = [
  { code: 'M1E~M9E', zh: 'S30408 (304不锈钢)' },
  { code: 'M10E', zh: 'S31603 (316L不锈钢)' },
  { code: 'M1B~M9B', zh: '20#碳钢' },
  { code: 'N1C', zh: '碳钢' },
  { code: 'M1H', zh: '钢衬PTFE' },
  { code: 'M2H', zh: '钢衬搪玻璃' },
];

export const valveTypeCodes: CodeDefinition[] = [
  { code: 'GL', zh: '闸阀', en: 'Gate Valve' },
  { code: 'CL', zh: '截止阀', en: 'Stop Valve' },
  { code: 'BL', zh: '球阀', en: 'Ball Valve' },
  { code: 'BB', zh: '蝶阀', en: 'Butterfly Valve' },
  { code: 'CH', zh: '调节阀', en: 'Control Valve' },
  { code: 'CHV', zh: '调节阀（气动）', en: 'Control Valve (Pneumatic)' },
  { code: 'CHS', zh: '调节阀（电动）', en: 'Control Valve (Electric)' },
  { code: 'CHC', zh: '电动阀', en: 'Solenoid Valve' },
  { code: 'SR', zh: '止回阀', en: 'Check Valve' },
  { code: 'PS', zh: '减压阀', en: 'Pressure-Reducing Valve' },
  { code: 'SV', zh: '安全阀', en: 'Safety Valve' },
  { code: 'OV', zh: '截止阀（带阀芯）', en: 'Plug Valve' },
];

export const pipeSupportTypeCodes: CodeDefinition[] = [
  { code: 'A', zh: '固定架' },
  { code: 'G', zh: '导向架' },
  { code: 'H', zh: '吊架' },
  { code: 'T', zh: '限位架' },
  { code: 'R', zh: '滑动架' },
  { code: 'S', zh: '弹簧吊架' },
  { code: 'P', zh: '弹簧支座' },
  { code: 'E', zh: '特殊架' },
];

export const pipeSupportAnchorCodes: CodeDefinition[] = [
  { code: 'C', zh: '混凝土结构' },
  { code: 'V', zh: '设备' },
  { code: 'F', zh: '地面基础' },
  { code: 'W', zh: '墙体' },
  { code: 'S', zh: '钢结构' },
];
