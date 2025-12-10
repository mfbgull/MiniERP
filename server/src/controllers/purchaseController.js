const Purchase = require('../models/Purchase');

/**
 * Record a new purchase
 */
function recordPurchase(req, res) {
  try {
    const {
      item_id,
      warehouse_id,
      quantity,
      unit_cost,
      supplier_name,
      purchase_date,
      invoice_no,
      remarks
    } = req.body;

    // Validation
    if (!item_id || !warehouse_id || !quantity || !unit_cost || !purchase_date) {
      return res.status(400).json({
        error: 'Item, warehouse, quantity, unit cost, and purchase date are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    if (unit_cost < 0) {
      return res.status(400).json({ error: 'Unit cost cannot be negative' });
    }

    const purchase = Purchase.recordPurchase(req.body, req.user.id);

    res.status(201).json(purchase);
  } catch (error) {
    console.error('Record purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to record purchase' });
  }
}

/**
 * Get all purchases with filters
 */
function getPurchases(req, res) {
  try {
    const filters = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      item_id: req.query.item_id,
      warehouse_id: req.query.warehouse_id,
      supplier_name: req.query.supplier_name,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const purchases = Purchase.getAll(filters);

    res.json(purchases);
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ error: 'Failed to get purchases' });
  }
}

/**
 * Get purchase by ID
 */
function getPurchase(req, res) {
  try {
    const purchase = Purchase.getById(req.params.id);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json(purchase);
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ error: 'Failed to get purchase' });
  }
}

/**
 * Get purchase summary by item
 */
function getPurchaseSummaryByItem(req, res) {
  try {
    const { item_id } = req.params;

    if (!item_id) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    const summary = Purchase.getSummaryByItem(item_id);

    res.json(summary);
  } catch (error) {
    console.error('Get purchase summary error:', error);
    res.status(500).json({ error: 'Failed to get purchase summary' });
  }
}

/**
 * Get purchase summary by date range
 */
function getPurchaseSummaryByDateRange(req, res) {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const summary = Purchase.getSummaryByDateRange(start_date, end_date);

    res.json(summary);
  } catch (error) {
    console.error('Get purchase summary error:', error);
    res.status(500).json({ error: 'Failed to get purchase summary' });
  }
}

/**
 * Get top suppliers
 */
function getTopSuppliers(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const suppliers = Purchase.getTopSuppliers(limit);

    res.json(suppliers);
  } catch (error) {
    console.error('Get top suppliers error:', error);
    res.status(500).json({ error: 'Failed to get top suppliers' });
  }
}

/**
 * Delete purchase
 */
function deletePurchase(req, res) {
  try {
    Purchase.delete(req.params.id, req.user.id);

    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete purchase' });
  }
}

module.exports = {
  recordPurchase,
  getPurchases,
  getPurchase,
  getPurchaseSummaryByItem,
  getPurchaseSummaryByDateRange,
  getTopSuppliers,
  deletePurchase
};
