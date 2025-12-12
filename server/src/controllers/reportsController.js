const db = require('../config/database');

// Get AR aging report (Current, 30, 60, 90+ days)
const getARAgingReport = async (req, res) => {
  try {
    const { asOfDate = new Date().toISOString().split('T')[0] } = req.query;
    
    // Calculate aging buckets as of the specified date
    const query = `
      SELECT 
        c.customer_name,
        c.customer_code,
        SUM(i.balance_amount) as total_outstanding,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(i.due_date) <= 0 THEN i.balance_amount
            ELSE 0
          END
        ) as current_amount,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(i.due_date) > 0 AND julianday(?) - julianday(i.due_date) <= 30 THEN i.balance_amount
            ELSE 0
          END
        ) as days_1_30,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(i.due_date) > 30 AND julianday(?) - julianday(i.due_date) <= 60 THEN i.balance_amount
            ELSE 0
          END
        ) as days_31_60,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(i.due_date) > 60 AND julianday(?) - julianday(i.due_date) <= 90 THEN i.balance_amount
            ELSE 0
          END
        ) as days_61_90,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(i.due_date) > 90 THEN i.balance_amount
            ELSE 0
          END
        ) as days_over_90
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status IN ('Unpaid', 'Partially Paid', 'Overdue') AND i.balance_amount > 0
      GROUP BY i.customer_id, c.customer_name, c.customer_code
      ORDER BY total_outstanding DESC
    `;
    
    const agingData = db.prepare(query).all(
      asOfDate, asOfDate, asOfDate, asOfDate, asOfDate, asOfDate
    );
    
    // Calculate summary totals
    const summaryQuery = `
      SELECT 
        SUM(balance_amount) as total_receivables,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(due_date) <= 0 THEN balance_amount
            ELSE 0
          END
        ) as total_current,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(due_date) > 0 AND julianday(?) - julianday(due_date) <= 30 THEN balance_amount
            ELSE 0
          END
        ) as total_1_30,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(due_date) > 30 AND julianday(?) - julianday(due_date) <= 60 THEN balance_amount
            ELSE 0
          END
        ) as total_31_60,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(due_date) > 60 AND julianday(?) - julianday(due_date) <= 90 THEN balance_amount
            ELSE 0
          END
        ) as total_61_90,
        SUM(
          CASE 
            WHEN julianday(?) - julianday(due_date) > 90 THEN balance_amount
            ELSE 0
          END
        ) as total_over_90
      FROM invoices
      WHERE status IN ('Unpaid', 'Partially Paid', 'Overdue') AND balance_amount > 0
    `;
    
    const summary = db.prepare(summaryQuery).get(asOfDate, asOfDate, asOfDate, asOfDate);
    
    res.json({
      success: true,
      data: {
        asOfDate: asOfDate,
        agingBuckets: agingData,
        summary: {
          totalReceivables: parseFloat(summary.total_receivables || 0),
          current: parseFloat(summary.total_current || 0),
          days1_30: parseFloat(summary.total_1_30 || 0),
          days31_60: parseFloat(summary.total_31_60 || 0),
          days61_90: parseFloat(summary.total_61_90 || 0),
          daysOver90: parseFloat(summary.total_over_90 || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching AR aging report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AR aging report'
    });
  }
};

// Get customer statements for multiple customers
const getCustomerStatements = async (req, res) => {
  try {
    const { customerId, fromDate, toDate } = req.query;
    
    let query = `
      SELECT 
        c.id as customer_id,
        c.customer_name,
        c.customer_code,
        c.current_balance,
        SUM(i.total_amount) as total_invoiced,
        SUM(i.paid_amount) as total_paid,
        SUM(i.balance_amount) as balance_outstanding
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
    `;
    
    const params = [];
    
    if (customerId) {
      query += ' WHERE c.id = ?';
      params.push(customerId);
    } else {
      query += ' WHERE c.is_active = 1';
    }
    
    // Add date filters to invoice query part
    if (fromDate) {
      query += ' AND i.invoice_date >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      query += ' AND i.invoice_date <= ?';
      params.push(toDate);
    }
    
    query += `
      GROUP BY c.id, c.customer_name, c.customer_code, c.current_balance
      ORDER BY c.customer_name
    `;
    
    const statements = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: statements
    });
  } catch (error) {
    console.error('Error fetching customer statements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer statements'
    });
  }
};

// Get top debtors (customers with highest outstanding balance)
const getTopDebtors = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const query = `
      SELECT 
        c.id,
        c.customer_name,
        c.customer_code,
        SUM(i.balance_amount) as outstanding_balance,
        SUM(i.total_amount) as total_invoiced,
        COUNT(i.id) as invoice_count
      FROM customers c
      JOIN invoices i ON c.id = i.customer_id
      WHERE i.status IN ('Unpaid', 'Partially Paid', 'Overdue') AND i.balance_amount > 0
      GROUP BY c.id, c.customer_name, c.customer_code
      ORDER BY outstanding_balance DESC
      LIMIT ?
    `;
    
    const topDebtors = db.prepare(query).all(parseInt(limit));
    
    res.json({
      success: true,
      data: topDebtors
    });
  } catch (error) {
    console.error('Error fetching top debtors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top debtors'
    });
  }
};

// Calculate Days Sales Outstanding (DSO)
const getDSOMetric = async (req, res) => {
  try {
    const { period = '30' } = req.query; // Days to look back
    
    // Calculate DSO: (Accounts Receivable / Total Credit Sales) * Number of Days
    // DSO = (Avg. AR Balance / Avg. Sales Per Day)
    
    const periodInvoicesQuery = `
      SELECT 
        SUM(total_amount) as total_sales,
        COUNT(id) as total_invoices
      FROM invoices
      WHERE invoice_date >= date('now', '-${period} days')
    `;
    
    const periodInvoices = db.prepare(periodInvoicesQuery).get();
    
    const arBalanceQuery = `
      SELECT 
        SUM(balance_amount) as total_ar
      FROM invoices
      WHERE status IN ('Unpaid', 'Partially Paid', 'Overdue')
    `;
    
    const arBalance = db.prepare(arBalanceQuery).get();
    
    // Calculate DSO: (Total AR / Total Sales for Period) * Period
    const totalSales = periodInvoices.total_sales || 0;
    const totalAR = arBalance.total_ar || 0;
    
    const dso = totalSales > 0 ? (totalAR / totalSales) * parseInt(period) : 0;
    
    // Additional DSO metrics
    const avgInvoiceValue = periodInvoices.total_invoices > 0 
      ? totalSales / periodInvoices.total_invoices 
      : 0;
    
    res.json({
      success: true,
      data: {
        dso: parseFloat(dso.toFixed(2)), // Days Sales Outstanding
        period: parseInt(period),
        totalSales: parseFloat(totalSales),
        totalAR: parseFloat(totalAR),
        totalInvoices: periodInvoices.total_invoices || 0,
        avgInvoiceValue: parseFloat(avgInvoiceValue.toFixed(2)),
        calculation: 'DSO = (Total AR / Total Sales for Period) * Period'
      }
    });
  } catch (error) {
    console.error('Error calculating DSO:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate Days Sales Outstanding'
    });
  }
};

// Get receivables summary
const getReceivablesSummary = async (req, res) => {
  try {
    // Get status counts
    const statusQuery = `
      SELECT 
        status,
        COUNT(id) as count,
        SUM(total_amount) as total_amount,
        SUM(balance_amount) as balance_amount
      FROM invoices
      WHERE status IN ('Unpaid', 'Partially Paid', 'Paid', 'Overdue')
      GROUP BY status
    `;
    
    const statusData = db.prepare(statusQuery).all();
    
    // Get overall summary
    const summaryQuery = `
      SELECT 
        COUNT(id) as total_invoices,
        SUM(total_amount) as total_value,
        SUM(paid_amount) as total_paid,
        SUM(balance_amount) as total_outstanding,
        AVG(balance_amount) as average_outstanding
      FROM invoices
      WHERE status IN ('Unpaid', 'Partially Paid', 'Overdue')
    `;
    
    const summary = db.prepare(summaryQuery).get();
    
    // Get overdue info
    const overdueQuery = `
      SELECT 
        COUNT(id) as overdue_count,
        SUM(balance_amount) as overdue_amount
      FROM invoices
      WHERE status = 'Overdue'
    `;
    
    const overdue = db.prepare(overdueQuery).get();
    
    const statusSummary = {
      unpaid: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0
    };
    
    statusData.forEach(row => {
      if (row.status === 'Unpaid') {
        statusSummary.unpaid = {
          count: row.count,
          amount: parseFloat(row.balance_amount || 0)
        };
      } else if (row.status === 'Partially Paid') {
        statusSummary.partiallyPaid = {
          count: row.count,
          amount: parseFloat(row.balance_amount || 0)
        };
      } else if (row.status === 'Paid') {
        statusSummary.paid = {
          count: row.count,
          amount: parseFloat(row.balance_amount || 0)
        };
      } else if (row.status === 'Overdue') {
        statusSummary.overdue = {
          count: row.count,
          amount: parseFloat(row.balance_amount || 0)
        };
      }
    });
    
    res.json({
      success: true,
      data: {
        totalInvoices: summary.total_invoices || 0,
        totalValue: parseFloat(summary.total_value || 0),
        totalPaid: parseFloat(summary.total_paid || 0),
        totalOutstanding: parseFloat(summary.total_outstanding || 0),
        averageOutstanding: parseFloat(summary.average_outstanding || 0),
        overdue: {
          count: overdue.overdue_count || 0,
          amount: parseFloat(overdue.overdue_amount || 0)
        },
        statusBreakdown: statusSummary
      }
    });
  } catch (error) {
    console.error('Error fetching receivables summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receivables summary'
    });
  }
};

module.exports = {
  getARAgingReport,
  getCustomerStatements,
  getTopDebtors,
  getDSOMetric,
  getReceivablesSummary
};