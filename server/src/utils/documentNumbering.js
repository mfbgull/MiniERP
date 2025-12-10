const db = require('../config/database');

/**
 * Generate sequential document numbers
 * Format: PREFIX-YYYY-NNNN
 * Examples: PO-2024-0001, SO-2024-0001, INV-2024-0001
 */
function generateDocumentNo(prefix) {
  const year = new Date().getFullYear();
  const settingKey = `${prefix}_last_no_${year}`;

  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);

  let nextNo = 1;
  if (setting) {
    nextNo = parseInt(setting.value) + 1;
  }

  // Update or insert setting
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(settingKey, nextNo.toString());

  // Format: PO-2024-0001
  return `${prefix}-${year}-${nextNo.toString().padStart(4, '0')}`;
}

module.exports = {
  generatePONo: () => generateDocumentNo('PO'),
  generateSONo: () => generateDocumentNo('SO'),
  generateInvoiceNo: () => generateDocumentNo('INV'),
  generateWONo: () => generateDocumentNo('WO'),
  generateBOMNo: () => generateDocumentNo('BOM'),
  generateReceiptNo: () => generateDocumentNo('GR'),
  generatePaymentNo: () => generateDocumentNo('PAY')
};
