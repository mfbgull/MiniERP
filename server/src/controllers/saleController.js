const Sale = require('../models/Sale');

/**
 * Record a new sale
 */
function recordSale(req, res) {
  try {
    const {
      item_id,
      warehouse_id,
      quantity,
      unit_price,
      customer_name,
      sale_date,
      invoice_no,
      remarks
    } = req.body;

    // Validation
    if (!item_id || !warehouse_id || !quantity || !unit_price || !sale_date) {
      return res.status(400).json({
        error: 'Item, warehouse, quantity, unit price, and sale date are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    if (unit_price < 0) {
      return res.status(400).json({ error: 'Unit price cannot be negative' });
    }

    const sale = Sale.recordSale(req.body, req.user.id);

    res.status(201).json(sale);
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ error: error.message || 'Failed to record sale' });
  }
}

/**
 * Get all sales with filters
 */
function getSales(req, res) {
  try {
    const filters = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      item_id: req.query.item_id,
      warehouse_id: req.query.warehouse_id,
      customer_name: req.query.customer_name,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const sales = Sale.getAll(filters);

    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Failed to get sales' });
  }
}

/**
 * Get sale by ID
 */
function getSale(req, res) {
  try {
    const sale = Sale.getById(req.params.id);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Failed to get sale' });
  }
}

/**
 * Get sales summary by item
 */
function getSalesSummaryByItem(req, res) {
  try {
    const { item_id } = req.params;

    if (!item_id) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    const summary = Sale.getSummaryByItem(item_id);

    res.json(summary);
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
}

/**
 * Get sales summary by date range
 */
function getSalesSummaryByDateRange(req, res) {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const summary = Sale.getSummaryByDateRange(start_date, end_date);

    res.json(summary);
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
}

/**
 * Get top customers
 */
function getTopCustomers(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const customers = Sale.getTopCustomers(limit);

    res.json(customers);
  } catch (error) {
    console.error('Get top customers error:', error);
    res.status(500).json({ error: 'Failed to get top customers' });
  }
}

/**
 * Delete sale
 */
function deleteSale(req, res) {
  try {
    Sale.delete(req.params.id, req.user.id);

    res.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete sale' });
  }
}

module.exports = {
  recordSale,
  getSales,
  getSale,
  getSalesSummaryByItem,
  getSalesSummaryByDateRange,
  getTopCustomers,
  deleteSale
};
