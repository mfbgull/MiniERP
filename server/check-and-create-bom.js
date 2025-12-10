const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/erp.db');
const db = new Database(dbPath);

console.log('Checking BOM tables...\n');

try {
  // Check if tables exist
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (name='boms' OR name='bom_items')
  `).all();

  console.log('Existing BOM tables:', tables.map(t => t.name).join(', ') || 'None');

  if (tables.length > 0) {
    console.log('\nDropping existing BOM tables...');
    db.exec('DROP TABLE IF EXISTS bom_items');
    db.exec('DROP TABLE IF EXISTS boms');
    console.log('✅ Tables dropped');
  }

  console.log('\nCreating BOM tables...');

  // Create boms table
  db.exec(`
    CREATE TABLE boms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_no VARCHAR(50) UNIQUE NOT NULL,
      bom_name VARCHAR(200) NOT NULL,
      finished_item_id INTEGER NOT NULL,
      quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create bom_items table
  db.exec(`
    CREATE TABLE bom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  db.exec('CREATE INDEX idx_boms_finished_item ON boms(finished_item_id)');
  db.exec('CREATE INDEX idx_boms_is_active ON boms(is_active)');
  db.exec('CREATE INDEX idx_bom_items_bom ON bom_items(bom_id)');
  db.exec('CREATE INDEX idx_bom_items_item ON bom_items(item_id)');

  console.log('✅ BOM tables created successfully!');
  console.log('   - boms (BOM header)');
  console.log('   - bom_items (BOM raw materials)');
  console.log('   - 4 indexes created\n');

  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  db.close();
  process.exit(1);
}
