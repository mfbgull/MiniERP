const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const purchaseController = require('../controllers/purchaseController');

// All routes require authentication
router.use(authenticateToken);

// Purchase routes
router.post('/purchases', purchaseController.recordPurchase);
router.get('/purchases', purchaseController.getPurchases);
router.get('/purchases/:id', purchaseController.getPurchase);
router.delete('/purchases/:id', purchaseController.deletePurchase);

// Summary and reports
router.get('/purchases/summary/item/:item_id', purchaseController.getPurchaseSummaryByItem);
router.get('/purchases/summary/daterange', purchaseController.getPurchaseSummaryByDateRange);
router.get('/purchases/top-suppliers', purchaseController.getTopSuppliers);

module.exports = router;
