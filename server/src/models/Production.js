const db = require('../config/database');
const StockMovement = require('./StockMovement');

class Production {
  /**
   * Record a production/manufacturing operation
   * This will:
   * 1. Insert production record
   * 2. Create stock movements for consumed raw materials (negative)
   * 3. Create stock movement for produced finished goods (positive)
   * 4. Update stock balances
   */
  static recordProduction(data, userId) {
    const {
      output_item_id,
      output_quantity,
      warehouse_id, // Finished goods warehouse
      raw_materials_warehouse_id, // Optional: defaults to finished goods warehouse for backward compatibility
      production_date,
      input_items, // Array of { item_id, quantity }
      bom_id, // Optional BOM reference
      remarks
    } = data;

    // Use finished goods warehouse as default for raw materials if not specified (backward compatibility)
    const materialsWarehouseId = raw_materials_warehouse_id || warehouse_id;

    const transaction = db.transaction(() => {
      // Generate production number
      const productionNo = this.generateProductionNo();

      // Insert production record with both warehouse fields
      const productionStmt = db.prepare(`
        INSERT INTO productions (
          production_no, output_item_id, output_quantity, warehouse_id,
          raw_materials_warehouse_id, production_date, bom_id, remarks, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = productionStmt.run(
        productionNo,
        output_item_id,
        output_quantity,
        warehouse_id,
        materialsWarehouseId, // Store the raw materials warehouse
        production_date,
        bom_id || null,
        remarks || null,
        userId
      );

      const productionId = result.lastInsertRowid;

      // Insert input items (raw materials consumed)
      const inputStmt = db.prepare(`
        INSERT INTO production_inputs (
          production_id, item_id, quantity, warehouse_id
        ) VALUES (?, ?, ?, ?)
      `);

      // Consume raw materials (negative stock movements) from the source warehouse
      for (const input of input_items) {
        // Check if sufficient stock available in the materials warehouse
        const stockBalance = db.prepare(`
          SELECT quantity FROM stock_balances
          WHERE item_id = ? AND warehouse_id = ?
        `).get(input.item_id, materialsWarehouseId);

        const availableStock = stockBalance ? parseFloat(stockBalance.quantity) : 0;

        if (availableStock < input.quantity) {
          const item = db.prepare('SELECT item_name FROM items WHERE id = ?').get(input.item_id);
          throw new Error(`Insufficient stock for ${item.item_name} in warehouse. Available: ${availableStock}, Required: ${input.quantity}`);
        }

        // Record input item with warehouse information
        inputStmt.run(productionId, input.item_id, input.quantity, materialsWarehouseId);

        // Create negative stock movement (consumption) from the materials warehouse
        StockMovement.recordMovement({
          item_id: input.item_id,
          warehouse_id: materialsWarehouseId, // Consume from materials warehouse
          quantity: -input.quantity,
          movement_type: 'PRODUCTION',
          reference_type: 'Production',
          reference_id: productionId,
          transaction_date: production_date,
          remarks: `Consumed for production: ${productionNo} (from warehouse)`
        }, userId);
      }

      // Produce finished goods (positive stock movement) to the destination warehouse
      StockMovement.recordMovement({
        item_id: output_item_id,
        warehouse_id: warehouse_id, // Produce to finished goods warehouse
        quantity: output_quantity,
        movement_type: 'PRODUCTION',
        reference_type: 'Production',
        reference_id: productionId,
        transaction_date: production_date,
        remarks: `Produced to: ${productionNo} (to warehouse)`
      }, userId);

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        'CREATE',
        'Production',
        productionId,
        `Recorded production ${productionNo}: ${output_quantity} units produced (Materials from: WH-${materialsWarehouseId}, Goods to: WH-${warehouse_id})`
      );

      // Return production with details
      return this.getById(productionId);
    });

    return transaction();
  }

  /**
   * Generate production number (PROD-YYYY-NNNN)
   */
  static generateProductionNo() {
    const year = new Date().getFullYear();
    const settingKey = `PROD_last_no_${year}`;

    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);

    let nextNo = 1;
    if (setting) {
      nextNo = parseInt(setting.value) + 1;
    }

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(settingKey, nextNo.toString());

    return `PROD-${year}-${nextNo.toString().padStart(4, '0')}`;
  }

  /**
   * Get all productions with details
   */
  static getAll(filters = {}) {
    let query = `
      SELECT
        p.*,
        i.item_code as output_item_code,
        i.item_name as output_item_name,
        i.unit_of_measure as output_uom,
        fgw.warehouse_code as finished_goods_warehouse_code,
        fgw.warehouse_name as finished_goods_warehouse_name,
        rmw.warehouse_code as raw_materials_warehouse_code,
        rmw.warehouse_name as raw_materials_warehouse_name,
        u.username as created_by_username
      FROM productions p
      JOIN items i ON p.output_item_id = i.id
      JOIN warehouses fgw ON p.warehouse_id = fgw.id  -- Finished goods warehouse
      LEFT JOIN warehouses rmw ON p.raw_materials_warehouse_id = rmw.id  -- Raw materials warehouse
      JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.start_date) {
      query += ` AND p.production_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.production_date <= ?`;
      params.push(filters.end_date);
    }

    if (filters.output_item_id) {
      query += ` AND p.output_item_id = ?`;
      params.push(filters.output_item_id);
    }

    if (filters.warehouse_id) {
      // Filter by finished goods warehouse
      query += ` AND p.warehouse_id = ?`;
      params.push(filters.warehouse_id);
    }

    if (filters.raw_materials_warehouse_id) {
      // Filter by raw materials warehouse
      query += ` AND p.raw_materials_warehouse_id = ?`;
      params.push(filters.raw_materials_warehouse_id);
    }

    query += ` ORDER BY p.production_date DESC, p.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  /**
   * Get production by ID with input items
   */
  static getById(id) {
    const production = db.prepare(`
      SELECT
        p.*,
        i.item_code as output_item_code,
        i.item_name as output_item_name,
        i.unit_of_measure as output_uom,
        fgw.warehouse_code as finished_goods_warehouse_code,
        fgw.warehouse_name as finished_goods_warehouse_name,
        rmw.warehouse_code as raw_materials_warehouse_code,
        rmw.warehouse_name as raw_materials_warehouse_name,
        u.username as created_by_username
      FROM productions p
      JOIN items i ON p.output_item_id = i.id
      JOIN warehouses fgw ON p.warehouse_id = fgw.id  -- Finished goods warehouse
      LEFT JOIN warehouses rmw ON p.raw_materials_warehouse_id = rmw.id  -- Raw materials warehouse
      JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(id);

    if (production) {
      // Get input items with warehouse information
      production.inputs = db.prepare(`
        SELECT
          pi.*,
          i.item_code,
          i.item_name,
          i.unit_of_measure,
          w.warehouse_code as warehouse_code,
          w.warehouse_name as warehouse_name
        FROM production_inputs pi
        JOIN items i ON pi.item_id = i.id
        JOIN warehouses w ON pi.warehouse_id = w.id
        WHERE pi.production_id = ?
      `).all(id);
    }

    return production;
  }

  /**
   * Get production summary by output item
   */
  static getSummaryByItem(item_id) {
    return db.prepare(`
      SELECT
        COUNT(*) as production_count,
        SUM(output_quantity) as total_quantity_produced,
        MIN(production_date) as first_production_date,
        MAX(production_date) as last_production_date
      FROM productions
      WHERE output_item_id = ?
    `).get(item_id);
  }

  /**
   * Delete production
   */
  static delete(id, userId) {
    const production = this.getById(id);

    if (!production) {
      throw new Error('Production not found');
    }

    // Delete production inputs
    db.prepare('DELETE FROM production_inputs WHERE production_id = ?').run(id);

    // Delete production
    db.prepare('DELETE FROM productions WHERE id = ?').run(id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      'DELETE',
      'Production',
      id,
      `Deleted production ${production.production_no}`
    );

    return true;
  }
}

module.exports = Production;
