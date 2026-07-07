-- 添加中性示例流程线
INSERT INTO production_lines (name, description) VALUES
('示例线1', '演示用流程线'),
('示例线2', '演示用流程线'),
('示例线3', '演示用流程线');

-- 添加中性示例环节
INSERT INTO production_stages (production_line_id, name, description) VALUES
(1, '步骤A', '演示用流程步骤'),
(1, '步骤B', '演示用流程步骤'),
(1, '步骤C', '演示用流程步骤'),
(2, '步骤A', '演示用流程步骤'),
(2, '步骤C', '演示用流程步骤'),
(3, '步骤B', '演示用流程步骤'),
(3, '步骤C', '演示用流程步骤');

-- 添加示例快速提交模板
INSERT INTO quick_submit_templates (
  name, description, production_line, stage,
  analysis_types, target_compounds, detection_method,
  report_requirement
) VALUES
(
  '示例模板A',
  '演示用快速提交模板',
  1,
  1,
  '["成分分析", "纯度检测"]',
  '示例指标A、示例指标B',
  '方法A',
  'standard'
),
(
  '示例模板B',
  '演示用快速提交模板',
  1,
  2,
  '["含量测定", "杂质检测"]',
  '示例指标C、示例指标D',
  '方法B',
  'detailed'
),
(
  '示例模板C',
  '演示用快速提交模板',
  1,
  3,
  '["成分分析", "纯度检测", "杂质检测"]',
  '示例指标A、示例指标C',
  '方法A,方法B',
  'certificate'
);
