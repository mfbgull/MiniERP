const db = require('../config/database');

class Warehouse {
  /**
   * Get all warehouses
   */
  static getAll() {
    return db.prepare(`
      SELECT * FROM warehouses
      WHERE is_active = 1
      ORDER BY warehouse_name
    `).all();
  }

  /**
   * Get warehouse by ID
   */
  static getById(id) {
    return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  }

  /**
   * Get warehouse by code
   */
  static getByCode(code) {
    return db.prepare('SELECT * FROM warehouses WHERE warehouse_code = ?').get(code);
  }

  /**
   * Create new warehouse
   */
  static create(data) {
    const stmt = db.prepare(`
      INSERT INTO warehouses (warehouse_code, warehouse_name, location)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      data.warehouse_code,
      data.warehouse_name,
      data.location || null
    );

    return result.lastInsertRowid;
  }

  /**
   * Update warehouse
   */
  static update(id, data) {
    const stmt = db.prepare(`
      UPDATE warehouses
      SET warehouse_name = ?,
          location = ?
      WHERE id = ?
    `);

    return stmt.run(
      data.warehouse_name,
      data.location || null,
      id
    );
  }

  /**
   * Soft delete warehouse
   */
  static delete(id) {
    const stmt = db.prepare('UPDATE warehouses SET is_active = 0 WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * Get stock summary for a warehouse
   */
  static getStockSummary(warehouseId) {
    return db.prepare(`
      SELECT
        i.id,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        COALESCE(sb.quantity, 0) as quantity,
        i.standard_cost,
        COALESCE(sb.quantity, 0) * i.standard_cost as value
      FROM items i
      LEFT JOIN stock_balances sb ON sb.item_id = i.id AND sb.warehouse_id = ?
      WHERE i.is_active = 1
      AND (sb.quantity > 0 OR sb.quantity IS NULL)
      ORDER BY i.item_name
    `).all(warehouseId);
  }
}

module.exports = Warehouse;
