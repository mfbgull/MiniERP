const db = require('../config/database');

/**
 * Create a ledger entry for a customer transaction
 * @param {number} customerId - Customer ID
 * @param {string} type - Transaction type (INVOICE, PAYMENT, ADJUSTMENT, OPENING_BALANCE)
 * @param {string} referenceNo - Reference number
 * @param {number} debit - Debit amount
 * @param {number} credit - Credit amount
 * @param {string} description - Transaction description
 * @returns {number} - ID of created ledger entry
 */
function createLedgerEntry(customerId, type, referenceNo, debit, credit, description) {
  // Get current balance by looking at the last entry for this customer
  const lastBalanceResult = db.prepare(`
    SELECT balance FROM customer_ledger 
    WHERE customer_id = ? 
    ORDER BY id DESC 
    LIMIT 1
  `).get(customerId);
  
  const lastBalance = lastBalanceResult ? lastBalanceResult.balance : 0;
  
  // Calculate new balance (AR increases with debits, decreases with credits)
  const newBalance = parseFloat(lastBalance) + parseFloat(debit) - parseFloat(credit);
  
  const stmt = db.prepare(`
    INSERT INTO customer_ledger (
      customer_id, transaction_date, transaction_type, reference_no,
      debit, credit, balance, description
    ) VALUES (?, date('now'), ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    customerId,
    type,
    referenceNo,
    debit,
    credit,
    newBalance,
    description
  );
  
  return result.lastInsertRowid;
}

/**
 * Update customer balance by summing up related invoice balances
 * @param {number} customerId - Customer ID to update
 */
function updateCustomerBalance(customerId) {
  // Calculate customer balance as sum of all unpaid/partially paid invoice balances
  const balanceResult = db.prepare(`
    SELECT COALESCE(SUM(balance_amount), 0) as total_balance
    FROM invoices
    WHERE customer_id = ? AND status IN ('Unpaid', 'Partially Paid', 'Overdue')
  `).get(customerId);
  
  const newBalance = balanceResult.total_balance;
  
  // Update customer record with new balance
  const stmt = db.prepare('UPDATE customers SET current_balance = ? WHERE id = ?');
  stmt.run(newBalance, customerId);
  
  return newBalance;
}

/**
 * Calculate invoice balance based on total_amount and actual payments from payment_allocations
 * @param {number} invoiceId - Invoice ID to calculate balance for
 * @returns {number} - Calculated balance
 */
function calculateInvoiceBalance(invoiceId) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  // Calculate paid_amount from payment_allocations table (the actual source of truth)
  const paidResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payment_allocations
    WHERE invoice_id = ?
  `).get(invoiceId);

  const totalPaid = parseFloat(paidResult.total_paid || 0);
  const totalAmount = parseFloat(invoice.total_amount || 0);

  // Calculate balance as total - actual payments
  const newBalance = totalAmount - totalPaid;

  // Update invoice with new paid_amount and balance_amount
  const stmt = db.prepare('UPDATE invoices SET paid_amount = ?, balance_amount = ? WHERE id = ?');
  stmt.run(totalPaid, newBalance, invoiceId);

  return newBalance;
}

/**
 * Update invoice status based on balance
 * @param {number} invoiceId - Invoice ID to update status for
 * @returns {string} - Updated status
 */
function updateInvoiceStatus(invoiceId) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  
  const balance = parseFloat(invoice.balance_amount || 0);
  const total = parseFloat(invoice.total_amount || 0);
  const paid = parseFloat(invoice.paid_amount || 0);
  
  let newStatus = 'Unpaid';
  
  if (balance === 0 && total > 0) {
    newStatus = 'Paid';
  } else if (balance > 0 && balance < total) {
    newStatus = 'Partially Paid';
  } else if (balance === total && total > 0) {
    newStatus = 'Unpaid';
  }
  
  // Check if invoice is overdue
  if (newStatus !== 'Paid' && invoice.due_date && new Date(invoice.due_date) < new Date()) {
    newStatus = 'Overdue';
  }
  
  // Update invoice status
  const stmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
  stmt.run(newStatus, invoiceId);
  
  return newStatus;
}

/**
 * Update invoice status based on balance and due date
 * This function recalculates paid_amount from payment_allocations and updates status
 * @param {number} invoiceId - Invoice ID to update
 * @param {number} amountPaid - (Deprecated, ignored) Amount being paid - now calculated from allocations
 */
function updateInvoiceBalanceAndStatus(invoiceId, amountPaid = 0) {
  // Recalculate balance from payment_allocations (single source of truth)
  calculateInvoiceBalance(invoiceId);

  // Update status based on new balance
  return updateInvoiceStatus(invoiceId);
}

module.exports = {
  createLedgerEntry,
  updateCustomerBalance,
  calculateInvoiceBalance,
  updateInvoiceStatus,
  updateInvoiceBalanceAndStatus
};