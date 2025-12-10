const BOM = require('../models/BOM');

// Get all BOMs
exports.getAllBOMs = async (req, res, next) => {
  try {
    const boms = BOM.getAll();
    res.json(boms);
  } catch (error) {
    next(error);
  }
};

// Get BOM by ID
exports.getBOMById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bom = BOM.getById(id);

    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
};

// Get BOMs by finished item
exports.getBOMsByFinishedItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const boms = BOM.getByFinishedItem(itemId);
    res.json(boms);
  } catch (error) {
    next(error);
  }
};

// Create new BOM
exports.createBOM = async (req, res, next) => {
  try {
    const { finished_item_id, quantity, bom_name, description, items } = req.body;

    // Validation
    if (!finished_item_id || !quantity || !bom_name || !items || items.length === 0) {
      return res.status(400).json({
        error: 'finished_item_id, quantity, bom_name, and at least one item are required'
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          error: 'Each item must have item_id and quantity > 0'
        });
      }
    }

    const bom = BOM.create(req.body, req.user.id);

    console.log(`Created BOM: ${bom.bom_no} for ${bom.finished_item_name}`);

    res.status(201).json(bom);
  } catch (error) {
    next(error);
  }
};

// Update BOM
exports.updateBOM = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bom = BOM.update(id, req.body, req.user.id);

    console.log(`Updated BOM: ${bom.bom_no}`);

    res.json(bom);
  } catch (error) {
    next(error);
  }
};

// Delete BOM
exports.deleteBOM = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get BOM details before deleting
    const bom = BOM.getById(id);

    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    BOM.delete(id);

    console.log(`Deleted BOM: ${bom.bom_no}`);

    res.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Toggle BOM active status
exports.toggleBOMActive = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bom = BOM.toggleActive(id);

    console.log(`${bom.is_active ? 'Activated' : 'Deactivated'} BOM: ${bom.bom_no}`);

    res.json(bom);
  } catch (error) {
    next(error);
  }
};
