const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file path
const dbPath = path.join(__dirname, '../../../database/erp.db');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database with schema if tables don't exist
function initializeDatabase() {
  console.log('Checking database initialization...');

  // Check if users table exists
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='users'
  `).get();

  if (!tableCheck) {
    console.log('Database not initialized. Running migration...');

    // Read and execute init.sql
    const initSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/init.sql'),
      'utf8'
    );

    // Execute the SQL file
    db.exec(initSQL);

    console.log('✅ Database schema created successfully!');

    // Create default admin user
    createDefaultUser();

    // Create default warehouse
    createDefaultWarehouse();

    console.log('✅ Database initialization complete!');
  } else {
    console.log('✅ Database already initialized.');
  }
}

function createDefaultUser() {
  const bcrypt = require('bcrypt');

  // Check if admin user exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

  if (!existingUser) {
    const passwordHash = bcrypt.hashSync('admin123', 8);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run('admin', 'admin@minierp.local', passwordHash, 'Administrator', 'admin', 1);

    console.log('✅ Default admin user created (username: admin, password: admin123)');
  }
}

function createDefaultWarehouse() {
  // Check if default warehouse exists
  const existingWarehouse = db.prepare('SELECT id FROM warehouses WHERE warehouse_code = ?').get('WH-001');

  if (!existingWarehouse) {
    const stmt = db.prepare(`
      INSERT INTO warehouses (warehouse_code, warehouse_name, location, is_active)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run('WH-001', 'Main Warehouse', 'Default Location', 1);

    console.log('✅ Default warehouse created (WH-001)');
  }
}

// Initialize on first load
initializeDatabase();

module.exports = db;
