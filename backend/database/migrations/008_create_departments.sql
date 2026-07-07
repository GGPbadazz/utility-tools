-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default departments
INSERT OR IGNORE INTO departments (name, description) VALUES
('示例部门A', 'Demo Department A'),
('示例部门B', 'Demo Department B'),
('实验室', 'Demo Laboratory'),
('样品管理', 'Demo Sample Management');
