const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('=== Database Check ===\n');

// Check users table
const users = db.prepare('SELECT id, username, email, role, is_active FROM users').all();
console.log('Users in database:', users);
console.log('');

// Get admin user with password hash
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
console.log('Admin user details:', adminUser);
console.log('');

// Test password verification
if (adminUser) {
  const testPassword = 'admin123';
  const isMatch = bcrypt.compareSync(testPassword, adminUser.password_hash);
  console.log(`Password "${testPassword}" matches:`, isMatch);
  console.log('');

  // Show first few characters of hash
  console.log('Password hash (first 20 chars):', adminUser.password_hash.substring(0, 20));
}

db.close();
