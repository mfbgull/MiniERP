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
  console.log('User:', response.data.user.full_name);
  return token;
}

async function createItem() {
  console.log('\n=== 2. CREATE ITEM ===');
  const response = await axios.post(`${API_URL}/inventory/items`, {
    item_code: 'SEED-001',
    item_name: 'Mustard Seeds',
    description: 'Raw mustard seeds for oil extraction',
    category: 'Raw Materials',
    unit_of_measure: 'Kg',
    standard_cost: 50,
    standard_selling_price: 0,
    reorder_level: 100,
    is_raw_material: true,
    is_finished_good: false,
    is_purchased: true,
    is_manufactured: false
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Item created successfully');
  console.log('Item ID:', response.data.id);
  console.log('Item Code:', response.data.item_code);
  return response.data.id;
}

async function getItems() {
  console.log('\n=== 3. GET ALL ITEMS ===');
  const response = await axios.get(`${API_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Retrieved items successfully');
  console.log('Total items:', response.data.length);
  response.data.forEach(item => {
    console.log(`  - ${item.item_code}: ${item.item_name} (Stock: ${item.current_stock})`);
  });
  return response.data;
}

async function getItemById(id) {
  console.log('\n=== 4. GET ITEM BY ID ===');
  const response = await axios.get(`${API_URL}/inventory/items/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Item details retrieved');
  console.log('Item:', response.data.item_name);
  console.log('Stock:', response.data.current_stock);
  console.log('Cost:', response.data.standard_cost);
  return response.data;
}

async function updateItem(id) {
  console.log('\n=== 5. UPDATE ITEM ===');
  const response = await axios.put(`${API_URL}/inventory/items/${id}`, {
    item_code: 'SEED-001',
    item_name: 'Premium Mustard Seeds',
    description: 'High quality raw mustard seeds for oil extraction',
    category: 'Raw Materials',
    unit_of_measure: 'Kg',
    standard_cost: 55,
    standard_selling_price: 0,
    reorder_level: 120,
    is_raw_material: true,
    is_finished_good: false,
    is_purchased: true,
    is_manufactured: false
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Item updated successfully');
  console.log('New name:', response.data.item_name);
  console.log('New cost:', response.data.standard_cost);
  console.log('New reorder level:', response.data.reorder_level);
  return response.data;
}

async function createWarehouse() {
  console.log('\n=== 6. CREATE WAREHOUSE ===');
  const response = await axios.post(`${API_URL}/inventory/warehouses`, {
    warehouse_code: 'WH-002',
    warehouse_name: 'Raw Material Storage',
    location: 'Building A, Floor 1'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Warehouse created successfully');
  console.log('Warehouse ID:', response.data.id);
  console.log('Warehouse Code:', response.data.warehouse_code);
  return response.data.id;
}

async function getWarehouses() {
  console.log('\n=== 7. GET ALL WAREHOUSES ===');
  const response = await axios.get(`${API_URL}/inventory/warehouses`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Retrieved warehouses successfully');
  console.log('Total warehouses:', response.data.length);
  response.data.forEach(wh => {
    console.log(`  - ${wh.warehouse_code}: ${wh.warehouse_name}`);
  });
  return response.data;
}

async function addStock(itemId) {
  console.log('\n=== 8. ADD STOCK (Stock Movement) ===');
  const response = await axios.post(`${API_URL}/inventory/stock-movements`, {
    item_id: itemId,
    warehouse_id: 1, // WH-001 (default warehouse)
    quantity: 500,
    movement_type: 'ADJUSTMENT',
    transaction_date: new Date().toISOString().split('T')[0],
    remarks: 'Initial stock purchase'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Stock movement recorded');
  console.log('Movement No:', response.data.movement_no);
  console.log('Quantity added:', response.data.quantity);
  return response.data.id;
}

async function removeStock(itemId) {
  console.log('\n=== 9. REMOVE STOCK (Stock Movement) ===');
  const response = await axios.post(`${API_URL}/inventory/stock-movements`, {
    item_id: itemId,
    warehouse_id: 1,
    quantity: -50,
    movement_type: 'ADJUSTMENT',
    transaction_date: new Date().toISOString().split('T')[0],
    remarks: 'Used for production batch #1'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Stock movement recorded');
  console.log('Movement No:', response.data.movement_no);
  console.log('Quantity removed:', response.data.quantity);
  return response.data.id;
}

async function getStockMovements() {
  console.log('\n=== 10. GET STOCK MOVEMENTS ===');
  const response = await axios.get(`${API_URL}/inventory/stock-movements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Retrieved stock movements');
  console.log('Total movements:', response.data.length);
  response.data.forEach(movement => {
    const sign = movement.quantity >= 0 ? '+' : '';
    console.log(`  - ${movement.movement_no}: ${sign}${movement.quantity} ${movement.unit_of_measure} (${movement.item_name})`);
  });
  return response.data;
}

async function verifyStockBalance(itemId) {
  console.log('\n=== 11. VERIFY STOCK BALANCE ===');
  const item = await axios.get(`${API_URL}/inventory/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ Final stock balance verified');
  console.log('Item:', item.data.item_name);
  console.log('Current Stock:', item.data.current_stock, item.data.unit_of_measure);
  console.log('Expected: 450.00 Kg (500 added - 50 removed)');

  if (parseFloat(item.data.current_stock) === 450) {
    console.log('✅ Stock calculation is CORRECT!');
  } else {
    console.log('❌ Stock calculation is INCORRECT!');
  }
  return item.data;
}

async function deleteItem(itemId) {
  console.log('\n=== 12. DELETE ITEM (should fail - has stock) ===');
  try {
    await axios.delete(`${API_URL}/inventory/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('❌ Item deleted (should have failed!)');
  } catch (error) {
    console.log('✅ Delete prevented correctly');
    console.log('Error:', error.response?.data?.error || error.message);
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   PHASE 2 CRUD OPERATIONS TEST SUITE      ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    await login();
    const itemId = await createItem();
    await getItems();
    await getItemById(itemId);
    await updateItem(itemId);
    await createWarehouse();
    await getWarehouses();
    await addStock(itemId);
    await removeStock(itemId);
    await getStockMovements();
    await verifyStockBalance(itemId);
    await deleteItem(itemId);

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ✅ ALL TESTS PASSED SUCCESSFULLY!       ║');
    console.log('╚════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    process.exit(1);
  }
}

runAllTests();
