const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('Adding bom_id column to productions table...\n');

try {
  // Check if column already exists
  const columns = db.prepare(`
    PRAGMA table_info(productions)
  `).all();

  const hasBOMColumn = columns.some(col => col.name === 'bom_id');

  if (hasBOMColumn) {
    console.log('✅ Column bom_id already exists in productions table');
  } else {
    // Add bom_id column
    db.exec('ALTER TABLE productions ADD COLUMN bom_id INTEGER');
    console.log('✅ Added bom_id column to productions table');
  }

  console.log('\nProductions table structure:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  // Show the new column
  const updatedColumns = db.prepare('PRAGMA table_info(productions)').all();
  const bomCol = updatedColumns.find(col => col.name === 'bom_id');
  if (bomCol) {
    console.log(`  - bom_id (${bomCol.type}) [NEW]`);
  }

  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  db.close();
  process.exit(1);
}
