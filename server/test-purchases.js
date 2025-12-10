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

async function recordPurchase() {
  console.log('\n=== 2. RECORD PURCHASE ===');

  // Get the item we created earlier
  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const item = itemsResponse.data[0]; // Use first item

  if (!item) {
    console.log('❌ No items found. Create an item first!');
    return null;
  }

  console.log(`Using item: ${item.item_code} - ${item.item_name}`);
  console.log(`Current stock: ${item.current_stock} ${item.unit_of_measure}`);

  // Record a purchase
  const purchaseData = {
    item_id: item.id,
    warehouse_id: 1, // WH-001
    quantity: 200,
    unit_cost: 45,
    supplier_name: 'ABC Seeds Supplier',
    purchase_date: new Date().toISOString().split('T')[0],
    invoice_no: 'INV-2025-001',
    remarks: 'Bulk purchase of premium seeds'
  };

  const response = await axios.post(`${API_URL}/purchases`, purchaseData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Purchase recorded successfully');
  console.log('Purchase #:', response.data.purchase_no);
  console.log('Quantity purchased:', response.data.quantity, response.data.unit_of_measure);
  console.log('Unit cost: $', response.data.unit_cost);
  console.log('Total cost: $', response.data.total_cost);
  console.log('Supplier:', response.data.supplier_name);

  return { purchase: response.data, item };
}

async function verifyStockUpdate(itemId, previousStock, quantityAdded) {
  console.log('\n=== 3. VERIFY STOCK UPDATE ===');

  const response = await axios.get(`${API_URL}/inventory/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const item = response.data;
  const expectedStock = parseFloat(previousStock) + parseFloat(quantityAdded);
  const actualStock = parseFloat(item.current_stock);

  console.log('Previous stock:', previousStock);
  console.log('Quantity purchased:', quantityAdded);
  console.log('Expected new stock:', expectedStock);
  console.log('Actual new stock:', actualStock);

  if (actualStock === expectedStock) {
    console.log('✅ Stock updated correctly!');
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

  // Find the last PURCHASE type movement
  const purchaseMovements = response.data.filter(m => m.movement_type === 'PURCHASE');
  const latestPurchase = purchaseMovements[0]; // Should be first (sorted by date desc)

  if (latestPurchase) {
    console.log('✅ Stock movement created');
    console.log('Movement #:', latestPurchase.movement_no);
    console.log('Type:', latestPurchase.movement_type);
    console.log('Quantity:', latestPurchase.quantity, latestPurchase.unit_of_measure);
    console.log('Remarks:', latestPurchase.remarks);
    return true;
  } else {
    console.log('❌ No PURCHASE stock movement found');
    return false;
  }
}

async function getPurchases() {
  console.log('\n=== 5. GET ALL PURCHASES ===');

  const response = await axios.get(`${API_URL}/purchases`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Retrieved purchases');
  console.log('Total purchases:', response.data.length);

  if (response.data.length > 0) {
    console.log('\nLast 3 purchases:');
    response.data.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.purchase_no}: ${p.quantity} ${p.unit_of_measure} of ${p.item_name} - $${p.total_cost}`);
    });
  }

  return response.data;
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   PHASE 3 PURCHASE RECORDING TEST SUITE   ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await login();

    const { purchase, item } = await recordPurchase();

    if (!purchase) {
      console.log('\n❌ Test aborted: No items available');
      process.exit(1);
    }

    const previousStock = item.current_stock;
    const stockUpdateOk = await verifyStockUpdate(item.id, previousStock, purchase.quantity);

    const movementOk = await verifyStockMovement();

    await getPurchases();

    console.log('\n╔════════════════════════════════════════════╗');
    if (stockUpdateOk && movementOk) {
      console.log('║   ✅ ALL TESTS PASSED SUCCESSFULLY!       ║');
    } else {
      console.log('║   ❌ SOME TESTS FAILED                    ║');
    }
    console.log('╚════════════════════════════════════════════╝\n');

    process.exit(stockUpdateOk && movementOk ? 0 : 1);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    process.exit(1);
  }
}

runAllTests();
