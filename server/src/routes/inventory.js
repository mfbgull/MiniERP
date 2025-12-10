const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');

// All inventory routes require authentication
router.use(authenticateToken);

// ============================================
// ITEMS
// ============================================

router.get('/items', inventoryController.getItems);
router.get('/items/:id', inventoryController.getItem);
router.post('/items', inventoryController.createItem);
router.put('/items/:id', inventoryController.updateItem);
router.delete('/items/:id', inventoryController.deleteItem);

// Item utilities
router.get('/items-categories', inventoryController.getCategories);
router.get('/items-low-stock', inventoryController.getLowStock);

// ============================================
// WAREHOUSES
// ============================================

router.get('/warehouses', inventoryController.getWarehouses);
router.get('/warehouses/:id', inventoryController.getWarehouse);
router.post('/warehouses', inventoryController.createWarehouse);
router.put('/warehouses/:id', inventoryController.updateWarehouse);

// ============================================
// STOCK MOVEMENTS
// ============================================

router.get('/stock-movements', inventoryController.getStockMovements);
router.post('/stock-movements', inventoryController.createStockMovement);

// Stock reports
router.get('/stock-summary', inventoryController.getStockSummary);
router.get('/stock-ledger/:itemId', inventoryController.getItemLedger);

module.exports = router;
