const express = require('express');
const router = express.Router();
const {
  getARAgingReport,
  getCustomerStatements,
  getTopDebtors,
  getDSOMetric,
  getReceivablesSummary
} = require('../controllers/reportsController');

// GET /api/reports/ar-aging - AR aging report
router.get('/ar-aging', getARAgingReport);

// GET /api/reports/customer-statements - Customer statements
router.get('/customer-statements', getCustomerStatements);

// GET /api/reports/top-debtors - Top debtors list
router.get('/top-debtors', getTopDebtors);

// GET /api/reports/dso - Days Sales Outstanding
router.get('/dso', getDSOMetric);

// GET /api/reports/ar-summary - Receivables summary
router.get('/ar-summary', getReceivablesSummary);

module.exports = router;