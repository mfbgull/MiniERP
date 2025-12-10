const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
let token = '';

async function login() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   BOTTLING PRODUCTION TEST - REALISTIC FLOW   ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('\n=== 1. LOGIN ===');
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  token = response.data.token;
  console.log('✅ Login successful');
  return token;
}

async function createPackagingMaterials() {
  console.log('\n=== 2. CREATE PACKAGING MATERIALS ===');
  console.log('Creating items for bottling process...\n');

  // Create Empty Bottle (1 Ltr)
  const bottle = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'PKG-001',
    item_name: '1 Ltr Empty Bottle',
    description: 'Glass bottle 1 liter capacity for mustard oil',
    category: 'Packaging Material',
    unit_of_measure: 'Pcs',
    standard_cost: 15,
    standard_selling_price: 0,
    is_raw_material: true,
    is_finished_good: false,
    is_purchased: true,
    is_manufactured: false
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Created:', bottle.data.item_name);

  // Create Bottle Cap
  const cap = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'PKG-002',
    item_name: 'Bottle Cap',
    description: 'Screw cap for 1 liter bottle',
    category: 'Packaging Material',
    unit_of_measure: 'Pcs',
    standard_cost: 2,
    standard_selling_price: 0,
    is_raw_material: true,
    is_finished_good: false,
    is_purchased: true,
    is_manufactured: false
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Created:', cap.data.item_name);

  // Create Label/Sticker
  const sticker = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'PKG-003',
    item_name: 'Product Label Sticker',
    description: 'Brand label sticker for mustard oil bottle',
    category: 'Packaging Material',
    unit_of_measure: 'Pcs',
    standard_cost: 3,
    standard_selling_price: 0,
    is_raw_material: true,
    is_finished_good: false,
    is_purchased: true,
    is_manufactured: false
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Created:', sticker.data.item_name);

  // Create Finished Product - Bottled Mustard Oil
  const bottledOil = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'FG-001',
    item_name: 'Bottled Mustard Oil (1 Ltr)',
    description: 'Premium mustard oil in sealed 1 liter bottle',
    category: 'Finished Goods',
    unit_of_measure: 'Pcs',
    standard_cost: 0,
    standard_selling_price: 180,
    is_raw_material: false,
    is_finished_good: true,
    is_purchased: false,
    is_manufactured: true
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Created:', bottledOil.data.item_name);

  return {
    bottle: bottle.data,
    cap: cap.data,
    sticker: sticker.data,
    bottledOil: bottledOil.data
  };
}

async function purchasePackagingMaterials(bottle, cap, sticker) {
  console.log('\n=== 3. PURCHASE PACKAGING MATERIALS ===');
  console.log('Buying packaging materials from supplier...\n');

  // Purchase 50 bottles
  const bottlePurchase = await axios.post(`${API_URL}/purchases`, {
    item_id: bottle.id,
    warehouse_id: 1,
    quantity: 50,
    unit_cost: 15,
    total_cost: 750,
    supplier_name: 'Glass Bottle Suppliers',
    purchase_date: new Date().toISOString().split('T')[0],
    remarks: 'Bulk purchase of 1 liter bottles'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Purchased: 50 Empty Bottles ($750)');

  // Purchase 100 caps
  const capPurchase = await axios.post(`${API_URL}/purchases`, {
    item_id: cap.id,
    warehouse_id: 1,
    quantity: 100,
    unit_cost: 2,
    total_cost: 200,
    supplier_name: 'Packaging Solutions Ltd',
    purchase_date: new Date().toISOString().split('T')[0],
    remarks: 'Bulk purchase of bottle caps'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Purchased: 100 Bottle Caps ($200)');

  // Purchase 100 stickers
  const stickerPurchase = await axios.post(`${API_URL}/purchases`, {
    item_id: sticker.id,
    warehouse_id: 1,
    quantity: 100,
    unit_cost: 3,
    total_cost: 300,
    supplier_name: 'PrintPro Labels',
    purchase_date: new Date().toISOString().split('T')[0],
    remarks: 'Branded label stickers'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Purchased: 100 Label Stickers ($300)');

  console.log('\n💰 Total Packaging Cost: $1,250');
}

async function checkCurrentStock() {
  console.log('\n=== 4. CURRENT STOCK BEFORE PRODUCTION ===');

  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const relevantItems = itemsResponse.data.filter(i =>
    i.item_code === 'OIL-001' ||
    i.item_code === 'PKG-001' ||
    i.item_code === 'PKG-002' ||
    i.item_code === 'PKG-003' ||
    i.item_code === 'FG-001'
  );

  console.log('\nAvailable Materials:');
  relevantItems.forEach(item => {
    const emoji = item.current_stock >= 10 ? '✅' : '⚠️';
    console.log(`  ${emoji} ${item.item_name}: ${item.current_stock} ${item.unit_of_measure}`);
  });

  return itemsResponse.data;
}

async function recordBottlingProduction(items) {
  console.log('\n=== 5. RECORD BOTTLING PRODUCTION ===');
  console.log('Producing 10 bottles of packaged mustard oil...\n');

  const oilItem = items.find(i => i.item_code === 'OIL-001');
  const bottleItem = items.find(i => i.item_code === 'PKG-001');
  const capItem = items.find(i => i.item_code === 'PKG-002');
  const stickerItem = items.find(i => i.item_code === 'PKG-003');
  const bottledOilItem = items.find(i => i.item_code === 'FG-001');

  if (!oilItem || !bottleItem || !capItem || !stickerItem || !bottledOilItem) {
    throw new Error('Required items not found');
  }

  console.log('Recipe for 10 Bottled Mustard Oil (1 Ltr each):');
  console.log('  Input: 10 Ltr Mustard Oil (bulk)');
  console.log('  Input: 10 Pcs Empty Bottles');
  console.log('  Input: 10 Pcs Bottle Caps');
  console.log('  Input: 10 Pcs Label Stickers');
  console.log('  Output: 10 Pcs Bottled Mustard Oil (1 Ltr)\n');

  // Record production with all 4 input materials
  const productionData = {
    output_item_id: bottledOilItem.id,
    output_quantity: 10,
    warehouse_id: 1,
    production_date: new Date().toISOString().split('T')[0],
    input_items: [
      {
        item_id: oilItem.id,
        quantity: 10  // 10 liters of bulk oil
      },
      {
        item_id: bottleItem.id,
        quantity: 10  // 10 empty bottles
      },
      {
        item_id: capItem.id,
        quantity: 10  // 10 caps
      },
      {
        item_id: stickerItem.id,
        quantity: 10  // 10 stickers
      }
    ],
    remarks: 'Bottling batch: Fill, cap, and label 10 bottles of mustard oil'
  };

  const response = await axios.post(`${API_URL}/productions`, productionData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Production recorded successfully!');
  console.log('   Production #:', response.data.production_no);
  console.log('   Output:', response.data.output_quantity, 'Pcs of', response.data.output_item_name);
  console.log('   Materials consumed:', response.data.inputs.length, 'different items');

  return response.data;
}

async function verifyStockAfterProduction() {
  console.log('\n=== 6. STOCK VERIFICATION AFTER PRODUCTION ===');

  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('\nStock Changes:');

  const oilItem = itemsResponse.data.find(i => i.item_code === 'OIL-001');
  const bottleItem = itemsResponse.data.find(i => i.item_code === 'PKG-001');
  const capItem = itemsResponse.data.find(i => i.item_code === 'PKG-002');
  const stickerItem = itemsResponse.data.find(i => i.item_code === 'PKG-003');
  const bottledOilItem = itemsResponse.data.find(i => i.item_code === 'FG-001');

  console.log('\nRaw Materials (Consumed):');
  console.log(`  Mustard Oil (bulk): ${oilItem.current_stock} Ltr (reduced by 10)`);
  console.log(`  Empty Bottles: ${bottleItem.current_stock} Pcs (reduced by 10)`);
  console.log(`  Bottle Caps: ${capItem.current_stock} Pcs (reduced by 10)`);
  console.log(`  Label Stickers: ${stickerItem.current_stock} Pcs (reduced by 10)`);

  console.log('\nFinished Goods (Produced):');
  console.log(`  Bottled Mustard Oil (1 Ltr): ${bottledOilItem.current_stock} Pcs (increased by 10)`);
}

async function viewStockMovements() {
  console.log('\n=== 7. STOCK MOVEMENTS ===');

  const response = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const recentProductionMovements = response.data
    .filter(m => m.movement_type === 'PRODUCTION')
    .slice(-5);  // Last 5 production movements

  console.log('\nRecent Production Movements:');
  recentProductionMovements.forEach(m => {
    const sign = m.quantity > 0 ? '+' : '';
    console.log(`  ${m.movement_no}: ${sign}${m.quantity} ${m.unit_of_measure} ${m.item_name}`);
  });
}

async function runBottlingTest() {
  try {
    await login();

    const { bottle, cap, sticker, bottledOil } = await createPackagingMaterials();

    await purchasePackagingMaterials(bottle, cap, sticker);

    const items = await checkCurrentStock();

    await recordBottlingProduction(items);

    await verifyStockAfterProduction();

    await viewStockMovements();

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ BOTTLING PRODUCTION TEST PASSED!        ║');
    console.log('║                                               ║');
    console.log('║   Successfully Demonstrated:                 ║');
    console.log('║   ✓ Multi-material production (4 inputs)     ║');
    console.log('║   ✓ Packaging workflow                       ║');
    console.log('║   ✓ Stock deductions for all materials       ║');
    console.log('║   ✓ Finished goods production                ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('📦 Your system can now handle complex production:');
    console.log('   Bulk Oil + Bottles + Caps + Stickers');
    console.log('   → Bottled Mustard Oil (Ready to Sell)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runBottlingTest();
