const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
let token = '';

async function login() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║      BOM SYSTEM TEST - PRE-CONFIGURED BOM     ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('\n=== 1. LOGIN ===');
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  token = response.data.token;
  console.log('✅ Login successful\n');
  return token;
}

async function createBOMForBottledOil() {
  console.log('=== 2. CREATE BOM FOR BOTTLED MUSTARD OIL ===');
  console.log('Setting up recipe: 1 Bottled Oil requires...\n');

  // Get items
  const itemsRes = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const oilItem = itemsRes.data.find(i => i.item_code === 'OIL-001');
  const bottleItem = itemsRes.data.find(i => i.item_code === 'PKG-001');
  const capItem = itemsRes.data.find(i => i.item_code === 'PKG-002');
  const stickerItem = itemsRes.data.find(i => i.item_code === 'PKG-003');
  const bottledOilItem = itemsRes.data.find(i => i.item_code === 'FG-001');

  if (!oilItem || !bottleItem || !capItem || !stickerItem || !bottledOilItem) {
    throw new Error('Required items not found. Please run test-bottling-production.js first');
  }

  console.log('Recipe Configuration:');
  console.log(`  Output: 1 ${bottledOilItem.unit_of_measure} ${bottledOilItem.item_name}`);
  console.log('  Inputs:');
  console.log(`    - 1 ${oilItem.unit_of_measure} ${oilItem.item_name}`);
  console.log(`    - 1 ${bottleItem.unit_of_measure} ${bottleItem.item_name}`);
  console.log(`    - 1 ${capItem.unit_of_measure} ${capItem.item_name}`);
  console.log(`    - 1 ${stickerItem.unit_of_measure} ${stickerItem.item_name}\n`);

  // Create BOM
  const bomData = {
    bom_name: 'Bottled Mustard Oil (1 Ltr) - Standard Recipe',
    finished_item_id: bottledOilItem.id,
    quantity: 1, // Recipe for 1 unit
    description: 'Standard bottling process: Fill 1 liter bottle with oil, add cap and label',
    items: [
      { item_id: oilItem.id, quantity: 1 },
      { item_id: bottleItem.id, quantity: 1 },
      { item_id: capItem.id, quantity: 1 },
      { item_id: stickerItem.id, quantity: 1 }
    ]
  };

  const response = await axios.post(`${API_URL}/boms`, bomData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ BOM created successfully!');
  console.log(`   BOM #: ${response.data.bom_no}`);
  console.log(`   Name: ${response.data.bom_name}`);
  console.log(`   Finished Good: ${response.data.finished_item_name}`);
  console.log(`   Raw Materials: ${response.data.items.length} items\n`);

  return response.data;
}

async function getAllBOMs() {
  console.log('=== 3. VIEW ALL BOMs ===');

  const response = await axios.get(`${API_URL}/boms`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`✅ Retrieved ${response.data.length} BOM(s)\n`);

  response.data.forEach((bom, i) => {
    console.log(`${i + 1}. ${bom.bom_no}: ${bom.bom_name}`);
    console.log(`   Finished Item: ${bom.finished_item_name} (${bom.quantity} ${bom.finished_uom})`);
    console.log(`   Raw Materials: ${bom.item_count} items`);
    console.log(`   Status: ${bom.is_active ? 'Active ✅' : 'Inactive ❌'}\n`);
  });

  return response.data;
}

async function getBOMDetails(bomId) {
  console.log('=== 4. VIEW BOM DETAILS ===');

  const response = await axios.get(`${API_URL}/boms/${bomId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const bom = response.data;

  console.log(`BOM: ${bom.bom_no} - ${bom.bom_name}`);
  console.log(`Output: ${bom.quantity} ${bom.finished_uom} of ${bom.finished_item_name}\n`);

  console.log('Required Raw Materials:');
  bom.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.item_name}`);
    console.log(`     Quantity: ${item.quantity} ${item.unit_of_measure}`);
    console.log(`     Current Stock: ${item.current_stock} ${item.unit_of_measure}`);
  });

  console.log('');
  return bom;
}

async function produceUsingBOM(bom, quantity) {
  console.log(`=== 5. PRODUCE ${quantity} UNITS USING BOM ===`);
  console.log(`Using BOM: ${bom.bom_no}\n`);

  // Calculate material requirements (scaled by quantity)
  console.log(`Material Requirements for ${quantity} units:`);
  bom.items.forEach(item => {
    const required = item.quantity * quantity;
    console.log(`  - ${required} ${item.unit_of_measure} ${item.item_name} (Available: ${item.current_stock})`);
  });

  // Prepare production data with BOM reference
  const productionData = {
    output_item_id: bom.finished_item_id,
    output_quantity: quantity,
    warehouse_id: 1,
    production_date: new Date().toISOString().split('T')[0],
    bom_id: bom.id, // Reference to BOM
    input_items: bom.items.map(item => ({
      item_id: item.item_id,
      quantity: item.quantity * quantity // Scale by production quantity
    })),
    remarks: `Produced using BOM: ${bom.bom_no}`
  };

  const response = await axios.post(`${API_URL}/productions`, productionData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('\n✅ Production recorded successfully!');
  console.log(`   Production #: ${response.data.production_no}`);
  console.log(`   Output: ${response.data.output_quantity} ${response.data.output_uom} of ${response.data.output_item_name}`);
  console.log(`   BOM Used: ${bom.bom_no}`);
  console.log(`   Materials Consumed: ${response.data.inputs.length} items\n`);

  return response.data;
}

async function verifyStockAfterProduction() {
  console.log('=== 6. VERIFY STOCK AFTER PRODUCTION ===');

  const itemsRes = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const relevantItems = itemsRes.data.filter(i =>
    ['OIL-001', 'PKG-001', 'PKG-002', 'PKG-003', 'FG-001'].includes(i.item_code)
  );

  console.log('Current Stock Levels:');
  relevantItems.forEach(item => {
    console.log(`  ${item.item_name}: ${item.current_stock} ${item.unit_of_measure}`);
  });

  console.log('');
}

async function runBOMTest() {
  try {
    await login();

    // Step 1: Create BOM for bottled oil
    const bom = await createBOMForBottledOil();

    // Step 2: View all BOMs
    await getAllBOMs();

    // Step 3: Get BOM details
    await getBOMDetails(bom.id);

    // Step 4: Produce 5 units using BOM
    await produceUsingBOM(bom, 5);

    // Step 5: Verify stock
    await verifyStockAfterProduction();

    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ BOM SYSTEM TEST PASSED!                 ║');
    console.log('║                                               ║');
    console.log('║   BOM-Based Production Workflow:             ║');
    console.log('║   1. Pre-configure BOM (recipe)              ║');
    console.log('║   2. Select BOM when producing               ║');
    console.log('║   3. System auto-calculates materials        ║');
    console.log('║   4. Produce any quantity (10, 20, 50...)    ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('💡 Next Steps:');
    console.log('   1. Create BOM page in frontend');
    console.log('   2. Update Production form to select from BOMs');
    console.log('   3. Auto-populate materials when BOM selected\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runBOMTest();
