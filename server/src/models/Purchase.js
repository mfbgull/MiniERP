const db = require('../config/database');
const StockMovement = require('./StockMovement');

class Purchase {
  /**
   * Record a direct purchase
   * This will:
   * 1. Insert purchase record
   * 2. Create stock movement (PURCHASE type)
   * 3. Update stock balances
   */
  static recordPurchase(data, userId) {
    const {
      item_id,
      warehouse_id,
      quantity,
      unit_cost,
      supplier_name,
      purchase_date,
      invoice_no,
      remarks
    } = data;

    const transaction = db.transaction(() => {
      // Generate purchase number
      const purchaseNo = this.generatePurchaseNo();

      // Insert purchase record
      const purchaseStmt = db.prepare(`
        INSERT INTO purchases (
          purchase_no, item_id, warehouse_id, quantity, unit_cost, total_cost,
          supplier_name, purchase_date, invoice_no, remarks, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const totalCost = quantity * unit_cost;

      const result = purchaseStmt.run(
        purchaseNo,
        item_id,
        warehouse_id,
        quantity,
        unit_cost,
        totalCost,
        supplier_name || null,
        purchase_date,
        invoice_no || null,
        remarks || null,
        userId
      );

      const purchaseId = result.lastInsertRowid;

      // Create stock movement (this will auto-update stock balances)
      StockMovement.recordMovement({
        item_id,
        warehouse_id,
        quantity,
        movement_type: 'PURCHASE',
        reference_type: 'Purchase',
        reference_id: purchaseId,
        transaction_date: purchase_date,
        remarks: `Purchase: ${purchaseNo}${supplier_name ? ' from ' + supplier_name : ''}`
      }, userId);

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        'CREATE',
        'Purchase',
        purchaseId,
        `Recorded purchase ${purchaseNo}: ${quantity} units`
      );

      // Return purchase with details
      return this.getById(purchaseId);
    });

    return transaction();
  }

  /**
   * Generate purchase number (PURCH-YYYY-NNNN)
   */
  static generatePurchaseNo() {
    const year = new Date().getFullYear();
    const settingKey = `PURCH_last_no_${year}`;

    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);

    let nextNo = 1;
    if (setting) {
      nextNo = parseInt(setting.value) + 1;
    }

    // Update or insert setting
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(settingKey, nextNo.toString());

    return `PURCH-${year}-${nextNo.toString().padStart(4, '0')}`;
  }

  /**
   * Get all purchases with item and warehouse details
   */
  static getAll(filters = {}) {
    let query = `
      SELECT
        p.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name,
        u.username as created_by_username
      FROM purchases p
      JOIN items i ON p.item_id = i.id
      JOIN warehouses w ON p.warehouse_id = w.id
      JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by date range
    if (filters.start_date) {
      query += ` AND p.purchase_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.purchase_date <= ?`;
      params.push(filters.end_date);
    }

    // Filter by item
    if (filters.item_id) {
      query += ` AND p.item_id = ?`;
      params.push(filters.item_id);
    }

    // Filter by warehouse
    if (filters.warehouse_id) {
      query += ` AND p.warehouse_id = ?`;
      params.push(filters.warehouse_id);
    }

    // Filter by supplier name
    if (filters.supplier_name) {
      query += ` AND p.supplier_name LIKE ?`;
      params.push(`%${filters.supplier_name}%`);
    }

    query += ` ORDER BY p.purchase_date DESC, p.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Get purchase by ID
   */
  static getById(id) {
    return db.prepare(`
      SELECT
        p.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name,
        u.username as created_by_username
      FROM purchases p
      JOIN items i ON p.item_id = i.id
      JOIN warehouses w ON p.warehouse_id = w.id
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(id);
  }

  /**
   * Get purchases summary by item
   */
  static getSummaryByItem(item_id) {
    return db.prepare(`
      SELECT
        COUNT(*) as purchase_count,
        SUM(quantity) as total_quantity,
        SUM(total_cost) as total_cost,
        AVG(unit_cost) as avg_unit_cost,
        MIN(purchase_date) as first_purchase_date,
        MAX(purchase_date) as last_purchase_date
      FROM purchases
      WHERE item_id = ?
    `).get(item_id);
  }

  /**
   * Get purchases summary by date range
   */
  static getSummaryByDateRange(start_date, end_date) {
    return db.prepare(`
      SELECT
        COUNT(*) as purchase_count,
        SUM(quantity) as total_quantity,
        SUM(total_cost) as total_cost,
        COUNT(DISTINCT item_id) as unique_items,
        COUNT(DISTINCT supplier_name) as unique_suppliers
      FROM purchases
      WHERE purchase_date BETWEEN ? AND ?
    `).get(start_date, end_date);
  }

  /**
   * Get top suppliers by purchase value
   */
  static getTopSuppliers(limit = 10) {
    return db.prepare(`
      SELECT
        supplier_name,
        COUNT(*) as purchase_count,
        SUM(quantity) as total_quantity,
        SUM(total_cost) as total_cost
      FROM purchases
      WHERE supplier_name IS NOT NULL
      GROUP BY supplier_name
      ORDER BY total_cost DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Delete purchase (should be restricted)
   */
  static delete(id, userId) {
    // Note: In a real system, you might want to prevent deletion
    // or reverse the stock movement instead
    const purchase = this.getById(id);

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Delete the purchase (stock movement will remain for audit)
    db.prepare('DELETE FROM purchases WHERE id = ?').run(id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      'DELETE',
      'Purchase',
      id,
      `Deleted purchase ${purchase.purchase_no}`
    );

    return true;
  }
}

module.exports = Purchase;
