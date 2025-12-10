# Quick Start Guide

## Installation (5 Minutes)

### Step 1: Install Dependencies

```bash
# Navigate to project directory
cd D:\AI\erpnext\mini-erp

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Start the Application

**Windows:**
```bash
# From mini-erp directory, double-click:
start.bat
```

**OR start manually:**

```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
cd client
npm run dev
```

### Step 3: Access the Application

1. Open browser to: **http://localhost:3000**
2. Login with:
   - Username: `admin`
   - Password: `admin123`

## What to Try First

### 1. Create Your First Item

1. Click **"Items"** in the sidebar
2. Click **"+ New Item"**
3. Fill in:
   - Item Code: `ITEM-001`
   - Item Name: `Test Product`
   - Category: `Products`
   - UOM: `Nos`
   - Standard Cost: `100`
   - Selling Price: `150`
   - Check "Finished Good" and "Purchased Item"
4. Click **"Create Item"**

### 2. Create a Warehouse

1. Click **"Warehouses"** in sidebar
2. Click **"+ New Warehouse"**
3. Fill in:
   - Warehouse Code: `WH-002`
   - Warehouse Name: `Storage Room`
   - Location: `Building A`
4. Click **"Create"**

### 3. Add Stock

1. Click **"Stock Movements"** in sidebar
2. Click **"+ New Adjustment"**
3. Fill in:
   - Item: Select your created item
   - Warehouse: Select `WH-001 - Main Warehouse`
   - Quantity: `100` (positive number adds stock)
   - Date: Today
   - Remarks: `Initial stock`
4. Click **"Record Adjustment"**

### 4. Verify Stock

1. Go back to **"Items"** page
2. Your item should now show stock: **100.00**
3. Click on the item to see details
4. You can see stock broken down by warehouse

## Current Features (Phase 1 + 2)

✅ User authentication (login/logout)
✅ Items management (create/edit/delete)
✅ Warehouse management
✅ Stock movement tracking
✅ Real-time stock balance updates
✅ Low stock alerts
✅ Search and sorting
✅ Activity logging
✅ Clean, modern UI

## Coming Soon (Phase 3+)

📋 Purchase Orders (Week 5-6)
📋 Sales Orders & Invoicing (Week 7-8)
📋 Manufacturing (Week 9-10)
📋 Dashboard with charts (Week 11)
📋 Reports (Week 11-12)

## Tips

### Reorder Level

Set a reorder level on items to get low stock warnings:
- Item stock <= reorder level = Shows in red
- Helps you know when to reorder

### Stock Adjustments

Use **positive** quantities to add stock, **negative** to remove:
- `+50` = Add 50 units
- `-20` = Remove 20 units

### Categories

Use categories to organize items:
- Raw Materials
- Finished Goods
- Packaging Materials
- Consumables
- etc.

## Troubleshooting

### "Module not found" errors
```bash
# Make sure you installed dependencies
cd server && npm install
cd client && npm install
```

### Can't login
- Check server is running (should see console output)
- Default credentials: `admin` / `admin123`
- Check browser console for errors

### Stock not updating
- Refresh the page
- Check Stock Movements page to see if transaction was recorded
- Verify in database: `SELECT * FROM stock_balances;`

### Port already in use
- Close other applications using port 3000 or 3001
- Or change port in server/server.js (backend) or vite.config.js (frontend)

## Need Help?

- Check `README.md` for full documentation
- Check `PHASE2_COMPLETE.md` for technical details
- Review implementation plan in `.claude/plans/replicated-brewing-pebble.md`

---

**Enjoy your Mini ERP system! 🎉**
