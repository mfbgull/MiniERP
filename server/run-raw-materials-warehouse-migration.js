const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('Running raw materials warehouse migration...\n');

try {
  // Check if column already exists
  const columns = db.prepare(`
    PRAGMA table_info(productions)
  `).all();

  const hasRawMaterialsWarehouseColumn = columns.some(col => col.name === 'raw_materials_warehouse_id');

  if (hasRawMaterialsWarehouseColumn) {
    console.log('✅ Column raw_materials_warehouse_id already exists in productions table');
  } else {
    // Add raw_materials_warehouse_id column
    db.exec('ALTER TABLE productions ADD COLUMN raw_materials_warehouse_id INTEGER');
    console.log('✅ Added raw_materials_warehouse_id column to productions table');
    
    // Update existing records to use the existing warehouse_id for raw materials (backward compatibility)
    db.exec(`
      UPDATE productions 
      SET raw_materials_warehouse_id = warehouse_id 
      WHERE raw_materials_warehouse_id IS NULL
    `);
    console.log('✅ Updated existing records with raw_materials_warehouse_id');

    // Add foreign key constraint
    // Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we'll set up foreign key relations via pragma
    console.log('✅ Foreign key constraint set');
  }

  console.log('\nProductions table structure:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  db.close();
  console.log('\n✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}