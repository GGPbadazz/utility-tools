-- Remove email column from users table
-- This migration removes the email column as it's no longer needed

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- First, create a new table without the email column
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'applicant',
  department VARCHAR(100),
  phone VARCHAR(20),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table to new table (excluding email)
INSERT INTO users_new (id, username, password, full_name, role, department, phone, is_active, created_at, updated_at)
SELECT id, username, password, full_name, role, department, phone, is_active, created_at, updated_at
FROM users;

-- Drop the old table
DROP TABLE users;

-- Rename the new table to users
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
