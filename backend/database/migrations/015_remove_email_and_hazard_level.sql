-- 删除applications表中的email字段
ALTER TABLE applications DROP COLUMN email;

-- 删除samples表中的hazard_level字段（如果存在）
-- 注意：SQLite不支持直接删除列，需要重建表
-- 如果samples表存在hazard_level字段，需要重建表

-- 先备份samples表
CREATE TABLE samples_backup AS SELECT * FROM samples;

-- 删除原samples表
DROP TABLE samples;

-- 重建samples表，不包含hazard_level字段
CREATE TABLE samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  quantity REAL,
  unit TEXT,
  storage_condition TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
);

-- 将数据从备份表迁移回新表（排除hazard_level字段）
INSERT INTO samples (id, application_id, name, type, description, quantity, unit, storage_condition, created_at)
SELECT id, application_id, name, type, description, quantity, unit, storage_condition, created_at
FROM samples_backup;

-- 删除备份表
DROP TABLE samples_backup;

-- 删除drafts表中的email字段（如果存在）
-- 同样需要重建表
CREATE TABLE drafts_backup AS SELECT * FROM drafts;

DROP TABLE drafts;

CREATE TABLE drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Draft',
  applicant TEXT,
  department TEXT,
  project TEXT,
  phone TEXT,
  urgency TEXT DEFAULT 'normal',
  expected_date TEXT,
  target_compounds TEXT,
  detection_method TEXT,
  report_requirement TEXT DEFAULT 'standard',
  special_requirements TEXT,
  samples TEXT,
  analysis_types TEXT,
  sampler TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 迁移数据，排除email字段
INSERT INTO drafts (id, user_id, title, applicant, department, project, phone, urgency, expected_date, target_compounds, detection_method, report_requirement, special_requirements, samples, analysis_types, sampler, created_at, updated_at)
SELECT id, user_id, title, applicant, department, project, phone, urgency, expected_date, target_compounds, detection_method, report_requirement, special_requirements, samples, analysis_types, sampler, created_at, updated_at
FROM drafts_backup;

DROP TABLE drafts_backup;
