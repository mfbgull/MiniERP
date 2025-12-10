const db = require('../config/database');
const StockMovement = require('./StockMovement');

class Sale {
  /**
   * Record a direct sale
   * This will:
   * 1. Insert sales record
   * 2. Create stock movement (SALE type)
   * 3. Update stock balances (reduce stock)
   */
  static recordSale(data, userId) {
    const {
      item_id,
      warehouse_id,
      quantity,
      unit_price,
      customer_name,
      sale_date,
      invoice_no,
      remarks
    } = data;

    const transaction = db.transaction(() => {
      // Check if sufficient stock is available
      const stockBalance = db.prepare(`
        SELECT quantity FROM stock_balances
        WHERE item_id = ? AND warehouse_id = ?
      `).get(item_id, warehouse_id);

      const availableStock = stockBalance ? parseFloat(stockBalance.quantity) : 0;

      if (availableStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${availableStock}, Required: ${quantity}`);
      }

      // Generate sale number
      const saleNo = this.generateSaleNo();

      // Insert sales record
      const saleStmt = db.prepare(`
        INSERT INTO sales (
          sale_no, item_id, warehouse_id, quantity, unit_price, total_amount,
          customer_name, sale_date, invoice_no, remarks, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const totalAmount = quantity * unit_price;

      const result = saleStmt.run(
        saleNo,
        item_id,
        warehouse_id,
        quantity,
        unit_price,
        totalAmount,
        customer_name || null,
        sale_date,
        invoice_no || null,
        remarks || null,
        userId
      );

      const saleId = result.lastInsertRowid;

      // Create stock movement (negative quantity to reduce stock)
      StockMovement.recordMovement({
        item_id,
        warehouse_id,
        quantity: -quantity, // Negative to reduce stock
        movement_type: 'SALE',
        reference_type: 'Sale',
        reference_id: saleId,
        transaction_date: sale_date,
        remarks: `Sale: ${saleNo}${customer_name ? ' to ' + customer_name : ''}`
      }, userId);

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        'CREATE',
        'Sale',
        saleId,
        `Recorded sale ${saleNo}: ${quantity} units`
      );

      // Return sale with details
      return this.getById(saleId);
    });

    return transaction();
  }

  /**
   * Generate sale number (SALE-YYYY-NNNN)
   */
  static generateSaleNo() {
    const year = new Date().getFullYear();
    const settingKey = `SALE_last_no_${year}`;

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

    return `SALE-${year}-${nextNo.toString().padStart(4, '0')}`;
  }

  /**
   * Get all sales with item and warehouse details
   */
  static getAll(filters = {}) {
    let query = `
      SELECT
        s.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name,
        u.username as created_by_username
      FROM sales s
      JOIN items i ON s.item_id = i.id
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by date range
    if (filters.start_date) {
      query += ` AND s.sale_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= ?`;
      params.push(filters.end_date);
    }

    // Filter by item
    if (filters.item_id) {
      query += ` AND s.item_id = ?`;
      params.push(filters.item_id);
    }

    // Filter by warehouse
    if (filters.warehouse_id) {
      query += ` AND s.warehouse_id = ?`;
      params.push(filters.warehouse_id);
    }

    // Filter by customer name
    if (filters.customer_name) {
      query += ` AND s.customer_name LIKE ?`;
      params.push(`%${filters.customer_name}%`);
    }

    query += ` ORDER BY s.sale_date DESC, s.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Get sale by ID
   */
  static getById(id) {
    return db.prepare(`
      SELECT
        s.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name,
        u.username as created_by_username
      FROM sales s
      JOIN items i ON s.item_id = i.id
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `).get(id);
  }

  /**
   * Get sales summary by item
   */
  static getSummaryByItem(item_id) {
    return db.prepare(`
      SELECT
        COUNT(*) as sale_count,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as total_revenue,
        AVG(unit_price) as avg_unit_price,
        MIN(sale_date) as first_sale_date,
        MAX(sale_date) as last_sale_date
      FROM sales
      WHERE item_id = ?
    `).get(item_id);
  }

  /**
   * Get sales summary by date range
   */
  static getSummaryByDateRange(start_date, end_date) {
    return db.prepare(`
      SELECT
        COUNT(*) as sale_count,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as total_revenue,
        COUNT(DISTINCT item_id) as unique_items,
        COUNT(DISTINCT customer_name) as unique_customers
      FROM sales
      WHERE sale_date BETWEEN ? AND ?
    `).get(start_date, end_date);
  }

  /**
   * Get top customers by sales value
   */
  static getTopCustomers(limit = 10) {
    return db.prepare(`
      SELECT
        customer_name,
        COUNT(*) as sale_count,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as total_revenue
      FROM sales
      WHERE customer_name IS NOT NULL
      GROUP BY customer_name
      ORDER BY total_revenue DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Delete sale (should be restricted)
   */
  static delete(id, userId) {
    const sale = this.getById(id);

    if (!sale) {
      throw new Error('Sale not found');
    }

    // Delete the sale (stock movement will remain for audit)
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      'DELETE',
      'Sale',
      id,
      `Deleted sale ${sale.sale_no}`
    );

    return true;
  }
}

module.exports = Sale;
