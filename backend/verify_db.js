#!/usr/bin/env node

// Quick database verification script
const fs = require('fs');
const path = require('path');

console.log('🔍 Database Verification Script');
console.log('===============================');

// Check if we're in the backend directory
const dbPath = path.join(__dirname, 'chemical_analysis.db');
const packagePath = path.join(__dirname, 'package.json');

if (!fs.existsSync(packagePath)) {
    console.log('❌ Run this script from the backend directory');
    process.exit(1);
}

if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found');
    process.exit(1);
}

console.log('✅ Database file exists');
console.log('📊 Database file size:', fs.statSync(dbPath).size, 'bytes');

// Try to connect and query
try {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);
    
    console.log('🔗 Database connection established');
    
    // Check applications table
    db.get("SELECT COUNT(*) as count FROM applications", [], (err, row) => {
        if (err) {
            console.error('❌ Error counting applications:', err.message);
        } else {
            console.log('📋 Total applications:', row.count);
        }
        
        // Check users table
        db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
            if (err) {
                console.error('❌ Error counting users:', err.message);
            } else {
                console.log('👥 Total users:', row.count);
            }
            
            // Check recent applications
            db.all("SELECT work_order_number, applicant, user_id, created_at FROM applications ORDER BY created_at DESC LIMIT 5", [], (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching recent applications:', err.message);
                } else {
                    console.log('📋 Recent applications:');
                    rows.forEach(row => {
                        console.log(`  - ${row.work_order_number} by ${row.applicant} (user_id: ${row.user_id})`);
                    });
                }
                
                // Check analyst users
                db.all("SELECT username, role FROM users WHERE role = 'analyst'", [], (err, rows) => {
                    if (err) {
                        console.error('❌ Error fetching analysts:', err.message);
                    } else {
                        console.log('🔬 Analyst users:');
                        rows.forEach(row => {
                            console.log(`  - ${row.username} (${row.role})`);
                        });
                    }
                    
                    db.close();
                    console.log('✅ Database verification completed');
                });
            });
        });
    });
    
} catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    console.log('💡 Try running: npm install sqlite3');
}
