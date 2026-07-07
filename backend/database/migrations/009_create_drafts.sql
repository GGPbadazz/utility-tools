-- Create drafts table for saving draft applications
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title VARCHAR(200) DEFAULT 'Untitled Draft',
  applicant VARCHAR(100),
  department VARCHAR(50),
  project VARCHAR(200),
  phone VARCHAR(20),
  email VARCHAR(100),
  urgency VARCHAR(20) DEFAULT 'normal',
  expected_date DATE,
  target_compounds TEXT,
  detection_method VARCHAR(50),
  report_requirement VARCHAR(50) DEFAULT 'standard',
  special_requirements TEXT,
  samples TEXT, -- JSON string
  analysis_types TEXT, -- JSON string
  sampler VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
