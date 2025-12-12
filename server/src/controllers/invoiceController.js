const db = require('../config/database');
const { createLedgerEntry, updateCustomerBalance, calculateInvoiceBalance, updateInvoiceStatus } = require('../utils/ledgerUtils');
const StockMovement = require('../models/StockMovement');

// Get all invoices
function getInvoices(req, res) {
  try {
    const { customerId, status } = req.query;

    let query = `
      SELECT
        i.*,
        c.customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by customer ID if provided
    if (customerId) {
      query += ' AND i.customer_id = ?';
      params.push(parseInt(customerId, 10));
    }

    // Filter by status if provided
    if (status) {
      const statusList = status.split(',').map(s => s.trim());
      if (statusList.length > 0) {
        const placeholders = statusList.map(() => '?').join(',');
        query += ` AND i.status IN (${placeholders})`;
        params.push(...statusList);
      }
    }

    query += ' ORDER BY i.created_at DESC';

    const invoices = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
}

// Get a specific invoice
function getInvoice(req, res) {
  try {
    const { id } = req.params;

    const invoice = db.prepare(`
      SELECT
        i.*,
        c.customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get invoice items
    const items = db.prepare(`
      SELECT
        ii.item_id,
        ii.quantity,
        ii.unit_price,
        ii.amount,
        ii.tax_rate,
        ii.discount_type,
        ii.discount_value,
        item.item_name,
        item.item_code
      FROM invoice_items ii
      LEFT JOIN items item ON ii.item_id = item.id
      WHERE ii.invoice_id = ?
    `).all(id);

    invoice.items = items;

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
}

// Create a new invoice
function createInvoice(req, res) {
  try {
    const {
      invoice_no,
      customer_id,
      invoice_date,
      due_date,
      status = 'Unpaid', // Default status for new invoices
      discount_scope,
      discount_type,
      discount_value,
      items,
      notes,
      terms,
      total_amount,
      record_payment,
      payment
    } = req.body;

    if (!customer_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer, date, and items are required' });
    }

    // Parse customer_id to integer to ensure consistent type
    const parsedCustomerId = parseInt(customer_id, 10);

    // Start transaction
    const transaction = db.transaction(() => {
      // Insert invoice - Initialize paid_amount and balance_amount based on whether payment is being recorded
      const initialPaidAmount = (record_payment && payment) ? payment.amount : 0;
      const initialBalanceAmount = (record_payment && payment) ? (total_amount - payment.amount) : total_amount;

      // Determine status based on payment
      let initialStatus;
      if (record_payment && payment) {
        if (payment.amount >= total_amount) {
          initialStatus = 'Paid';
        } else if (payment.amount > 0) {
          initialStatus = 'Partially Paid';
        } else {
          initialStatus = 'Unpaid';
        }
      } else {
        initialStatus = status; // Use provided status or default 'Unpaid'
      }

      const invoiceResult = db.prepare(`
        INSERT INTO invoices (
          invoice_no, customer_id, invoice_date, due_date, status,
          total_amount, paid_amount, balance_amount, notes, discount_scope, discount_type, discount_value, terms, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoice_no,
        parsedCustomerId,
        invoice_date,
        due_date,
        initialStatus,
        total_amount,
        initialPaidAmount,
        initialBalanceAmount,
        notes || null,
        discount_scope || 'invoice',
        discount_type || 'percentage',
        discount_value || 0,
        terms || null,
        req.user.id
      );

      const invoiceId = invoiceResult.lastInsertRowid;

      // Insert invoice items and deduct stock
      items.forEach(item => {
        const amount = item.quantity * item.unit_price;

        // Find the warehouse that has stock for this item
        // Priority: 1) item.warehouse_id if provided, 2) warehouse with sufficient stock, 3) any warehouse with stock
        let warehouseId = item.warehouse_id;

        if (!warehouseId) {
          // Find warehouse with sufficient stock
          const warehouseWithStock = db.prepare(`
            SELECT warehouse_id, quantity
            FROM stock_balances
            WHERE item_id = ? AND quantity >= ?
            ORDER BY quantity DESC
            LIMIT 1
          `).get(item.item_id, item.quantity);

          if (warehouseWithStock) {
            warehouseId = warehouseWithStock.warehouse_id;
          } else {
            // Fallback: find any warehouse with this item (even if insufficient)
            const anyWarehouse = db.prepare(`
              SELECT warehouse_id, quantity
              FROM stock_balances
              WHERE item_id = ? AND quantity > 0
              ORDER BY quantity DESC
              LIMIT 1
            `).get(item.item_id);

            if (anyWarehouse) {
              warehouseId = anyWarehouse.warehouse_id;
            } else {
              // Last resort: default warehouse
              const defaultWarehouse = db.prepare('SELECT id FROM warehouses WHERE warehouse_code = ? AND is_active = 1').get('WH-001');
              warehouseId = defaultWarehouse ? defaultWarehouse.id : 1;
            }
          }
        }
        db.prepare(`
          INSERT INTO invoice_items (
            invoice_id, item_id, quantity, unit_price, amount, tax_rate, discount_type, discount_value
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          invoiceId,
          item.item_id,
          item.quantity,
          item.unit_price,
          amount,
          item.tax_rate || 0,
          item.discount_type || 'percentage',
          item.discount_value || 0
        );

        // Deduct stock for this item (negative quantity for SALE)
        StockMovement.recordMovement({
          item_id: item.item_id,
          warehouse_id: warehouseId,
          movement_type: 'SALE',
          quantity: -item.quantity, // Negative to reduce stock
          unit_cost: item.unit_price,
          reference_doctype: 'INVOICE',
          reference_docno: invoice_no,
          remarks: `Sold via Invoice ${invoice_no}`,
          movement_date: invoice_date
        }, req.user.id);
      });

      // Create customer ledger entry (debit to increase AR)
      createLedgerEntry(
        parsedCustomerId,
        'INVOICE',
        invoice_no,
        total_amount, // debit
        0,            // credit
        `Invoice ${invoice_no}`
      );

      return invoiceId;
    });

    const invoiceId = transaction();

    // If payment is being recorded, create the payment
    let finalStatus = status;
    if (record_payment && payment) {
      const maxPaymentNo = db.prepare('SELECT MAX(payment_no) as max_no FROM payments WHERE payment_no LIKE \'PAY%\'').get();
      let newPaymentNo = 'PAY001';

      if (maxPaymentNo && maxPaymentNo.max_no) {
        const lastNumber = parseInt(maxPaymentNo.max_no.replace('PAY', ''));
        newPaymentNo = `PAY${String(lastNumber + 1).padStart(3, '0')}`;
      }

      // Insert payment
      const paymentResult = db.prepare(`
        INSERT INTO payments (payment_no, customer_id, payment_date, amount, payment_method, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        newPaymentNo,
        parsedCustomerId,
        payment.payment_date,
        payment.amount,
        payment.payment_method,
        payment.reference_no || null,
        payment.notes || null
      );

      const paymentId = paymentResult.lastInsertRowid;

      // Insert payment allocation
      db.prepare(`
        INSERT INTO payment_allocations (payment_id, invoice_id, amount)
        VALUES (?, ?, ?)
      `).run(paymentId, invoiceId, payment.amount);



      // Create ledger entries
      const { createLedgerEntry } = require('../utils/ledgerUtils');
      createLedgerEntry(
        parsedCustomerId,
        'PAYMENT',
        newPaymentNo,
        0,              // debit
        payment.amount, // credit
        `Payment ${newPaymentNo} for Invoice ${invoice_no}`
      );
    }

    // Update customer balance after transaction
    updateCustomerBalance(parsedCustomerId);

    // Return the created invoice
    const createdInvoice = db.prepare(`
      SELECT
        i.*,
        c.customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(invoiceId);

    res.status(201).json(createdInvoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
}

// Update an existing invoice
function updateInvoice(req, res) {
  try {
    const { id } = req.params;
    const {
      invoice_no,
      customer_id,
      invoice_date,
      due_date,
      status,
      discount_scope,
      discount_type,
      discount_value,
      items,
      notes,
      terms,
      total_amount
    } = req.body;

    if (!customer_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer, date, and items are required' });
    }

    // Parse customer_id to integer to ensure consistent type
    const parsedCustomerId = parseInt(customer_id, 10);

    // Get the original invoice to check if customer changed
    const originalInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!originalInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Update invoice - preserve paid_amount, recalculate balance_amount
      const newBalanceAmount = total_amount - (originalInvoice.paid_amount || 0);

      db.prepare(`
        UPDATE invoices
        SET
          invoice_no = ?, customer_id = ?, invoice_date = ?, due_date = ?,
          status = ?, total_amount = ?, balance_amount = ?, notes = ?,
          discount_scope = ?, discount_type = ?, discount_value = ?, terms = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        invoice_no,
        parsedCustomerId,
        invoice_date,
        due_date,
        status,
        total_amount,
        newBalanceAmount,
        notes || null,
        discount_scope || 'invoice',
        discount_type || 'percentage',
        discount_value || 0,
        terms || null,
        id
      );

      // Delete existing invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);

      // Insert new invoice items
      items.forEach(item => {
        const amount = item.quantity * item.unit_price;
        db.prepare(`
          INSERT INTO invoice_items (
            invoice_id, item_id, quantity, unit_price, amount, tax_rate, discount_type, discount_value
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          item.item_id,
          item.quantity,
          item.unit_price,
          amount,
          item.tax_rate || 0,
          item.discount_type || 'percentage',
          item.discount_value || 0
        );
      });
    });

    transaction();

    // If customer changed, update balances for both old and new customers
    if (originalInvoice.customer_id !== parsedCustomerId) {
      updateCustomerBalance(originalInvoice.customer_id);
    }
    updateCustomerBalance(parsedCustomerId);

    // Update invoice status based on balance
    updateInvoiceStatus(id);

    // Return the updated invoice
    const updatedInvoice = db.prepare(`
      SELECT
        i.*,
        c.customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(id);

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
}

// Delete an invoice
function deleteInvoice(req, res) {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    // Get the invoice to access customer_id and invoice_no for cleanup
    const invoice = db.prepare('SELECT id, customer_id, invoice_no, invoice_date FROM invoices WHERE id = ?').get(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get invoice items to reverse stock
    const invoiceItems = db.prepare('SELECT item_id, quantity, unit_price FROM invoice_items WHERE invoice_id = ?').all(invoiceId);

    // Start transaction
    const transaction = db.transaction(() => {
      // Get payment allocations for this invoice to clean up related payments
      const allocations = db.prepare('SELECT payment_id FROM payment_allocations WHERE invoice_id = ?').all(invoiceId);

      // Delete payment allocations for this invoice
      db.prepare('DELETE FROM payment_allocations WHERE invoice_id = ?').run(invoiceId);

      // For each payment that was allocated to this invoice, check if it has other allocations
      // If not, delete the payment record as well
      for (const alloc of allocations) {
        const otherAllocations = db.prepare('SELECT COUNT(*) as count FROM payment_allocations WHERE payment_id = ?').get(alloc.payment_id);
        if (otherAllocations.count === 0) {
          // Get payment info before deleting
          const payment = db.prepare('SELECT payment_no FROM payments WHERE id = ?').get(alloc.payment_id);
          if (payment) {
            // Delete related ledger entry for this payment
            db.prepare('DELETE FROM customer_ledger WHERE reference_no = ?').run(payment.payment_no);
          }
          // Delete the payment since it has no more allocations
          db.prepare('DELETE FROM payments WHERE id = ?').run(alloc.payment_id);
        }
      }

      // Reverse stock movements for each invoice item
      // Find the original warehouse from the SALE movement for this invoice
      for (const item of invoiceItems) {
        // Find the warehouse where the stock was deducted from
        const originalMovement = db.prepare(`
          SELECT warehouse_id FROM stock_movements
          WHERE item_id = ? AND reference_docno = ? AND movement_type = 'SALE'
          LIMIT 1
        `).get(item.item_id, invoice.invoice_no);

        let warehouseId;
        if (originalMovement) {
          warehouseId = originalMovement.warehouse_id;
        } else {
          // Fallback to default warehouse if movement not found
          const defaultWarehouse = db.prepare('SELECT id FROM warehouses WHERE warehouse_code = ? AND is_active = 1').get('WH-001');
          warehouseId = defaultWarehouse ? defaultWarehouse.id : 1;
        }

        // Add stock back (positive quantity to reverse the sale)
        StockMovement.recordMovement({
          item_id: item.item_id,
          warehouse_id: warehouseId,
          movement_type: 'ADJUSTMENT',
          quantity: item.quantity, // Positive to add back stock
          unit_cost: item.unit_price,
          reference_doctype: 'INVOICE_DELETE',
          reference_docno: invoice.invoice_no,
          remarks: `Stock reversed - Invoice ${invoice.invoice_no} deleted`,
          movement_date: new Date().toISOString().split('T')[0]
        }, req.user.id);
      }

      // Delete invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);

      // Delete related ledger entries for the invoice
      db.prepare('DELETE FROM customer_ledger WHERE reference_no = ?').run(invoice.invoice_no);

      // Delete invoice
      db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
    });

    transaction();

    // Update customer balance after deletion
    updateCustomerBalance(invoice.customer_id);

    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
}

// Get payments for a specific invoice
function getInvoicePayments(req, res) {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    // Get all payments allocated to this invoice
    const payments = db.prepare(`
      SELECT
        p.id,
        p.payment_no,
        p.payment_date,
        p.payment_method,
        p.reference_no,
        p.notes,
        pa.amount
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      WHERE pa.invoice_id = ?
      ORDER BY p.payment_date DESC
    `).all(invoiceId);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get invoice payments error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice payments' });
  }
}

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoicePayments
};