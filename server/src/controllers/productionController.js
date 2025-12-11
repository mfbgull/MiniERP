const Production = require('../models/Production');

function recordProduction(req, res) {
  try {
    const {
      output_item_id,
      output_quantity,
      warehouse_id,
      raw_materials_warehouse_id, // New field
      production_date,
      input_items,
      remarks
    } = req.body;

    if (!output_item_id || !output_quantity || !warehouse_id || !production_date || !input_items || !input_items.length) {
      return res.status(400).json({ error: 'Output item, quantity, warehouse, date, and input items are required' });
    }

    if (output_quantity <= 0) {
      return res.status(400).json({ error: 'Output quantity must be positive' });
    }

    // Add raw_materials_warehouse_id to the data
    const productionData = {
      ...req.body,
      raw_materials_warehouse_id: raw_materials_warehouse_id || warehouse_id // Use finished goods warehouse as default
    };

    const production = Production.recordProduction(productionData, req.user.id);
    res.status(201).json(production);
  } catch (error) {
    console.error('Record production error:', error);
    res.status(500).json({ error: error.message || 'Failed to record production' });
  }
}

function getProductions(req, res) {
  try {
    const filters = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      output_item_id: req.query.output_item_id,
      warehouse_id: req.query.warehouse_id,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    res.json(Production.getAll(filters));
  } catch (error) {
    console.error('Get productions error:', error);
    res.status(500).json({ error: 'Failed to get productions' });
  }
}

function getProduction(req, res) {
  try {
    const production = Production.getById(req.params.id);
    if (!production) {
      return res.status(404).json({ error: 'Production not found' });
    }
    res.json(production);
  } catch (error) {
    console.error('Get production error:', error);
    res.status(500).json({ error: 'Failed to get production' });
  }
}

function getProductionSummaryByItem(req, res) {
  try {
    const { item_id } = req.params;
    if (!item_id) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    res.json(Production.getSummaryByItem(item_id));
  } catch (error) {
    console.error('Get production summary error:', error);
    res.status(500).json({ error: 'Failed to get production summary' });
  }
}

function deleteProduction(req, res) {
  try {
    Production.delete(req.params.id, req.user.id);
    res.json({ success: true, message: 'Production deleted successfully' });
  } catch (error) {
    console.error('Delete production error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete production' });
  }
}

module.exports = {
  recordProduction,
  getProductions,
  getProduction,
  getProductionSummaryByItem,
  deleteProduction
};
