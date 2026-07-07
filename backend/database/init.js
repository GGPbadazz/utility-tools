const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const initializeDatabase = () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir).sort();
  
  migrations.forEach(file => {
    if (file.endsWith('.sql')) {
      const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(migration, (err) => {
        if (err) {
          console.error(`Error running migration ${file}:`, err);
        } else {
          console.log(`Migration ${file} completed`);
        }
      });
    }
  });
};

module.exports = { initializeDatabase };
