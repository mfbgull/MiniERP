const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const saleController = require('../controllers/saleController');

// All routes require authentication
router.use(authenticateToken);

// Sale routes
router.post('/sales', saleController.recordSale);
router.get('/sales', saleController.getSales);
router.get('/sales/:id', saleController.getSale);
router.delete('/sales/:id', saleController.deleteSale);

// Summary and reports
router.get('/sales/summary/item/:item_id', saleController.getSalesSummaryByItem);
router.get('/sales/summary/daterange', saleController.getSalesSummaryByDateRange);
router.get('/sales/top-customers', saleController.getTopCustomers);

module.exports = router;
