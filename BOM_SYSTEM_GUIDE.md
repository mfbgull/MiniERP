# BOM (Bill of Materials) System Guide

## ✅ System Status: FULLY FUNCTIONAL

The BOM system has been successfully implemented and tested. You can now pre-configure recipes for your finished products!

---

## What is a BOM?

A **Bill of Materials (BOM)** is a pre-configured recipe that defines:
- What finished product you're making (Output)
- What raw materials you need (Inputs)
- How much of each material is required

### Example BOM: Bottled Mustard Oil (1 Ltr)

```
Output: 1 Pcs Bottled Mustard Oil
Inputs:
  - 1 Ltr Mustard Oil (bulk)
  - 1 Pcs Empty Bottle
  - 1 Pcs Bottle Cap
  - 1 Pcs Label Sticker
```

---

## How It Works

### 1. **Create BOM Once** (Pre-configure the recipe)
   - Define the finished product
   - List all raw materials needed
   - Specify quantities for producing 1 unit

### 2. **Use BOM for Production** (Repeatedly)
   - Select the BOM
   - Enter how many units you want to produce (10, 20, 50...)
   - System automatically calculates material requirements
   - System validates stock availability
   - Production happens if materials are sufficient

---

## Benefits

✅ **No Manual Entry**: Don't re-enter materials every time
✅ **Consistency**: Same recipe every production
✅ **Speed**: Just select BOM + quantity
✅ **Accuracy**: Auto-calculated material requirements
✅ **Stock Validation**: Prevents production without sufficient materials

---

## API Endpoints

### BOM Management

**Get All BOMs:**
```
GET /api/boms
```

**Get BOM Details:**
```
GET /api/boms/:id
```

**Get BOMs for a Finished Item:**
```
GET /api/boms/by-item/:itemId
```

**Create New BOM:**
```
POST /api/boms
Body:
{
  "bom_name": "Bottled Mustard Oil (1 Ltr) - Standard Recipe",
  "finished_item_id": 7,
  "quantity": 1,
  "description": "Standard bottling process",
  "items": [
    { "item_id": 2, "quantity": 1 },
    { "item_id": 4, "quantity": 1 },
    { "item_id": 5, "quantity": 1 },
    { "item_id": 6, "quantity": 1 }
  ]
}
```

**Update BOM:**
```
PUT /api/boms/:id
```

**Toggle BOM Active/Inactive:**
```
PATCH /api/boms/:id/toggle-active
```

**Delete BOM:**
```
DELETE /api/boms/:id
```

---

## Production with BOM

### Updated Production Endpoint

**Record Production (BOM-based):**
```
POST /api/productions
Body:
{
  "output_item_id": 7,
  "output_quantity": 10,
  "warehouse_id": 1,
  "production_date": "2025-12-09",
  "bom_id": 1,  // <-- Reference to BOM
  "input_items": [
    { "item_id": 2, "quantity": 10 },  // Auto-calculated from BOM
    { "item_id": 4, "quantity": 10 },
    { "item_id": 5, "quantity": 10 },
    { "item_id": 6, "quantity": 10 }
  ],
  "remarks": "Produced using BOM: BOM-2025-0001"
}
```

---

## Database Schema

### `boms` Table
```sql
id                 INTEGER PRIMARY KEY
bom_no             VARCHAR(50)      -- BOM-2025-0001
bom_name           VARCHAR(200)
finished_item_id   INTEGER          -- Finished product
quantity           DECIMAL(15,3)    -- Recipe for N units (usually 1)
description        TEXT
is_active          BOOLEAN          -- Can be activated/deactivated
created_by         INTEGER
created_at         TIMESTAMP
updated_at         TIMESTAMP
```

### `bom_items` Table
```sql
id         INTEGER PRIMARY KEY
bom_id     INTEGER              -- FK to boms
item_id    INTEGER              -- Raw material
quantity   DECIMAL(15,3)        -- How much needed
created_at TIMESTAMP
```

### `productions` Table (Updated)
```sql
-- New column added:
bom_id     INTEGER               -- Optional reference to BOM used
```

---

## Example Workflow

### Step 1: Setup (One-time)

**Create Items:**
1. Mustard Oil (bulk) - Raw Material
2. Empty Bottles - Packaging Material
3. Bottle Caps - Packaging Material
4. Label Stickers - Packaging Material
5. Bottled Mustard Oil (1 Ltr) - Finished Good

**Create BOM:**
```javascript
POST /api/boms
{
  "bom_name": "Bottled Mustard Oil - Standard",
  "finished_item_id": 5,  // Bottled Oil
  "quantity": 1,
  "items": [
    { "item_id": 1, "quantity": 1 },  // 1 L oil
    { "item_id": 2, "quantity": 1 },  // 1 bottle
    { "item_id": 3, "quantity": 1 },  // 1 cap
    { "item_id": 4, "quantity": 1 }   // 1 sticker
  ]
}
```

### Step 2: Production (Repeatable)

**Produce 10 Units:**
```javascript
POST /api/productions
{
  "output_item_id": 5,
  "output_quantity": 10,      // Want 10 bottles
  "warehouse_id": 1,
  "bom_id": 1,                // Use BOM-2025-0001
  "input_items": [
    { "item_id": 1, "quantity": 10 },  // 10 L oil (1 * 10)
    { "item_id": 2, "quantity": 10 },  // 10 bottles
    { "item_id": 3, "quantity": 10 },  // 10 caps
    { "item_id": 4, "quantity": 10 }   // 10 stickers
  ]
}
```

**System Actions:**
1. Validates: Oil stock >= 10 L ✅
2. Validates: Bottles stock >= 10 Pcs ✅
3. Validates: Caps stock >= 10 Pcs ✅
4. Validates: Stickers stock >= 10 Pcs ✅
5. Consumes 10 of each (stock movements created)
6. Produces 10 Bottled Oil (stock movement created)
7. Links production to BOM for traceability

---

## Test Results

### BOM Creation Test ✅
```
BOM #: BOM-2025-0001
Name: Bottled Mustard Oil (1 Ltr) - Standard Recipe
Finished Good: Bottled Mustard Oil (1 Ltr)
Raw Materials: 4 items
Status: Active ✅
```

### Stock Validation Test ✅
```
Trying to produce 5 units but only 2 L oil available:
Error: "Insufficient stock for Mustard Oil. Available: 2, Required: 5"

✅ System correctly prevented production
```

---

##  Next Steps for Full Implementation

### Backend: ✅ COMPLETE
- ✅ BOM tables created
- ✅ BOM model with full CRUD
- ✅ BOM controller with 7 endpoints
- ✅ BOM routes registered
- ✅ Production model updated to support bom_id
- ✅ Stock validation working

### Frontend: ✅ ENHANCED

1. **Enhanced User Experience**
   - ✅ BOM Management Page (with searchable selects)
   - ✅ Production Page updated with searchable dropdowns for items and warehouses
   - ✅ Improved usability with searchable select components
   - ✅ Better UX for selecting items, warehouses, etc.

2. **Searchable Select Enhancement**
   - ✅ All forms now use searchable select components
   - ✅ Type to filter options in dropdowns
   - ✅ Improved accessibility and faster selection
   - ✅ Consistent UI/UX across all modules

---

## Usage in Frontend (Proposed UX)

### Production Form - Two Modes:

**Mode 1: With BOM (Recommended)**
```
[ Select BOM: ▼ ] → Select "Bottled Oil - Standard"
[  Output: Bottled Mustard Oil (1 Ltr) ] (auto-filled)
[ Quantity: 10 ]

Raw Materials (Auto-calculated):
✓ 10 Ltr Mustard Oil (Available: 50)
✓ 10 Pcs Empty Bottles (Available: 100)
✓ 10 Pcs Bottle Caps (Available: 100)
✓ 10 Pcs Label Stickers (Available: 100)

[Record Production]
```

**Mode 2: Manual (Without BOM)**
```
[ Select BOM: ▼ ] → Leave empty or "Manual Entry"
[ Output Item: ▼ ]
[ Quantity: ___ ]

+ Add Raw Material
+ Add Raw Material

[Record Production]
```

---

## BOM Document Numbering

Format: `BOM-YEAR-NNNN`

Examples:
- BOM-2025-0001
- BOM-2025-0002
- BOM-2026-0001 (resets per year)

---

## Business Value

### Before BOM System:
❌ Enter 4+ materials every production
❌ Risk of forgetting a material
❌ Inconsistent recipes
❌ Slow production entry

### After BOM System:
✅ Click BOM dropdown → Select → Enter quantity → Done
✅ Consistent quality (same recipe always)
✅ Fast production recording
✅ Traceable (which BOM was used)
✅ Easy to update recipe (edit BOM once)

---

## Real Business Example

**Your Mustard Oil Business:**

1. Create BOMs for each product size:
   - BOM: Bottled Oil 500ml
   - BOM: Bottled Oil 1 Ltr
   - BOM: Bottled Oil 5 Ltr

2. Each BOM specifies:
   - Different bottle sizes
   - Different oil quantities
   - Same caps/stickers (or different if needed)

3. Production becomes:
   - "I need 100 bottles of 1 Ltr" → Select BOM, enter 100 → Done!
   - "I need 50 bottles of 500ml" → Select BOM, enter 50 → Done!

---

## Summary

✅ **BOM System is Live and Working**
✅ **Backend APIs Ready**
✅ **Stock Validation Working**
✅ **Ready for Frontend Integration**

The system will dramatically speed up your production recording process while ensuring consistency and accuracy!

---

**Last Updated:** December 9, 2025
