const db = require('../config/database');

// Get all invoices
function getInvoices(req, res) {
  try {
    const invoices = db.prepare(`
      SELECT 
        i.*,
        c.customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `).all();

    res.json(invoices);
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
      status,
      discount_scope,
      discount,
      items,
      notes,
      terms,
      total_amount
    } = req.body;

    if (!customer_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer, date, and items are required' });
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Insert invoice
      const invoiceResult = db.prepare(`
        INSERT INTO invoices (
          invoice_no, customer_id, invoice_date, due_date, status,
          total_amount, notes, discount_scope, discount_type, discount_value, terms, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoice_no,
        customer_id,
        invoice_date,
        due_date,
        status,
        total_amount,
        notes || null,
        discount_scope || 'invoice',
        discount_type || 'percentage',
        discount_value || 0,
        terms || null,
        req.user.id
      );

      const invoiceId = invoiceResult.lastInsertRowid;

      // Insert invoice items
      items.forEach(item => {
        const amount = item.quantity * item.unit_price;
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
      });

      return invoiceId;
    });

    const invoiceId = transaction();

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
      discount,
      items,
      notes,
      terms,
      total_amount
    } = req.body;

    if (!customer_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer, date, and items are required' });
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Update invoice
      db.prepare(`
        UPDATE invoices
        SET
          invoice_no = ?, customer_id = ?, invoice_date = ?, due_date = ?,
          status = ?, total_amount = ?, notes = ?, discount_scope = ?, discount_type = ?, discount_value = ?, terms = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        invoice_no,
        customer_id,
        invoice_date,
        due_date,
        status,
        total_amount,
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

    // Start transaction
    const transaction = db.transaction(() => {
      // Delete invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      
      // Delete invoice
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    });

    transaction();

    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
}

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice
};