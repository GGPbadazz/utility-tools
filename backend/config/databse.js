const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'chemical_analysis.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
db.serialize(() => {
  // 申请表主表
  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_number VARCHAR(20) UNIQUE NOT NULL,
      applicant VARCHAR(100) NOT NULL,
      department VARCHAR(50) NOT NULL,
      project VARCHAR(200),
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(100),
      urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
      expected_date DATE,
      target_compounds TEXT,
      detection_method VARCHAR(100),
      report_requirement VARCHAR(50) DEFAULT 'standard',
      special_requirements TEXT,
      status VARCHAR(20) DEFAULT 'submitted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 样品信息表
  db.run(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      name VARCHAR(200) NOT NULL,
      type VARCHAR(50),
      description TEXT,
      quantity DECIMAL(10,3),
      unit VARCHAR(10),
      storage_condition VARCHAR(200),
      hazard_level VARCHAR(20) DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);

  // 分析类型表
  db.run(`
    CREATE TABLE IF NOT EXISTS analysis_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      analysis_type VARCHAR(50) NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);

  // 附件表
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;
