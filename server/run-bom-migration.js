const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('Running BOM tables migration...\n');

try {
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'src/migrations/add-bom-tables.sql'),
    'utf8'
  );

  db.exec(migrationSQL);

  console.log('✅ BOM tables created successfully!');
  console.log('   - boms (BOM header)');
  console.log('   - bom_items (BOM raw materials)');
  console.log('   - Indexes created\n');

  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
