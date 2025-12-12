const db = require('../config/database');
const { updateCustomerBalance, calculateInvoiceBalance, updateInvoiceStatus } = require('../utils/ledgerUtils');

// Get all payments
const getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', customerId, fromDate, toDate, sortBy = 'payment_date', sortOrder = 'DESC' } = req.query;
    
    let query = `
      SELECT 
        p.id, p.payment_no, p.customer_id, c.customer_name, p.invoice_id, i.invoice_no,
        p.payment_date, p.amount, p.payment_method, p.reference_no, p.notes, p.created_at,
        GROUP_CONCAT(pa.invoice_id, ',') as allocated_invoices,
        GROUP_CONCAT(pa.amount, ',') as allocation_amounts
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add filters
    if (search) {
      query += ` AND (p.payment_no LIKE ? OR c.customer_name LIKE ? OR p.reference_no LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (customerId) {
      query += ' AND p.customer_id = ?';
      params.push(parseInt(customerId, 10));
    }
    
    if (fromDate) {
      query += ' AND p.payment_date >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      query += ' AND p.payment_date <= ?';
      params.push(toDate);
    }
    
    query += ` GROUP BY p.id ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (page - 1) * parseInt(limit));
    
    const payments = db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;

    let countParams = [];
    if (search) {
      countQuery += ` AND (p.payment_no LIKE ? OR c.customer_name LIKE ? OR p.reference_no LIKE ?)`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam);
    }

    if (customerId) {
      countQuery += ' AND p.customer_id = ?';
      countParams.push(parseInt(customerId, 10));
    }

    if (fromDate) {
      countQuery += ' AND p.payment_date >= ?';
      countParams.push(fromDate);
    }

    if (toDate) {
      countQuery += ' AND p.payment_date <= ?';
      countParams.push(toDate);
    }

    const total = db.prepare(countQuery).get(...countParams).total;
    
    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: page < Math.ceil(total / parseInt(limit)),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
};

// Get single payment
const getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        p.id, p.payment_no, p.customer_id, c.customer_name, p.invoice_id, i.invoice_no,
        p.payment_date, p.amount, p.payment_method, p.reference_no, p.notes, p.created_at,
        GROUP_CONCAT(pa.invoice_id, ',') as allocated_invoices,
        GROUP_CONCAT(pa.amount, ',') as allocation_amounts,
        GROUP_CONCAT(pa.id, ',') as allocation_ids
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
      WHERE p.id = ?
      GROUP BY p.id
    `;
    
    const payment = db.prepare(query).get(id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Get detailed allocation information
    if (payment.allocated_invoices) {
      const allocationQuery = `
        SELECT pa.id, pa.payment_id, pa.invoice_id, i.invoice_no, pa.amount
        FROM payment_allocations pa
        LEFT JOIN invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = ?
        ORDER BY pa.id
      `;
      payment.allocations = db.prepare(allocationQuery).all(id);
    } else {
      payment.allocations = [];
    }
    
    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
};

// Create new payment with invoice allocation
const createPayment = async (req, res) => {
  try {
    const {
      customer_id,
      payment_date,
      amount,
      payment_method,
      reference_no,
      notes,
      invoice_allocations // Array of {invoice_id, amount}
    } = req.body;
    
    // Validate required fields
    if (!customer_id || !payment_date || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID, payment date, and amount are required'
      });
    }

    // Parse customer_id to integer to ensure consistent type comparison
    const parsedCustomerId = parseInt(customer_id, 10);

    // Validate invoice allocations
    if (!invoice_allocations || !Array.isArray(invoice_allocations) || invoice_allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one invoice allocation is required'
      });
    }

    // Verify customer exists
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(parsedCustomerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Generate payment number
    const maxPaymentNo = db.prepare('SELECT MAX(payment_no) as max_no FROM payments WHERE payment_no LIKE \'PAY%\'').get();
    let newPaymentNo = 'PAY001';
    
    if (maxPaymentNo && maxPaymentNo.max_no) {
      const lastNumber = parseInt(maxPaymentNo.max_no.replace('PAY', ''));
      newPaymentNo = `PAY${String(lastNumber + 1).padStart(3, '0')}`;
    }
    
    // Verify each invoice exists and is for the correct customer
    for (const alloc of invoice_allocations) {
      // Parse invoice_id to integer to ensure consistent type
      const parsedInvoiceId = parseInt(alloc.invoice_id, 10);

      const invoice = db.prepare(`
        SELECT id, customer_id, balance_amount, status
        FROM invoices
        WHERE id = ?
      `).get(parsedInvoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: `Invoice ${parsedInvoiceId} not found`
        });
      }

      // Debug logging
      console.log('Payment validation - Invoice:', parsedInvoiceId, 'Invoice customer_id:', invoice.customer_id, typeof invoice.customer_id, 'Parsed customer_id:', parsedCustomerId, typeof parsedCustomerId);

      // Compare with parsed customer ID (integer)
      if (invoice.customer_id !== parsedCustomerId) {
        return res.status(400).json({
          success: false,
          error: `Invoice ${parsedInvoiceId} does not belong to customer ${parsedCustomerId}`
        });
      }
      
      if (alloc.amount <= 0) {
        return res.status(400).json({
          success: false,
          error: `Allocation amount for invoice ${alloc.invoice_id} must be greater than 0`
        });
      }
    }
    
    // Verify that allocated amount equals the total payment amount
    const totalAllocated = invoice_allocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount), 0);
    if (Math.abs(totalAllocated - parseFloat(amount)) > 0.01) { // Small tolerance for floating point comparison
      return res.status(400).json({
        success: false,
        error: `Payment amount (${amount}) does not match total allocated amount (${totalAllocated})`
      });
    }
    
    // Begin transaction
    const transaction = db.transaction(() => {
      // Create payment record
      const paymentStmt = db.prepare(`
        INSERT INTO payments (
          payment_no, customer_id, payment_date, amount, 
          payment_method, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const paymentResult = paymentStmt.run(
        newPaymentNo,
        parsedCustomerId,
        payment_date,
        amount,
        payment_method || 'Cash',
        reference_no || '',
        notes || ''
      );
      
      const paymentId = paymentResult.lastInsertRowid;
      
      // Create payment allocation records
      const allocationStmt = db.prepare(`
        INSERT INTO payment_allocations (
          payment_id, invoice_id, amount
        ) VALUES (?, ?, ?)
      `);
      
      for (const alloc of invoice_allocations) {
        const invoiceId = parseInt(alloc.invoice_id, 10);
        allocationStmt.run(paymentId, invoiceId, alloc.amount);

        // Update invoice balance and status
        calculateInvoiceBalance(invoiceId);
        updateInvoiceStatus(invoiceId);
      }
      
      // Create customer ledger entry (credit to reduce AR balance)
      const ledgerStmt = db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, transaction_date, transaction_type, reference_no,
          debit, credit, balance, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Get current customer balance before this payment
      const currentBalance = db.prepare('SELECT current_balance FROM customers WHERE id = ?').get(parsedCustomerId).current_balance;
      const newBalance = parseFloat(currentBalance || 0) - parseFloat(amount);

      // Get invoice numbers for the description
      const invoiceNumbers = invoice_allocations.map(alloc => {
        const invoiceId = parseInt(alloc.invoice_id, 10);
        const inv = db.prepare('SELECT invoice_no FROM invoices WHERE id = ?').get(invoiceId);
        console.log('Ledger description - Looking up invoice:', invoiceId, 'Found:', inv);
        return inv && inv.invoice_no ? inv.invoice_no : `Invoice #${invoiceId}`;
      });

      ledgerStmt.run(
        parsedCustomerId,
        payment_date,
        'PAYMENT',
        newPaymentNo,
        0,  // debit
        amount,  // credit
        newBalance,  // new balance
        `Payment against ${invoiceNumbers.join(', ')}`
      );

      // Update customer balance
      updateCustomerBalance(parsedCustomerId);
      
      return paymentId;
    });
    
    const paymentId = transaction();
    
    // Return the created payment
    const createdPayment = await getPayment({ params: { id: paymentId }}, res);
    return createdPayment;
    
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
};

// Update payment
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_date,
      amount,
      payment_method,
      reference_no,
      notes
    } = req.body;
    
    // Check if payment exists
    const existingPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Update payment details
    const stmt = db.prepare(`
      UPDATE payments SET
        payment_date = COALESCE(?, payment_date),
        amount = COALESCE(?, amount),
        payment_method = COALESCE(?, payment_method),
        reference_no = COALESCE(?, reference_no),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `);
    
    stmt.run(
      payment_date, amount, payment_method, reference_no, notes, id
    );
    
    // Update customer balance since payment amount might have changed
    updateCustomerBalance(existingPayment.customer_id);
    
    // Recalculate invoice balances and statuses for allocated invoices
    const allocations = db.prepare('SELECT invoice_id FROM payment_allocations WHERE payment_id = ?').all(id);
    for (const alloc of allocations) {
      calculateInvoiceBalance(alloc.invoice_id);
      updateInvoiceStatus(alloc.invoice_id);
    }
    
    res.json({
      success: true,
      message: 'Payment updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment'
    });
  }
};

// Delete payment (with balance reversal)
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if payment exists
    const existingPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Begin transaction
    const transaction = db.transaction(() => {
      // Get allocated invoices before deletion
      const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(id);
      
      // Delete payment allocations
      db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').run(id);
      
      // Delete the payment record
      db.prepare('DELETE FROM payments WHERE id = ?').run(id);
      
      // Delete related ledger entries
      db.prepare('DELETE FROM customer_ledger WHERE reference_no = ?').run(existingPayment.payment_no);
      
      // Recalculate invoice balances and statuses for affected invoices
      for (const alloc of allocations) {
        calculateInvoiceBalance(alloc.invoice_id);
        updateInvoiceStatus(alloc.invoice_id);
      }
      
      // Update customer balance
      updateCustomerBalance(existingPayment.customer_id);
    });
    
    transaction();
    
    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment'
    });
  }
};

// Allocate payment to invoice
const allocatePaymentToInvoice = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      error: 'Manual allocation endpoint not implemented - use createPayment with allocations instead'
    });
  } catch (error) {
    console.error('Error allocating payment to invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to allocate payment to invoice'
    });
  }
};

module.exports = {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  allocatePaymentToInvoice
};