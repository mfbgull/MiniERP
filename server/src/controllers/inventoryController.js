const Item = require('../models/Item');
const Warehouse = require('../models/Warehouse');
const StockMovement = require('../models/StockMovement');
const db = require('../config/database');

// ============================================
// ITEMS
// ============================================

function getItems(req, res) {
  try {
    const items = Item.getAll(req.query);
    res.json(items);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
}

function getItem(req, res) {
  try {
    const item = Item.getById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get stock by warehouse
    const stockByWarehouse = Item.getStockByWarehouse(item.id);

    res.json({
      ...item,
      stock_by_warehouse: stockByWarehouse
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
}

function createItem(req, res) {
  try {
    const { item_code, item_name } = req.body;

    if (!item_code || !item_name) {
      return res.status(400).json({ error: 'Item code and name are required' });
    }

    // Check if item code already exists
    const existing = Item.getByCode(item_code);
    if (existing) {
      return res.status(400).json({ error: 'Item code already exists' });
    }

    const itemId = Item.create(req.body, req.user.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'CREATE', 'Item', itemId, `Created item: ${item_name}`);

    const newItem = Item.getById(itemId);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
}

function updateItem(req, res) {
  try {
    const itemId = req.params.id;
    const existingItem = Item.getById(itemId);

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    Item.update(itemId, req.body);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE', 'Item', itemId, `Updated item: ${req.body.item_name}`);

    const updatedItem = Item.getById(itemId);
    res.json(updatedItem);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
}

function deleteItem(req, res) {
  try {
    const itemId = req.params.id;
    const item = Item.getById(itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if item has stock
    if (item.current_stock > 0) {
      return res.status(400).json({ error: 'Cannot delete item with existing stock' });
    }

    Item.delete(itemId);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE', 'Item', itemId, `Deleted item: ${item.item_name}`);

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
}

function getCategories(req, res) {
  try {
    const categories = Item.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

function getLowStock(req, res) {
  try {
    const items = Item.getLowStock();
    res.json(items);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
}

// ============================================
// WAREHOUSES
// ============================================

function getWarehouses(req, res) {
  try {
    const warehouses = Warehouse.getAll();
    res.json(warehouses);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
}

function getWarehouse(req, res) {
  try {
    const warehouse = Warehouse.getById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Get stock summary for this warehouse
    const stockSummary = Warehouse.getStockSummary(warehouse.id);

    res.json({
      ...warehouse,
      stock_summary: stockSummary
    });
  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
}

function createWarehouse(req, res) {
  try {
    const { warehouse_code, warehouse_name } = req.body;

    if (!warehouse_code || !warehouse_name) {
      return res.status(400).json({ error: 'Warehouse code and name are required' });
    }

    // Check if warehouse code already exists
    const existing = Warehouse.getByCode(warehouse_code);
    if (existing) {
      return res.status(400).json({ error: 'Warehouse code already exists' });
    }

    const warehouseId = Warehouse.create(req.body);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'CREATE', 'Warehouse', warehouseId, `Created warehouse: ${warehouse_name}`);

    const newWarehouse = Warehouse.getById(warehouseId);
    res.status(201).json(newWarehouse);
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
}

function updateWarehouse(req, res) {
  try {
    const warehouseId = req.params.id;
    const existing = Warehouse.getById(warehouseId);

    if (!existing) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    Warehouse.update(warehouseId, req.body);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE', 'Warehouse', warehouseId, `Updated warehouse: ${req.body.warehouse_name}`);

    const updated = Warehouse.getById(warehouseId);
    res.json(updated);
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
}

// ============================================
// STOCK MOVEMENTS
// ============================================

function getStockMovements(req, res) {
  try {
    const movements = StockMovement.getAll(req.query);
    res.json(movements);
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
}

function createStockMovement(req, res) {
  try {
    const { item_id, warehouse_id, quantity, movement_type } = req.body;

    if (!item_id || !warehouse_id || !quantity || !movement_type) {
      return res.status(400).json({ error: 'Item, warehouse, quantity, and movement type are required' });
    }

    const result = StockMovement.recordMovement(req.body, req.user.id);

    // Log activity
    const item = Item.getById(item_id);
    const warehouse = Warehouse.getById(warehouse_id);
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      'CREATE',
      'StockMovement',
      result.id,
      `${movement_type}: ${quantity} ${item.unit_of_measure} of ${item.item_name} at ${warehouse.warehouse_name}`
    );

    const movement = StockMovement.getById(result.id);
    res.status(201).json(movement);
  } catch (error) {
    console.error('Create stock movement error:', error);
    res.status(500).json({ error: 'Failed to create stock movement' });
  }
}

function getStockSummary(req, res) {
  try {
    const summary = StockMovement.getStockSummary();
    res.json(summary);
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Failed to fetch stock summary' });
  }
}

function getItemLedger(req, res) {
  try {
    const itemId = req.params.itemId;
    const warehouseId = req.query.warehouse_id || null;

    const ledger = StockMovement.getItemLedger(itemId, warehouseId);
    res.json(ledger);
  } catch (error) {
    console.error('Get item ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch item ledger' });
  }
}

function getStockBalances(req, res) {
  try {
    const balances = db.prepare(`
      SELECT
        sb.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        w.warehouse_code,
        w.warehouse_name
      FROM stock_balances sb
      JOIN items i ON sb.item_id = i.id
      JOIN warehouses w ON sb.warehouse_id = w.id
      ORDER BY i.item_code, w.warehouse_code
    `).all();

    res.json(balances);
  } catch (error) {
    console.error('Get stock balances error:', error);
    res.status(500).json({ error: 'Failed to fetch stock balances' });
  }
}

module.exports = {
  // Items
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
  getLowStock,

  // Warehouses
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,

  // Stock Movements
  getStockMovements,
  createStockMovement,
  getStockSummary,
  getItemLedger,
  getStockBalances
};
