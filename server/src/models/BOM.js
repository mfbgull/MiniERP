const db = require('../config/database');

class BOM {
  static generateBOMNo() {
    const year = new Date().getFullYear();
    const prefix = `BOM-${year}-`;

    const lastBOM = db.prepare(`
      SELECT bom_no FROM boms
      WHERE bom_no LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(`${prefix}%`);

    if (!lastBOM) {
      return `${prefix}0001`;
    }

    const lastNumber = parseInt(lastBOM.bom_no.split('-')[2]);
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `${prefix}${nextNumber}`;
  }

  static create(data, userId) {
    const { finished_item_id, quantity, bom_name, description, items } = data;

    const transaction = db.transaction(() => {
      const bomNo = this.generateBOMNo();

      // Insert BOM header
      const bomInsert = db.prepare(`
        INSERT INTO boms (bom_no, bom_name, finished_item_id, quantity, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = bomInsert.run(
        bomNo,
        bom_name,
        finished_item_id,
        quantity,
        description || null,
        userId
      );

      const bomId = result.lastInsertRowid;

      // Insert BOM items (raw materials)
      const itemInsert = db.prepare(`
        INSERT INTO bom_items (bom_id, item_id, quantity)
        VALUES (?, ?, ?)
      `);

      for (const item of items) {
        itemInsert.run(bomId, item.item_id, item.quantity);
      }

      // Return complete BOM with items
      return this.getById(bomId);
    });

    return transaction();
  }

  static getAll() {
    const boms = db.prepare(`
      SELECT
        b.id,
        b.bom_no,
        b.bom_name,
        b.finished_item_id,
        i.item_code AS finished_item_code,
        i.item_name AS finished_item_name,
        i.unit_of_measure AS finished_uom,
        b.quantity,
        b.description,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM boms b
      JOIN items i ON b.finished_item_id = i.id
      ORDER BY b.created_at DESC
    `).all();

    // Get item counts for each BOM
    return boms.map(bom => {
      const itemCount = db.prepare(`
        SELECT COUNT(*) as count FROM bom_items WHERE bom_id = ?
      `).get(bom.id);

      return {
        ...bom,
        item_count: itemCount.count
      };
    });
  }

  static getById(id) {
    const bom = db.prepare(`
      SELECT
        b.id,
        b.bom_no,
        b.bom_name,
        b.finished_item_id,
        i.item_code AS finished_item_code,
        i.item_name AS finished_item_name,
        i.unit_of_measure AS finished_uom,
        b.quantity,
        b.description,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM boms b
      JOIN items i ON b.finished_item_id = i.id
      WHERE b.id = ?
    `).get(id);

    if (!bom) {
      return null;
    }

    // Get BOM items (raw materials)
    const items = db.prepare(`
      SELECT
        bi.id,
        bi.item_id,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        i.current_stock,
        bi.quantity
      FROM bom_items bi
      JOIN items i ON bi.item_id = i.id
      WHERE bi.bom_id = ?
      ORDER BY bi.id
    `).all(id);

    return {
      ...bom,
      items
    };
  }

  static getByFinishedItem(finishedItemId) {
    return db.prepare(`
      SELECT
        b.id,
        b.bom_no,
        b.bom_name,
        b.finished_item_id,
        i.item_code AS finished_item_code,
        i.item_name AS finished_item_name,
        i.unit_of_measure AS finished_uom,
        b.quantity,
        b.description,
        b.is_active
      FROM boms b
      JOIN items i ON b.finished_item_id = i.id
      WHERE b.finished_item_id = ? AND b.is_active = 1
      ORDER BY b.created_at DESC
    `).all(finishedItemId);
  }

  static update(id, data, userId) {
    const { bom_name, description, quantity, is_active, items } = data;

    const transaction = db.transaction(() => {
      // Update BOM header
      const updateBOM = db.prepare(`
        UPDATE boms
        SET bom_name = ?, description = ?, quantity = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateBOM.run(bom_name, description || null, quantity, is_active, id);

      // If items provided, update them
      if (items) {
        // Delete existing items
        db.prepare('DELETE FROM bom_items WHERE bom_id = ?').run(id);

        // Insert new items
        const itemInsert = db.prepare(`
          INSERT INTO bom_items (bom_id, item_id, quantity)
          VALUES (?, ?, ?)
        `);

        for (const item of items) {
          itemInsert.run(id, item.item_id, item.quantity);
        }
      }

      return this.getById(id);
    });

    return transaction();
  }

  static delete(id) {
    // Check if BOM is used in any production
    const usedInProduction = db.prepare(`
      SELECT COUNT(*) as count FROM productions WHERE bom_id = ?
    `).get(id);

    if (usedInProduction.count > 0) {
      throw new Error('Cannot delete BOM: It has been used in production records');
    }

    const transaction = db.transaction(() => {
      // Delete BOM items first (cascade)
      db.prepare('DELETE FROM bom_items WHERE bom_id = ?').run(id);

      // Delete BOM
      const result = db.prepare('DELETE FROM boms WHERE id = ?').run(id);

      if (result.changes === 0) {
        throw new Error('BOM not found');
      }

      return true;
    });

    return transaction();
  }

  static toggleActive(id) {
    const bom = db.prepare('SELECT is_active FROM boms WHERE id = ?').get(id);

    if (!bom) {
      throw new Error('BOM not found');
    }

    const newStatus = bom.is_active ? 0 : 1;

    db.prepare('UPDATE boms SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStatus, id);

    return this.getById(id);
  }
}

module.exports = BOM;
