-- Create production_lines table
CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default production lines
INSERT OR IGNORE INTO production_lines (name, description) VALUES
('示例线1', '演示用流程线'),
('示例线2', '演示用流程线'),
('示例线3', '演示用流程线'),
('实验线', '演示用实验线');
