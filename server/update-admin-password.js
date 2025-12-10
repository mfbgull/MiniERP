const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('Updating admin password with bcrypt cost 8...\n');

// Generate new password hash with cost 8
const newPasswordHash = bcrypt.hashSync('admin123', 8);

// Update admin user
const result = db.prepare(`
  UPDATE users
  SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
  WHERE username = 'admin'
`).run(newPasswordHash);

console.log('Admin password updated!');
console.log('Rows affected:', result.changes);
console.log('New hash (first 20 chars):', newPasswordHash.substring(0, 20));

// Test the new password
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
const isMatch = bcrypt.compareSync('admin123', adminUser.password_hash);
console.log('\nPassword verification test:', isMatch ? '✅ PASSED' : '❌ FAILED');

db.close();
