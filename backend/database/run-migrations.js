const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// 运行迁移
async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrations) {
    console.log(`Running migration: ${file}`);
    const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await new Promise((resolve, reject) => {
        db.exec(migration, (err) => {
          if (err) {
            console.error(`Error running migration ${file}:`, err);
            reject(err);
          } else {
            console.log(`Migration ${file} completed successfully`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Migration ${file} failed:`, error);
      process.exit(1);
    }
  }
  
  console.log('All migrations completed successfully');
  process.exit(0);
}

// 运行迁移
runMigrations();
