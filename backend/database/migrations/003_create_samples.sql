CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  description TEXT,
  quantity DECIMAL(10,3),
  unit VARCHAR(20),
  storage_condition VARCHAR(100),
  hazard_level VARCHAR(20) DEFAULT 'none',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
