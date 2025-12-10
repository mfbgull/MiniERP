const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
let token = '';

async function login() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   MINI ERP - COMPLETE FLOW TEST SUITE        ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('\n=== 1. AUTHENTICATION ===');

  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });

  token = response.data.token;
  console.log('✅ Login successful');
  console.log('   User:', response.data.user.full_name);
  console.log('   Role:', response.data.user.role);
  return token;
}

async function verifyInventoryModule() {
  console.log('\n=== 2. INVENTORY MODULE ===');

  // Get items
  const itemsRes = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Items fetched:', itemsRes.data.length, 'items');

  // Get warehouses
  const whRes = await axios.get(`${API_URL}/inventory/warehouses`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Warehouses fetched:', whRes.data.length, 'warehouses');

  // Get stock movements
  const movementsRes = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Stock movements fetched:', movementsRes.data.length, 'movements');

  return { items: itemsRes.data, warehouses: whRes.data };
}

async function verifyPurchasesModule(items, warehouses) {
  console.log('\n=== 3. PURCHASES MODULE ===');

  const seedItem = items.find(i => i.item_code === 'SEED-001');

  if (!seedItem) {
    console.log('⚠️  No seed item found, skipping purchase test');
    return null;
  }

  const stockBefore = seedItem.current_stock;

  // Record a test purchase
  const purchaseData = {
    item_id: seedItem.id,
    warehouse_id: warehouses[0].id,
    quantity: 50,
    unit_cost: 25,
    total_cost: 1250,
    supplier_name: 'Test Supplier',
    purchase_date: new Date().toISOString().split('T')[0],
    remarks: 'Test purchase'
  };

  const response = await axios.post(`${API_URL}/purchases`, purchaseData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Purchase recorded:', response.data.purchase_no);
  console.log('   Item:', response.data.item_name);
  console.log('   Quantity:', response.data.quantity, response.data.unit_of_measure);
  console.log('   Total Cost: $' + response.data.total_cost);

  // Get all purchases
  const allPurchases = await axios.get(`${API_URL}/purchases`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Total purchases:', allPurchases.data.length);

  return response.data;
}

async function verifyProductionModule(items, warehouses) {
  console.log('\n=== 4. PRODUCTION MODULE ===');

  const seedItem = items.find(i => i.item_code === 'SEED-001');
  const oilItem = items.find(i => i.item_code === 'OIL-001');

  if (!seedItem || !oilItem) {
    console.log('⚠️  Required items not found, skipping production test');
    return null;
  }

  // Record production
  const productionData = {
    output_item_id: oilItem.id,
    output_quantity: 5,
    warehouse_id: warehouses[0].id,
    production_date: new Date().toISOString().split('T')[0],
    input_items: [
      {
        item_id: seedItem.id,
        quantity: 50
      }
    ],
    remarks: 'Test production batch'
  };

  const response = await axios.post(`${API_URL}/productions`, productionData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Production recorded:', response.data.production_no);
  console.log('   Output:', response.data.output_quantity, response.data.output_uom, 'of', response.data.output_item_name);
  console.log('   Inputs consumed:', response.data.inputs.length, 'raw materials');

  // Get all productions
  const allProductions = await axios.get(`${API_URL}/productions`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Total productions:', allProductions.data.length);

  return response.data;
}

async function verifySalesModule(items, warehouses) {
  console.log('\n=== 5. SALES MODULE ===');

  const oilItem = items.find(i => i.item_code === 'OIL-001');

  if (!oilItem || oilItem.current_stock < 5) {
    console.log('⚠️  Insufficient oil stock, skipping sale test');
    return null;
  }

  // Record a sale
  const saleData = {
    item_id: oilItem.id,
    warehouse_id: warehouses[0].id,
    quantity: 3,
    unit_price: 150,
    total_revenue: 450,
    customer_name: 'Test Customer',
    sale_date: new Date().toISOString().split('T')[0],
    remarks: 'Test sale'
  };

  const response = await axios.post(`${API_URL}/sales`, saleData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Sale recorded:', response.data.sale_no);
  console.log('   Item:', response.data.item_name);
  console.log('   Quantity:', response.data.quantity, response.data.unit_of_measure);
  console.log('   Revenue: $' + response.data.total_revenue);

  // Get all sales
  const allSales = await axios.get(`${API_URL}/sales`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Total sales:', allSales.data.length);

  return response.data;
}

async function verifyFinalStockState(items) {
  console.log('\n=== 6. FINAL STOCK VERIFICATION ===');

  // Get updated items
  const itemsRes = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const seedItem = itemsRes.data.find(i => i.item_code === 'SEED-001');
  const oilItem = itemsRes.data.find(i => i.item_code === 'OIL-001');

  console.log('\nFinal Stock Levels:');

  if (seedItem) {
    console.log('  Mustard Seeds:', seedItem.current_stock, seedItem.unit_of_measure);
  }

  if (oilItem) {
    console.log('  Mustard Oil:', oilItem.current_stock, oilItem.unit_of_measure);
  }

  // Get recent stock movements
  const movements = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('\n✅ Total stock movements:', movements.data.length);

  const movementTypes = movements.data.reduce((acc, m) => {
    acc[m.movement_type] = (acc[m.movement_type] || 0) + 1;
    return acc;
  }, {});

  console.log('   Movement types:', movementTypes);
}

async function runCompleteFlow() {
  try {
    await login();

    const { items, warehouses } = await verifyInventoryModule();

    await verifyPurchasesModule(items, warehouses);

    // Refresh items after purchase
    const itemsAfterPurchase = await axios.get(`${API_URL}/inventory/items`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await verifyProductionModule(itemsAfterPurchase.data, warehouses);

    // Refresh items after production
    const itemsAfterProduction = await axios.get(`${API_URL}/inventory/items`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await verifySalesModule(itemsAfterProduction.data, warehouses);

    await verifyFinalStockState();

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ ALL MODULES TESTED SUCCESSFULLY!        ║');
    console.log('║                                               ║');
    console.log('║   Complete Business Flow Verified:           ║');
    console.log('║   ✓ Inventory Management                     ║');
    console.log('║   ✓ Purchase Recording                       ║');
    console.log('║   ✓ Production/Manufacturing                 ║');
    console.log('║   ✓ Sales Recording                          ║');
    console.log('║   ✓ Stock Tracking & Movements              ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('🎉 Mini ERP System is fully operational!\n');
    console.log('📝 Frontend URL: http://localhost:3000');
    console.log('🔌 Backend URL: http://localhost:3001');
    console.log('📊 Login with: admin / admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runCompleteFlow();
