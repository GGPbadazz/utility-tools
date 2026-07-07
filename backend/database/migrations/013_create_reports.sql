-- Create reports table for storing generated reports
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(200) NOT NULL,
  report_type VARCHAR(50) NOT NULL, -- 'weekly', 'monthly', 'yearly'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  generated_by INTEGER NOT NULL,
  file_path VARCHAR(500),
  file_type VARCHAR(10) NOT NULL, -- 'pdf', 'xlsx'
  file_size INTEGER,
  status VARCHAR(20) DEFAULT 'generated', -- 'generating', 'generated', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generated_by) REFERENCES users (id)
);

-- Create report_statistics table for dashboard stats
CREATE TABLE IF NOT EXISTS report_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stat_date DATE NOT NULL,
  total_applications INTEGER DEFAULT 0,
  completed_applications INTEGER DEFAULT 0,
  pending_applications INTEGER DEFAULT 0,
  urgent_applications INTEGER DEFAULT 0,
  department_breakdown TEXT, -- JSON string
  analysis_type_breakdown TEXT, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stat_date)
);
