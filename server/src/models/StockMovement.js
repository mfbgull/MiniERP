const db = require('../config/database');

class StockMovement {
  /**
   * Record a stock movement (IN or OUT)
   * This function handles:
   * 1. Creating stock_movement record
   * 2. Updating stock_balances
   * 3. Updating item.current_stock
   * All within a transaction for data integrity
   */
  static recordMovement(data, userId) {
    const transaction = db.transaction(() => {
      // 1. Generate movement number
      const movementNo = this.generateMovementNo();

      // 2. Insert stock movement
      const movementStmt = db.prepare(`
        INSERT INTO stock_movements (
          movement_no, item_id, warehouse_id, movement_type,
          quantity, unit_cost, reference_doctype, reference_docno,
          remarks, movement_date, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = movementStmt.run(
        movementNo,
        data.item_id,
        data.warehouse_id,
        data.movement_type,
        data.quantity, // Positive for IN, Negative for OUT
        data.unit_cost || null,
        data.reference_doctype || null,
        data.reference_docno || null,
        data.remarks || null,
        data.movement_date || new Date().toISOString().split('T')[0],
        userId
      );

      // 3. Update stock_balances
      const existingBalance = db.prepare(`
        SELECT * FROM stock_balances
        WHERE item_id = ? AND warehouse_id = ?
      `).get(data.item_id, data.warehouse_id);

      if (existingBalance) {
        db.prepare(`
          UPDATE stock_balances
          SET quantity = quantity + ?,
              last_updated = CURRENT_TIMESTAMP
          WHERE item_id = ? AND warehouse_id = ?
        `).run(data.quantity, data.item_id, data.warehouse_id);
      } else {
        db.prepare(`
          INSERT INTO stock_balances (item_id, warehouse_id, quantity)
          VALUES (?, ?, ?)
        `).run(data.item_id, data.warehouse_id, data.quantity);
      }

      // 4. Update item.current_stock (sum across all warehouses)
      db.prepare(`
        UPDATE items
        SET current_stock = (
          SELECT COALESCE(SUM(quantity), 0)
          FROM stock_balances
          WHERE item_id = ?
        )
        WHERE id = ?
      `).run(data.item_id, data.item_id);

      return {
        id: result.lastInsertRowid,
        movement_no: movementNo
      };
    });

    return transaction();
  }

  /**
   * Generate movement number (STK-YYYY-NNNN)
   */
  static generateMovementNo() {
    const year = new Date().getFullYear();
    const settingKey = `STK_last_no_${year}`;

    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);

    let nextNo = 1;
    if (setting) {
      nextNo = parseInt(setting.value) + 1;
    }

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `).run(settingKey, nextNo.toString());

    return `STK-${year}-${nextNo.toString().padStart(4, '0')}`;
  }

  /**
   * Get all stock movements with filters
   */
  static getAll(filters = {}) {
    let query = `
      SELECT
        sm.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name,
        u.full_name as created_by_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.item_id) {
      query += ' AND sm.item_id = ?';
      params.push(filters.item_id);
    }

    if (filters.warehouse_id) {
      query += ' AND sm.warehouse_id = ?';
      params.push(filters.warehouse_id);
    }

    if (filters.movement_type) {
      query += ' AND sm.movement_type = ?';
      params.push(filters.movement_type);
    }

    if (filters.date_from) {
      query += ' AND sm.movement_date >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ' AND sm.movement_date <= ?';
      params.push(filters.date_to);
    }

    query += ' ORDER BY sm.movement_date DESC, sm.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Get movement by ID
   */
  static getById(id) {
    return db.prepare(`
      SELECT
        sm.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.id = ?
    `).get(id);
  }

  /**
   * Get stock ledger for an item
   */
  static getItemLedger(itemId, warehouseId = null) {
    let query = `
      SELECT
        sm.*,
        w.warehouse_code,
        w.warehouse_name
      FROM stock_movements sm
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.item_id = ?
    `;
    const params = [itemId];

    if (warehouseId) {
      query += ' AND sm.warehouse_id = ?';
      params.push(warehouseId);
    }

    query += ' ORDER BY sm.movement_date DESC, sm.created_at DESC';

    return db.prepare(query).all(...params);
  }

  /**
   * Get current stock balances for all items
   */
  static getStockSummary() {
    return db.prepare(`
      SELECT
        i.id,
        i.item_code,
        i.item_name,
        i.category,
        i.unit_of_measure,
        i.current_stock,
        i.reorder_level,
        i.standard_cost,
        i.current_stock * i.standard_cost as stock_value,
        CASE
          WHEN i.current_stock <= i.reorder_level AND i.reorder_level > 0 THEN 1
          ELSE 0
        END as low_stock
      FROM items i
      WHERE i.is_active = 1
      ORDER BY i.item_name
    `).all();
  }

  /**
   * Get stock balance for specific item and warehouse
   */
  static getBalance(itemId, warehouseId) {
    return db.prepare(`
      SELECT COALESCE(quantity, 0) as quantity
      FROM stock_balances
      WHERE item_id = ? AND warehouse_id = ?
    `).get(itemId, warehouseId);
  }
}

module.exports = StockMovement;
