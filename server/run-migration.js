const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

// Get migration file from command line argument or default
const migrationFile = process.argv[2] || 'add-production-tables.sql';
const tableName = migrationFile.includes('production') ? 'productions' :
                  migrationFile.includes('sales') ? 'sales' : 'purchases';

console.log(`Running migration: ${migrationFile}\n`);

const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'src/migrations', migrationFile),
  'utf8'
);

try {
  db.exec(migrationSQL);
  console.log('✅ Migration completed successfully!');
  console.log(`✅ ${tableName.charAt(0).toUpperCase() + tableName.slice(1)} table created`);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

// Verify table was created
const tableCheck = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name=?
`).get(tableName);

if (tableCheck) {
  console.log(`✅ Verified: ${tableName} table exists`);

  // Show table structure
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  console.log('\nTable structure:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });
} else {
  console.log('❌ Table verification failed');
}

db.close();
