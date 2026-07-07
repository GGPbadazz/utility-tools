-- 快速提交模板表
CREATE TABLE IF NOT EXISTS quick_submit_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  production_line TEXT NOT NULL,
  stage TEXT NOT NULL,
  analysis_types TEXT NOT NULL,
  target_compounds TEXT,
  detection_method TEXT,
  report_requirement TEXT DEFAULT 'standard',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 产线配置表
CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 生产环节配置表
CREATE TABLE IF NOT EXISTS production_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_line_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id)
);

-- 更新分析结果表，添加合格状态字段
ALTER TABLE analysis_results ADD COLUMN pass_status TEXT CHECK(pass_status IN ('pass', 'fail', 'need_recheck'));
ALTER TABLE analysis_results ADD COLUMN fail_reason TEXT;

-- 更新申请表，添加快速提交相关字段和拒绝状态
ALTER TABLE applications ADD COLUMN template_id INTEGER REFERENCES quick_submit_templates(id);
ALTER TABLE applications ADD COLUMN production_line_id INTEGER REFERENCES production_lines(id);
ALTER TABLE applications ADD COLUMN production_stage_id INTEGER REFERENCES production_stages(id);
ALTER TABLE applications ADD COLUMN reject_reason TEXT;
ALTER TABLE applications ADD COLUMN is_quick_submit BOOLEAN DEFAULT 0;

-- 添加索引
CREATE INDEX idx_applications_template_id ON applications(template_id);
CREATE INDEX idx_applications_production_line ON applications(production_line_id);
CREATE INDEX idx_applications_production_stage ON applications(production_stage_id);
CREATE INDEX idx_production_stages_line_id ON production_stages(production_line_id);
