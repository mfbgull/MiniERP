const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
let token = '';

async function login() {
  console.log('\n=== 1. LOGIN ===');
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  token = response.data.token;
  console.log('✅ Login successful');
  return token;
}

async function recordSale() {
  console.log('\n=== 2. RECORD SALE ===');

  // Get items to find one with stock
  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const itemWithStock = itemsResponse.data.find(i => parseFloat(i.current_stock) > 0);

  if (!itemWithStock) {
    console.log('❌ No items with stock found. Record a purchase first!');
    return null;
  }

  console.log(`Using item: ${itemWithStock.item_code} - ${itemWithStock.item_name}`);
  console.log(`Current stock: ${itemWithStock.current_stock} ${itemWithStock.unit_of_measure}`);

  // Record a sale
  const saleQuantity = Math.min(50, parseFloat(itemWithStock.current_stock)); // Sell 50 or less
  const saleData = {
    item_id: itemWithStock.id,
    warehouse_id: 1, // WH-001
    quantity: saleQuantity,
    unit_price: 75, // Selling price
    customer_name: 'XYZ Distributors',
    sale_date: new Date().toISOString().split('T')[0],
    invoice_no: 'SINV-2025-001',
    remarks: 'Bulk order from regular customer'
  };

  const response = await axios.post(`${API_URL}/sales`, saleData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Sale recorded successfully');
  console.log('Sale #:', response.data.sale_no);
  console.log('Quantity sold:', response.data.quantity, response.data.unit_of_measure);
  console.log('Unit price: $', response.data.unit_price);
  console.log('Total amount: $', response.data.total_amount);
  console.log('Customer:', response.data.customer_name);

  return { sale: response.data, item: itemWithStock, quantitySold: saleQuantity };
}

async function verifyStockReduction(itemId, previousStock, quantitySold) {
  console.log('\n=== 3. VERIFY STOCK REDUCTION ===');

  const response = await axios.get(`${API_URL}/inventory/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const item = response.data;
  const expectedStock = parseFloat(previousStock) - parseFloat(quantitySold);
  const actualStock = parseFloat(item.current_stock);

  console.log('Previous stock:', previousStock);
  console.log('Quantity sold:', quantitySold);
  console.log('Expected new stock:', expectedStock);
  console.log('Actual new stock:', actualStock);

  if (Math.abs(actualStock - expectedStock) < 0.001) {
    console.log('✅ Stock reduced correctly!');
    return true;
  } else {
    console.log('❌ Stock mismatch! Expected', expectedStock, 'but got', actualStock);
    return false;
  }
}

async function verifyStockMovement() {
  console.log('\n=== 4. VERIFY STOCK MOVEMENT CREATED ===');

  const response = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // Find the last SALE type movement
  const saleMovements = response.data.filter(m => m.movement_type === 'SALE');
  const latestSale = saleMovements[0]; // Should be first (sorted by date desc)

  if (latestSale) {
    console.log('✅ Stock movement created');
    console.log('Movement #:', latestSale.movement_no);
    console.log('Type:', latestSale.movement_type);
    console.log('Quantity:', latestSale.quantity, latestSale.unit_of_measure, '(negative = stock OUT)');
    console.log('Remarks:', latestSale.remarks);
    return true;
  } else {
    console.log('❌ No SALE stock movement found');
    return false;
  }
}

async function getSales() {
  console.log('\n=== 5. GET ALL SALES ===');

  const response = await axios.get(`${API_URL}/sales`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Retrieved sales');
  console.log('Total sales:', response.data.length);

  if (response.data.length > 0) {
    const totalRevenue = response.data.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    console.log('Total revenue: $', totalRevenue.toFixed(2));

    console.log('\nLast 3 sales:');
    response.data.slice(0, 3).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.sale_no}: ${s.quantity} ${s.unit_of_measure} of ${s.item_name} - $${s.total_amount}`);
    });
  }

  return response.data;
}

async function testInsufficientStock() {
  console.log('\n=== 6. TEST INSUFFICIENT STOCK ERROR ===');

  try {
    // Try to sell more than available stock
    const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const item = itemsResponse.data[0];

    await axios.post(`${API_URL}/sales`, {
      item_id: item.id,
      warehouse_id: 1,
      quantity: parseFloat(item.current_stock) + 1000, // More than available
      unit_price: 75,
      sale_date: new Date().toISOString().split('T')[0]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('❌ Sale was allowed (should have failed!)');
    return false;
  } catch (error) {
    if (error.response?.data?.error?.includes('Insufficient stock')) {
      console.log('✅ Insufficient stock error handled correctly');
      console.log('Error message:', error.response.data.error);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   PHASE 4 SALES RECORDING TEST SUITE      ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await login();

    const result = await recordSale();

    if (!result) {
      console.log('\n❌ Test aborted: No items with stock available');
      process.exit(1);
    }

    const { sale, item, quantitySold } = result;
    const previousStock = item.current_stock;

    const stockReductionOk = await verifyStockReduction(item.id, previousStock, quantitySold);
    const movementOk = await verifyStockMovement();
    await getSales();
    const insufficientStockOk = await testInsufficientStock();

    console.log('\n╔════════════════════════════════════════════╗');
    if (stockReductionOk && movementOk && insufficientStockOk) {
      console.log('║   ✅ ALL TESTS PASSED SUCCESSFULLY!       ║');
    } else {
      console.log('║   ❌ SOME TESTS FAILED                    ║');
    }
    console.log('╚════════════════════════════════════════════╝\n');

    process.exit(stockReductionOk && movementOk && insufficientStockOk ? 0 : 1);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    process.exit(1);
  }
}

runAllTests();
