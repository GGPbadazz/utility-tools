-- Create production_steps table
CREATE TABLE IF NOT EXISTS production_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default production steps
INSERT OR IGNORE INTO production_steps (name, description) VALUES
('步骤A', '演示用流程步骤'),
('步骤B', '演示用流程步骤'),
('步骤C', '演示用流程步骤'),
('复核', '演示用复核步骤'),
('归档', '演示用归档步骤');
