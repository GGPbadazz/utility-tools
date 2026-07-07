// database.js - better-sqlite3 wrapper that mimics the sqlite3 async callback API
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'chemical_analysis.db');

const _db = new Database(dbPath);

// Performance settings
_db.pragma('journal_mode = WAL');
_db.pragma('busy_timeout = 30000');
_db.pragma('foreign_keys = ON');

console.log('Connected to SQLite database');

// Compatibility shim: expose sqlite3-style async API backed by better-sqlite3 sync calls
const db = {
  // db.run(sql, params, callback)
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (!callback) callback = () => {};
    try {
      const stmt = _db.prepare(sql);
      const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      // Mimic `this` context with lastID and changes
      callback.call({ lastID: info.lastInsertRowid, changes: info.changes }, null);
    } catch (err) {
      callback(err);
    }
    return this;
  },

  // db.get(sql, params, callback)
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (!callback) callback = () => {};
    try {
      const stmt = _db.prepare(sql);
      const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
      callback(null, row);
    } catch (err) {
      callback(err, null);
    }
    return this;
  },

  // db.all(sql, params, callback)
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    if (!callback) callback = () => {};
    try {
      const stmt = _db.prepare(sql);
      const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
      callback(null, rows);
    } catch (err) {
      callback(err, null);
    }
    return this;
  },

  // db.serialize(callback) - just call immediately (better-sqlite3 is already synchronous)
  serialize(callback) {
    if (callback) callback();
    return this;
  },

  // db.configure(option, value) - no-op for compatibility
  configure(option, value) {
    return this;
  },

  // db.on(event, callback) - no-op for compatibility
  on(event, callback) {
    return this;
  },

  // db.exec(sql) - direct exec
  exec(sql) {
    _db.exec(sql);
    return this;
  },

  // db.close(callback)
  close(callback) {
    try {
      _db.close();
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  },

  // Expose raw better-sqlite3 instance for advanced use
  _raw: _db
};

// Initialize database tables
function initializeDatabase() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_number TEXT UNIQUE NOT NULL,
      applicant TEXT,
      sampler TEXT,
      department TEXT,
      project TEXT,
      phone TEXT,
      urgency TEXT NOT NULL DEFAULT 'normal',
      expected_date TEXT,
      target_compounds TEXT,
      detection_method TEXT,
      report_requirement TEXT,
      special_requirements TEXT,
      batch_number TEXT,
      reflection_step TEXT,
      production_line TEXT,
      analysis_conclusion TEXT,
      analysis_result TEXT,
      analyst_name TEXT,
      analysis_completed_at DATETIME,
      cancel_reason TEXT,
      status TEXT DEFAULT 'waiting_sample',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Applications table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      quantity TEXT,
      unit TEXT,
      storage_condition TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);
  console.log('Samples table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      analysis_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);
  console.log('Analysis types table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);
  console.log('Attachments table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      conclusion TEXT,
      data TEXT,
      notes TEXT,
      analyst_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
    )
  `);
  console.log('Analysis results table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default departments if none exist
  const deptCount = _db.prepare('SELECT COUNT(*) as cnt FROM departments').get();
  if (deptCount.cnt === 0) {
    const insertDept = _db.prepare("INSERT INTO departments (name, description) VALUES (?, ?)");
    const depts = [
      ['示例部门A', '演示用部门'],
      ['示例部门B', '演示用部门'],
      ['实验室', '演示用实验室'],
      ['样品管理', '演示用样品管理']
    ];
    for (const [name, desc] of depts) {
      insertDept.run(name, desc);
    }
  }
  console.log('Departments table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant TEXT,
      sampler TEXT,
      department TEXT,
      project TEXT,
      phone TEXT,
      urgency TEXT,
      expected_date TEXT,
      target_compounds TEXT,
      detection_method TEXT,
      report_requirement TEXT,
      special_requirements TEXT,
      samples TEXT,
      analysis_types TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Drafts table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS production_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Production lines table ready');

  // Insert default production lines if none exist
  const lineCount = _db.prepare('SELECT COUNT(*) as cnt FROM production_lines').get();
  if (lineCount.cnt === 0) {
    const insertLine = _db.prepare("INSERT INTO production_lines (name, description) VALUES (?, ?)");
    const lines = [
      ['示例线1', '演示用流程线'],
      ['示例线2', '演示用流程线'],
      ['示例线3', '演示用流程线'],
    ];
    for (const [name, desc] of lines) {
      insertLine.run(name, desc);
    }
  }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS quick_submit_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      production_line TEXT,
      stage TEXT,
      analysis_types TEXT,
      target_compounds TEXT,
      detection_method TEXT,
      report_requirement TEXT DEFAULT 'standard',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Insert default quick submit templates if none exist
  const tplCount = _db.prepare('SELECT COUNT(*) as cnt FROM quick_submit_templates').get();
  if (tplCount.cnt === 0) {
    const insertTpl = _db.prepare(`INSERT INTO quick_submit_templates
      (name, description, production_line, stage, analysis_types, target_compounds, detection_method, report_requirement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertTpl.run('示例模板A', '演示用快速提交模板', '示例线1', '步骤A', '定性分析,定量分析', '示例指标A', '方法A', 'standard');
    insertTpl.run('示例模板B', '演示用快速提交模板', '示例线2', '步骤B', '纯度检测,杂质分析', '示例指标B', '方法B', 'standard');
  }
  console.log('Quick submit templates table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_type_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const catCount = _db.prepare('SELECT COUNT(*) as cnt FROM analysis_type_catalog').get();
  if (catCount.cnt === 0) {
    const insertCat = _db.prepare("INSERT INTO analysis_type_catalog (name, description, sort_order) VALUES (?, ?, ?)");
    const cats = [
      ['定性分析', '确定样品中化合物种类', 1],
      ['定量分析', '测定样品中各组分含量', 2],
      ['成分分析', '全面分析样品化学成分', 3],
      ['纯度检测', '检测样品纯度等级', 4],
      ['质量检测', '综合质量指标检测', 5],
      ['杂质分析', '分析样品中杂质种类及含量', 6],
      ['含量测定', '特定成分精确含量测定', 7],
    ];
    for (const [name, desc, order] of cats) {
      insertCat.run(name, desc, order);
    }
  }
  console.log('Analysis type catalog table ready');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      report_type TEXT,
      start_date TEXT,
      end_date TEXT,
      generated_by TEXT,
      file_path TEXT,
      file_type TEXT DEFAULT 'xlsx',
      file_size INTEGER,
      name TEXT,
      type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Reports table ready');
}

initializeDatabase();

// Graceful shutdown
process.on('SIGINT', () => {
  _db.close();
  console.log('Database connection closed');
  process.exit(0);
});

process.on('SIGTERM', () => {
  _db.close();
  console.log('Database connection closed');
  process.exit(0);
});

module.exports = db;
