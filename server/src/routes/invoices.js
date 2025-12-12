const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken } = require('../middleware/auth');

// All invoice routes require authentication
router.use(authenticateToken);

// Get all invoices
router.get('/', invoiceController.getInvoices);

// Get a specific invoice
router.get('/:id', invoiceController.getInvoice);

// Get payments for a specific invoice
router.get('/:id/payments', invoiceController.getInvoicePayments);

// Create a new invoice
router.post('/', invoiceController.createInvoice);

// Update an invoice
router.put('/:id', invoiceController.updateInvoice);

// Delete an invoice
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;