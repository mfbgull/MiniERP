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

  // Run invoice discount/tax migration if needed
  runInvoiceMigration();

  // Run customer AR migrations
  runCustomerARMigrations();
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

function runInvoiceMigration() {
  try {
    // Check if discount_scope column exists in invoices table
    const columnCheck = db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('invoices')
      WHERE name='discount_scope'
    `).get();

    if (columnCheck.count === 0) {
      console.log('Running invoice discount/tax migration...');

      const migrationSQL = fs.readFileSync(
        path.join(__dirname, '../migrations/add-invoice-discount-tax-fields.sql'),
        'utf8'
      );

      db.exec(migrationSQL);

      console.log('✅ Invoice discount/tax migration completed!');
    }
  } catch (error) {
    console.error('Invoice migration error:', error.message);
  }
}

function runCustomerARMigrations() {
  try {
    // Check for each individual customer AR field and add if missing
    const columnsToCheck = [
      {name: 'credit_limit', sql: 'ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(15,2) DEFAULT 0'},
      {name: 'current_balance', sql: 'ALTER TABLE customers ADD COLUMN current_balance DECIMAL(15,2) DEFAULT 0'},
      {name: 'opening_balance', sql: 'ALTER TABLE customers ADD COLUMN opening_balance DECIMAL(15,2) DEFAULT 0'},
      {name: 'payment_terms_days', sql: 'ALTER TABLE customers ADD COLUMN payment_terms_days INTEGER DEFAULT 14'}
    ];

    for (const column of columnsToCheck) {
      const columnCheck = db.prepare(`
        SELECT COUNT(*) as count FROM pragma_table_info('customers')
        WHERE name=?
      `).get(column.name);

      if (columnCheck.count === 0) {
        console.log(`Adding missing column: ${column.name}...`);
        db.exec(column.sql);
        console.log(`✅ Added ${column.name} column successfully!`);
      }
    }

    // Check if customer_ledger table exists
    const ledgerTableCheck = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='customer_ledger'
    `).get();

    if (!ledgerTableCheck) {
      console.log('Running customer ledger migration...');

      const ledgerSQL = fs.readFileSync(
        path.join(__dirname, '../migrations/create-customer-ledger.sql'),
        'utf8'
      );

      db.exec(ledgerSQL);

      console.log('✅ Customer ledger migration completed!');
    }

    // Check if payment_allocations table exists
    const allocationsTableCheck = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='payment_allocations'
    `).get();

    if (!allocationsTableCheck) {
      console.log('Running payment allocations migration...');

      const allocationsSQL = fs.readFileSync(
        path.join(__dirname, '../migrations/create-payment-allocations.sql'),
        'utf8'
      );

      db.exec(allocationsSQL);

      console.log('✅ Payment allocations migration completed!');
    }

    // Fix any string customer_id values in invoices table (ensure they are integers)
    console.log('Ensuring customer_id values are integers...');
    db.exec(`
      UPDATE invoices SET customer_id = CAST(customer_id AS INTEGER) WHERE typeof(customer_id) = 'text';
      UPDATE payments SET customer_id = CAST(customer_id AS INTEGER) WHERE typeof(customer_id) = 'text';
    `);
    console.log('✅ Customer ID type fix completed!');

    // Recalculate all invoice balances from payment_allocations (single source of truth)
    console.log('Recalculating invoice balances from payment allocations...');
    db.exec(`
      UPDATE invoices SET
        paid_amount = COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = invoices.id
        ), 0),
        balance_amount = total_amount - COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = invoices.id
        ), 0)
    `);

    // Update invoice statuses based on recalculated balances
    db.exec(`
      UPDATE invoices SET status = 'Paid' WHERE balance_amount = 0 AND total_amount > 0;
      UPDATE invoices SET status = 'Partially Paid' WHERE balance_amount > 0 AND balance_amount < total_amount AND paid_amount > 0;
      UPDATE invoices SET status = 'Unpaid' WHERE paid_amount = 0 OR paid_amount IS NULL;
    `);
    console.log('✅ Invoice balance recalculation completed!');

    // Recalculate stock_balances from stock_movements (movements are the source of truth)
    console.log('Recalculating stock balances from movements...');

    // Get all unique item/warehouse combinations from movements
    const movementSums = db.prepare(`
      SELECT item_id, warehouse_id, SUM(quantity) as total_qty
      FROM stock_movements
      GROUP BY item_id, warehouse_id
    `).all();

    for (const sum of movementSums) {
      const existing = db.prepare('SELECT id, quantity FROM stock_balances WHERE item_id = ? AND warehouse_id = ?').get(sum.item_id, sum.warehouse_id);

      if (existing) {
        if (existing.quantity !== sum.total_qty) {
          const item = db.prepare('SELECT item_code FROM items WHERE id = ?').get(sum.item_id);
          const wh = db.prepare('SELECT warehouse_code FROM warehouses WHERE id = ?').get(sum.warehouse_id);
          console.log(`Fixing ${item?.item_code} in ${wh?.warehouse_code}: ${existing.quantity} -> ${sum.total_qty}`);
          db.prepare('UPDATE stock_balances SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(sum.total_qty, existing.id);
        }
      } else {
        // Create balance record if it doesn't exist
        db.prepare('INSERT INTO stock_balances (item_id, warehouse_id, quantity) VALUES (?, ?, ?)').run(sum.item_id, sum.warehouse_id, sum.total_qty);
      }
    }

    // Remove stock_balances that have no movements (orphaned records)
    const orphanedBalances = db.prepare(`
      SELECT sb.id, i.item_code, w.warehouse_code
      FROM stock_balances sb
      JOIN items i ON sb.item_id = i.id
      JOIN warehouses w ON sb.warehouse_id = w.id
      WHERE NOT EXISTS (
        SELECT 1 FROM stock_movements sm
        WHERE sm.item_id = sb.item_id AND sm.warehouse_id = sb.warehouse_id
      )
    `).all();

    for (const orphan of orphanedBalances) {
      console.log(`Removing orphaned balance: ${orphan.item_code} in ${orphan.warehouse_code}`);
      db.prepare('DELETE FROM stock_balances WHERE id = ?').run(orphan.id);
    }

    console.log('✅ Stock balances recalculated from movements!');

    // Sync items.current_stock FROM stock_balances
    console.log('Syncing item current_stock from stock_balances...');
    db.exec(`
      UPDATE items SET current_stock = (
        SELECT COALESCE(SUM(quantity), 0)
        FROM stock_balances
        WHERE stock_balances.item_id = items.id
      )
    `);
    console.log('✅ Item stock synced from warehouse balances!');

    // Fix payment ledger descriptions to use invoice numbers instead of IDs
    console.log('Fixing payment ledger descriptions...');
    const paymentLedgerEntries = db.prepare(`
      SELECT cl.id, cl.reference_no, cl.description
      FROM customer_ledger cl
      WHERE cl.transaction_type = 'PAYMENT'
        AND cl.description LIKE 'Payment against %'
    `).all();

    for (const entry of paymentLedgerEntries) {
      // Extract invoice IDs from description like "Payment against 1, 2, 3" or "Payment against 5"
      const match = entry.description.match(/Payment against (.+)/);
      if (match) {
        const invoiceRefs = match[1].split(',').map(s => s.trim());
        const invoiceNumbers = invoiceRefs.map(ref => {
          // Check if it's already an invoice number (starts with INV or contains letters)
          if (/[a-zA-Z]/.test(ref)) {
            return ref; // Already an invoice number
          }
          // It's an ID, look up the invoice number
          const invoiceId = parseInt(ref, 10);
          if (!isNaN(invoiceId)) {
            const invoice = db.prepare('SELECT invoice_no FROM invoices WHERE id = ?').get(invoiceId);
            return invoice ? invoice.invoice_no : `Invoice #${invoiceId}`;
          }
          return ref;
        });

        const newDescription = `Payment against ${invoiceNumbers.join(', ')}`;
        if (newDescription !== entry.description) {
          db.prepare('UPDATE customer_ledger SET description = ? WHERE id = ?').run(newDescription, entry.id);
        }
      }
    }
    console.log('✅ Payment ledger descriptions fixed!');
  } catch (error) {
    console.error('Customer AR migration error:', error.message);
  }
}

// Initialize on first load
initializeDatabase();

module.exports = db;
