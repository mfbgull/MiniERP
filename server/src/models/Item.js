const db = require('../config/database');

class Item {
  /**
   * Get all items with optional filters
   */
  static getAll(filters = {}) {
    let query = 'SELECT * FROM items WHERE is_active = 1';
    const params = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (item_code LIKE ? OR item_name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.is_raw_material !== undefined) {
      query += ' AND is_raw_material = ?';
      params.push(filters.is_raw_material ? 1 : 0);
    }

    if (filters.is_finished_good !== undefined) {
      query += ' AND is_finished_good = ?';
      params.push(filters.is_finished_good ? 1 : 0);
    }

    query += ' ORDER BY item_name';

    return db.prepare(query).all(...params);
  }

  /**
   * Get item by ID
   */
  static getById(id) {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  }

  /**
   * Get item by code
   */
  static getByCode(code) {
    return db.prepare('SELECT * FROM items WHERE item_code = ?').get(code);
  }

  /**
   * Create new item
   */
  static create(data, userId) {
    const stmt = db.prepare(`
      INSERT INTO items (
        item_code, item_name, description, category,
        unit_of_measure, reorder_level, standard_cost, standard_selling_price,
        is_raw_material, is_finished_good, is_purchased, is_manufactured,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.item_code,
      data.item_name,
      data.description || null,
      data.category || null,
      data.unit_of_measure || 'Nos',
      data.reorder_level || 0,
      data.standard_cost || 0,
      data.standard_selling_price || 0,
      data.is_raw_material ? 1 : 0,
      data.is_finished_good ? 1 : 0,
      data.is_purchased !== undefined ? (data.is_purchased ? 1 : 0) : 1,
      data.is_manufactured ? 1 : 0,
      userId
    );

    return result.lastInsertRowid;
  }

  /**
   * Update item
   */
  static update(id, data) {
    const stmt = db.prepare(`
      UPDATE items
      SET item_name = ?,
          description = ?,
          category = ?,
          unit_of_measure = ?,
          reorder_level = ?,
          standard_cost = ?,
          standard_selling_price = ?,
          is_raw_material = ?,
          is_finished_good = ?,
          is_purchased = ?,
          is_manufactured = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(
      data.item_name,
      data.description || null,
      data.category || null,
      data.unit_of_measure,
      data.reorder_level || 0,
      data.standard_cost || 0,
      data.standard_selling_price || 0,
      data.is_raw_material ? 1 : 0,
      data.is_finished_good ? 1 : 0,
      data.is_purchased ? 1 : 0,
      data.is_manufactured ? 1 : 0,
      id
    );
  }

  /**
   * Soft delete item
   */
  static delete(id) {
    const stmt = db.prepare('UPDATE items SET is_active = 0 WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * Get item stock by warehouse
   */
  static getStockByWarehouse(itemId) {
    return db.prepare(`
      SELECT
        w.id as warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        COALESCE(sb.quantity, 0) as quantity
      FROM warehouses w
      LEFT JOIN stock_balances sb ON sb.warehouse_id = w.id AND sb.item_id = ?
      WHERE w.is_active = 1
      ORDER BY w.warehouse_name
    `).all(itemId);
  }

  /**
   * Get all categories
   */
  static getCategories() {
    return db.prepare(`
      SELECT DISTINCT category
      FROM items
      WHERE category IS NOT NULL AND is_active = 1
      ORDER BY category
    `).all();
  }

  /**
   * Get items with low stock (below reorder level)
   */
  static getLowStock() {
    return db.prepare(`
      SELECT *
      FROM items
      WHERE is_active = 1
      AND current_stock < reorder_level
      AND reorder_level > 0
      ORDER BY item_name
    `).all();
  }
}

module.exports = Item;
