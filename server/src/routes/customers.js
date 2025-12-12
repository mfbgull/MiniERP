const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  getCustomerStatement,
  getCustomerBalance
} = require('../controllers/customersController');

// GET /api/customers - List all customers with AR balance
router.get('/', getCustomers);

// GET /api/customers/:id - Single customer with details
router.get('/:id', getCustomer);

// POST /api/customers - Create new customer
router.post('/', createCustomer);

// PUT /api/customers/:id - Update customer
router.put('/:id', updateCustomer);

// DELETE /api/customers/:id - Delete (deactivate) customer
router.delete('/:id', deleteCustomer);

// GET /api/customers/:id/ledger - Customer transaction history
router.get('/:id/ledger', getCustomerLedger);

// GET /api/customers/:id/statement - Customer statement
router.get('/:id/statement', getCustomerStatement);

// GET /api/customers/:id/balance - Current AR balance
router.get('/:id/balance', getCustomerBalance);

module.exports = router;