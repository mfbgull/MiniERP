const db = require('../config/database');

// Get all customers with AR balance
const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'customer_name', sortOrder = 'ASC' } = req.query;
    
    let query = `
      SELECT 
        id, customer_code, customer_name, contact_person, email, phone, 
        billing_address, shipping_address, payment_terms, payment_terms_days,
        credit_limit, current_balance,
        CASE 
          WHEN credit_limit > 0 THEN ROUND((current_balance / credit_limit) * 100, 2)
          ELSE 0 
        END as credit_utilization_percent,
        is_active, created_at, updated_at
      FROM customers
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add search filter
    if (search) {
      query += ` AND (customer_name LIKE ? OR customer_code LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add status filter
    const status = req.query.status;
    if (status && status !== 'all') {
      if (status === 'active') {
        query += ' AND is_active = 1';
      } else if (status === 'inactive') {
        query += ' AND is_active = 0';
      }
    }
    
    // Add sorting
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const customers = db.prepare(query).all(params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customers
      WHERE 1=1
    `;
    
    let countParams = [];
    if (search) {
      countQuery += ` AND (customer_name LIKE ? OR customer_code LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (status && status !== 'all') {
      if (status === 'active') {
        countQuery += ' AND is_active = 1';
      } else if (status === 'inactive') {
        countQuery += ' AND is_active = 0';
      }
    }
    
    const total = db.prepare(countQuery).get(countParams).total;
    
    res.json({
      success: true,
      data: customers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: page < Math.ceil(total / parseInt(limit)),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
};

// Get single customer by ID
const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id, customer_code, customer_name, contact_person, email, phone, 
        billing_address, shipping_address, payment_terms, payment_terms_days,
        credit_limit, current_balance, opening_balance,
        CASE 
          WHEN credit_limit > 0 THEN ROUND((current_balance / credit_limit) * 100, 2)
          ELSE 0 
        END as credit_utilization_percent,
        is_active, created_at, updated_at
      FROM customers
      WHERE id = ?
    `;
    
    const customer = db.prepare(query).get(id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
};

// Create new customer
const createCustomer = async (req, res) => {
  try {
    const {
      customer_name,
      contact_person,
      email,
      phone,
      billing_address,
      shipping_address,
      payment_terms,
      payment_terms_days,
      credit_limit,
      opening_balance
    } = req.body;
    
    // Validate required fields
    if (!customer_name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and phone are required'
      });
    }
    
    // Generate customer code
    const maxCodeResult = db.prepare('SELECT MAX(customer_code) as max_code FROM customers WHERE customer_code LIKE \'CUST%\'').get();
    let newCustomerCode = 'CUST001';
    
    if (maxCodeResult && maxCodeResult.max_code) {
      const lastNumber = parseInt(maxCodeResult.max_code.replace('CUST', ''));
      newCustomerCode = `CUST${String(lastNumber + 1).padStart(3, '0')}`;
    }
    
    // Insert new customer
    const stmt = db.prepare(`
      INSERT INTO customers (
        customer_code, customer_name, contact_person, email, phone,
        billing_address, shipping_address, payment_terms, payment_terms_days,
        credit_limit, current_balance, opening_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      newCustomerCode,
      customer_name,
      contact_person || '',
      email || '',
      phone,
      billing_address || '',
      shipping_address || '',
      payment_terms || '',
      payment_terms_days || 14,
      credit_limit || 0,
      opening_balance || 0, // Current balance starts with opening balance
      opening_balance || 0
    );
    
    // If opening balance exists, create ledger entry
    if (opening_balance && parseFloat(opening_balance) !== 0) {
      const ledgerStmt = db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, transaction_date, transaction_type, reference_no,
          debit, credit, balance, description
        ) VALUES (?, date('now'), ?, ?, ?, ?, ?, ?)
      `);
      
      let debit = 0, credit = 0;
      if (parseFloat(opening_balance) > 0) {
        debit = opening_balance;
      } else {
        credit = Math.abs(opening_balance);
      }
      
      // Calculate new balance (considering any existing balance)
      const newBalance = parseFloat(opening_balance);
      
      ledgerStmt.run(
        result.lastInsertRowid,
        'OPENING_BALANCE',
        `OPEN-${newCustomerCode}`,
        debit,
        credit,
        newBalance,
        'Opening Balance'
      );
    }
    
    // Fetch the created customer
    const createdCustomer = db.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: createdCustomer,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      contact_person,
      email,
      phone,
      billing_address,
      shipping_address,
      payment_terms,
      payment_terms_days,
      credit_limit,
      is_active
    } = req.body;
    
    // Check if customer exists
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Update customer
    const stmt = db.prepare(`
      UPDATE customers SET
        customer_name = COALESCE(?, customer_name),
        contact_person = COALESCE(?, contact_person),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        billing_address = COALESCE(?, billing_address),
        shipping_address = COALESCE(?, shipping_address),
        payment_terms = COALESCE(?, payment_terms),
        payment_terms_days = COALESCE(?, payment_terms_days),
        credit_limit = COALESCE(?, credit_limit),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      customer_name, contact_person, email, phone,
      billing_address, shipping_address, payment_terms, 
      payment_terms_days, credit_limit, is_active, id
    );
    
    // Fetch updated customer
    const updatedCustomer = db.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).get(id);
    
    res.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    });
  }
};

// Delete customer (soft delete by setting inactive)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if customer exists
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check if customer has any transactions
    const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?').get(id).count;
    const paymentCount = db.prepare('SELECT COUNT(*) as count FROM payments WHERE customer_id = ?').get(id).count;
    
    if (invoiceCount > 0 || paymentCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete customer with existing transactions'
      });
    }
    
    // Soft delete by setting is_active to 0
    const stmt = db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?');
    stmt.run(id);
    
    res.json({
      success: true,
      message: 'Customer deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    });
  }
};

// Get customer ledger (transaction history)
const getCustomerLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sortBy = 'transaction_date', sortOrder = 'DESC' } = req.query;
    
    // Verify customer exists
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    const query = `
      SELECT 
        id, transaction_date, transaction_type, reference_no, 
        debit, credit, balance, description, created_at
      FROM customer_ledger
      WHERE customer_id = ?
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const offset = (page - 1) * limit;
    const ledgerEntries = db.prepare(query).all(id, limit, offset);
    
    // Get total count for pagination
    const count = db.prepare(
      'SELECT COUNT(*) as total FROM customer_ledger WHERE customer_id = ?'
    ).get(id).total;
    
    res.json({
      success: true,
      data: ledgerEntries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalItems: count,
        hasNext: page < Math.ceil(count / parseInt(limit)),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer ledger'
    });
  }
};

// Get customer statement for a period
const getCustomerStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.query;
    
    // Verify customer exists
    const customer = db.prepare('SELECT id, customer_name FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    let query = `
      SELECT 
        transaction_date, transaction_type, reference_no, 
        debit, credit, balance, description
      FROM customer_ledger
      WHERE customer_id = ?
    `;
    
    const params = [id];
    
    // Add date filters
    if (fromDate) {
      query += ' AND transaction_date >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      query += ' AND transaction_date <= ?';
      params.push(toDate);
    }
    
    query += ' ORDER BY transaction_date ASC';
    
    const statementData = db.prepare(query).all(...params);
    
    // Get opening balance for the period
    let openingBalanceQuery = 'SELECT balance FROM customer_ledger WHERE customer_id = ?';
    const openingBalanceParams = [id];
    
    if (fromDate) {
      openingBalanceQuery += ' AND transaction_date < ? ORDER BY transaction_date DESC LIMIT 1';
      openingBalanceParams.push(fromDate);
    } else {
      openingBalanceQuery += ' ORDER BY transaction_date DESC LIMIT 1';
    }
    
    const openingBalanceResult = db.prepare(openingBalanceQuery).get(...openingBalanceParams);
    const openingBalance = openingBalanceResult ? openingBalanceResult.balance : 0;
    
    // Calculate closing balance
    let runningBalance = parseFloat(openingBalance);
    let closingBalance = runningBalance;
    
    for (const entry of statementData) {
      runningBalance += parseFloat(entry.debit || 0) - parseFloat(entry.credit || 0);
    }
    closingBalance = runningBalance;
    
    res.json({
      success: true,
      data: {
        customer: customer,
        period: {
          fromDate: fromDate || null,
          toDate: toDate || null
        },
        openingBalance: parseFloat(openingBalance),
        closingBalance: parseFloat(closingBalance),
        transactions: statementData
      }
    });
  } catch (error) {
    console.error('Error fetching customer statement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer statement'
    });
  }
};

// Get customer balance
const getCustomerBalance = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify customer exists
    const customer = db.prepare('SELECT id, customer_name, current_balance FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        customerId: customer.id,
        customerName: customer.customer_name,
        currentBalance: parseFloat(customer.current_balance)
      }
    });
  } catch (error) {
    console.error('Error fetching customer balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer balance'
    });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  getCustomerStatement,
  getCustomerBalance
};