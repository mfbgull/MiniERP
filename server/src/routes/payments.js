const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  allocatePaymentToInvoice
} = require('../controllers/paymentsController');

// GET /api/payments - List all payments
router.get('/', getPayments);

// GET /api/payments/:id - Single payment
router.get('/:id', getPayment);

// POST /api/payments - Create new payment with invoice allocation
router.post('/', createPayment);

// PUT /api/payments/:id - Update payment
router.put('/:id', updatePayment);

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', deletePayment);

// POST /api/payments/:id/allocate - Allocate payment to invoice
router.post('/:id/allocate', allocatePaymentToInvoice);

module.exports = router;