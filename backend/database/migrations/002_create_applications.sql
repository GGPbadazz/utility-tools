CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_number VARCHAR(50) UNIQUE NOT NULL,
  applicant VARCHAR(100) NOT NULL,
  department VARCHAR(50) NOT NULL,
  project VARCHAR(200),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  urgency VARCHAR(20) DEFAULT 'normal',
  expected_date DATE,
  analysis_type TEXT, -- JSON string
  target_compounds TEXT,
  detection_method VARCHAR(50),
  report_requirement VARCHAR(50) DEFAULT 'standard',
  special_requirements TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
