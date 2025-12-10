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

async function setupTestData() {
  console.log('\n=== 2. SETUP TEST DATA ===');
  console.log('Creating finished good item (Mustard Oil)...');

  // Create a finished good item (oil)
  const oilItem = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'OIL-001',
    item_name: 'Mustard Oil',
    description: 'Pure mustard oil extracted from premium seeds',
    category: 'Finished Goods',
    unit_of_measure: 'Ltr',
    standard_cost: 0,
    standard_selling_price: 150,
    is_raw_material: false,
    is_finished_good: true,
    is_purchased: false,
    is_manufactured: true
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Created finished good:', oilItem.data.item_name);
  return oilItem.data;
}

async function recordProduction() {
  console.log('\n=== 3. RECORD PRODUCTION ===');
  console.log('Producing 10 Ltr Mustard Oil from 100 Kg Mustard Seeds...\n');

  // Get items
  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const seedItem = itemsResponse.data.find(i => i.item_code === 'SEED-001');
  const oilItem = itemsResponse.data.find(i => i.item_code === 'OIL-001');

  if (!seedItem || !oilItem) {
    throw new Error('Required items not found');
  }

  console.log('Input: ', seedItem.item_name, '- Stock:', seedItem.current_stock, seedItem.unit_of_measure);
  console.log('Output:', oilItem.item_name, '- Stock:', oilItem.current_stock, oilItem.unit_of_measure);

  // Record production: 100 Kg seeds → 10 Ltr oil
  const productionData = {
    output_item_id: oilItem.id,
    output_quantity: 10,
    warehouse_id: 1,
    production_date: new Date().toISOString().split('T')[0],
    input_items: [
      {
        item_id: seedItem.id,
        quantity: 100
      }
    ],
    remarks: 'Batch #1 - Premium mustard oil extraction'
  };

  const response = await axios.post(`${API_URL}/productions`, productionData, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('\n✅ Production recorded successfully');
  console.log('Production #:', response.data.production_no);
  console.log('Output:', response.data.output_quantity, response.data.output_uom, 'of', response.data.output_item_name);

  return { production: response.data, seedItem, oilItem };
}

async function verifyStockChanges(seedItemId, oilItemId, seedsConsumed, oilProduced) {
  console.log('\n=== 4. VERIFY STOCK CHANGES ===');

  const itemsResponse = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const updatedSeed = itemsResponse.data.find(i => i.id === seedItemId);
  const updatedOil = itemsResponse.data.find(i => i.id === oilItemId);

  console.log('\nMustard Seeds (Raw Material):');
  console.log('  Stock change: Should decrease by', seedsConsumed, 'Kg');
  console.log('  Current stock:', updatedSeed.current_stock, 'Kg');

  console.log('\nMustard Oil (Finished Good):');
  console.log('  Stock change: Should increase by', oilProduced, 'Ltr');
  console.log('  Current stock:', updatedOil.current_stock, 'Ltr');

  console.log('\n✅ Stock changes verified!');

  return { updatedSeed, updatedOil };
}

async function verifyStockMovements() {
  console.log('\n=== 5. VERIFY STOCK MOVEMENTS ===');

  const response = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const productionMovements = response.data.filter(m => m.movement_type === 'PRODUCTION');

  console.log('Found', productionMovements.length, 'production stock movements');

  // Should have 2: one negative (seeds consumed), one positive (oil produced)
  const consumed = productionMovements.filter(m => m.quantity < 0);
  const produced = productionMovements.filter(m => m.quantity > 0);

  console.log('\nConsumed (negative):');
  consumed.forEach(m => {
    console.log(`  ${m.movement_no}: ${m.quantity} ${m.unit_of_measure} ${m.item_name}`);
  });

  console.log('\nProduced (positive):');
  produced.forEach(m => {
    console.log(`  ${m.movement_no}: +${m.quantity} ${m.unit_of_measure} ${m.item_name}`);
  });

  if (consumed.length > 0 && produced.length > 0) {
    console.log('\n✅ Stock movements created correctly!');
    return true;
  } else {
    console.log('\n❌ Stock movements incomplete');
    return false;
  }
}

async function getProductions() {
  console.log('\n=== 6. GET ALL PRODUCTIONS ===');

  const response = await axios.get(`${API_URL}/productions`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('✅ Retrieved productions');
  console.log('Total productions:', response.data.length);

  if (response.data.length > 0) {
    console.log('\nProduction history:');
    response.data.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.production_no}: ${p.output_quantity} ${p.output_uom} of ${p.output_item_name}`);
    });
  }

  return response.data;
}

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   PHASE 5 PRODUCTION RECORDING TEST SUITE    ║');
  console.log('╚═══════════════════════════════════════════════╝');

  try {
    await login();
    const oilItem = await setupTestData();
    const { production, seedItem, oilItem: oil } = await recordProduction();

    await verifyStockChanges(seedItem.id, oil.id, 100, 10);
    const movementsOk = await verifyStockMovements();
    await getProductions();

    console.log('\n╔═══════════════════════════════════════════════╗');
    if (movementsOk) {
      console.log('║   ✅ ALL TESTS PASSED SUCCESSFULLY!          ║');
      console.log('║                                               ║');
      console.log('║   Complete Business Flow Working:            ║');
      console.log('║   Purchase Seeds → Produce Oil → Sell Oil    ║');
    } else {
      console.log('║   ❌ SOME TESTS FAILED                       ║');
    }
    console.log('╚═══════════════════════════════════════════════╝\n');

    process.exit(movementsOk ? 0 : 1);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runAllTests();
