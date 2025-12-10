const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');

// Get all BOMs
router.get('/', bomController.getAllBOMs);

// Get BOM by ID
router.get('/:id', bomController.getBOMById);

// Get BOMs by finished item
router.get('/by-item/:itemId', bomController.getBOMsByFinishedItem);

// Create new BOM
router.post('/', bomController.createBOM);

// Update BOM
router.put('/:id', bomController.updateBOM);

// Toggle BOM active status
router.patch('/:id/toggle-active', bomController.toggleBOMActive);

// Delete BOM
router.delete('/:id', bomController.deleteBOM);

module.exports = router;
