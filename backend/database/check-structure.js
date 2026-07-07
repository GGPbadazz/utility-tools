const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../chemical_analysis.db');

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('连接数据库失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到数据库');
});

// 检查表结构
function checkTableStructure() {
  console.log('=== 检查数据库表结构 ===');
  
  // 获取所有表名
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('获取表列表失败:', err);
      return;
    }
    
    console.log('数据库中的表:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // 检查applications表结构
    if (tables.find(t => t.name === 'applications')) {
      db.all("PRAGMA table_info(applications)", (err, rows) => {
        if (err) {
          console.error('获取applications表结构失败:', err);
        } else {
          console.log('\napplications表结构:');
          rows.forEach(row => {
            console.log(`  ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
          });
        }
        
        // 检查samples表结构
        checkSamplesTable();
      });
    } else {
      console.log('applications表不存在');
      checkSamplesTable();
    }
  });
}

function checkSamplesTable() {
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='samples'", (err, tables) => {
    if (err) {
      console.error('检查samples表失败:', err);
      return;
    }
    
    if (tables.length > 0) {
      db.all("PRAGMA table_info(samples)", (err, rows) => {
        if (err) {
          console.error('获取samples表结构失败:', err);
        } else {
          console.log('\nsamples表结构:');
          rows.forEach(row => {
            console.log(`  ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
          });
        }
        
        // 检查drafts表结构
        checkDraftsTable();
      });
    } else {
      console.log('\nsamples表不存在');
      checkDraftsTable();
    }
  });
}

function checkDraftsTable() {
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='drafts'", (err, tables) => {
    if (err) {
      console.error('检查drafts表失败:', err);
      return;
    }
    
    if (tables.length > 0) {
      db.all("PRAGMA table_info(drafts)", (err, rows) => {
        if (err) {
          console.error('获取drafts表结构失败:', err);
        } else {
          console.log('\ndrafts表结构:');
          rows.forEach(row => {
            console.log(`  ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
          });
        }
        
        db.close();
      });
    } else {
      console.log('\ndrafts表不存在');
      db.close();
    }
  });
}

checkTableStructure();
