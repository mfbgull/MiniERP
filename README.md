# Mini ERP - Simple Local ERP System

A lightweight, local ERP system built with React, Node.js, and SQLite. Perfect for small businesses with 1-3 users.

## Features

- ✅ **Authentication System** - JWT-based login with admin/user roles (Phase 1)
- ✅ **SQLite Database** - 22 tables for complete ERP functionality (Phase 1)
- ✅ **Modern UI** - Clean, responsive design based on ERPNext (Phase 1)
- ✅ **Inventory Management** - Items, warehouses, stock tracking (Phase 2)
- ✅ **Purchase Orders** - Supplier management, purchase recording (Phase 3)
- ✅ **Sales & Invoicing** - Customer management, sales recording (Phase 4)
- ✅ **Manufacturing** - Production tracking, BOM system (Phase 5)
- ✅ **Searchable Selects** - Enhanced user experience with searchable dropdowns (Recent Enhancement)
- ✅ **CRUD Operations** - Full create, read, update, delete functionality for BOM, Items, and Production records (Recent Enhancement)

## Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (file-based, zero config)
- **Auth:** JWT + bcrypt
- **UI:** Custom CSS with design system from ERPNext

## Installation

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Setup Instructions

1. **Install Dependencies**

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

2. **Start Backend Server**

```bash
cd server
npm start
```

The server will start on `http://localhost:3001`

On first run, it will:
- Create the SQLite database (`database/erp.db`)
- Create all 22 tables
- Create default admin user (username: `admin`, password: `admin123`)
- Create default warehouse

3. **Start Frontend (in new terminal)**

```bash
cd client
npm run dev
```

The client will start on `http://localhost:3000`

4. **Login**

Open your browser to `http://localhost:3000`

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**⚠️ IMPORTANT:** Change the default password after first login!

## Project Structure

```
mini-erp/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── assets/
│   │   │   └── styles/    # CSS files
│   │   ├── components/
│   │   │   └── common/    # Reusable components
│   │   ├── context/       # React contexts
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utilities (API, etc.)
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js         # SQLite connection
│   │   ├── controllers/
│   │   │   └── authController.js   # Auth logic
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT middleware
│   │   │   └── errorHandler.js    # Error handling
│   │   ├── migrations/
│   │   │   └── init.sql           # Database schema
│   │   ├── routes/
│   │   │   └── auth.js            # Auth routes
│   │   └── app.js                 # Express app
│   ├── server.js           # Entry point
│   └── package.json
│
├── database/
│   ├── erp.db             # SQLite database (created on first run)
│   └── backups/           # Auto-backup location
│
└── README.md
```

## Database Schema

### 22 Tables Created:

**User Management:**
- `users` - User accounts
- `settings` - System settings

**Inventory (4 tables):**
- `items` - Products/materials
- `warehouses` - Storage locations
- `stock_movements` - Stock transactions
- `stock_balances` - Current stock levels

**Purchasing (5 tables):**
- `suppliers` - Supplier master
- `purchase_orders` - PO headers
- `purchase_order_items` - PO line items
- `goods_receipts` - Receipt records
- `goods_receipt_items` - Receipt details

**Sales (6 tables):**
- `customers` - Customer master
- `sales_orders` - SO headers
- `sales_order_items` - SO line items
- `invoices` - Invoice headers
- `invoice_items` - Invoice details
- `payments` - Payment records

**Manufacturing (4 tables):**
- `bom` - Bill of Materials
- `bom_items` - BOM details
- `work_orders` - Production orders
- `material_consumption` - Material usage

**Audit:**
- `activity_log` - User activity tracking

## API Endpoints (Phase 1)

### Authentication

- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

## Development

### Backend Development

```bash
cd server
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development

```bash
cd client
npm run dev  # Vite dev server with HMR
```

### Build for Production

```bash
# Build frontend
cd client
npm run build

# The built files will be in client/dist/
```

## Features Coming Next

### Phase 2: Inventory Management (Week 3-4)
- Item master (products catalog)
- Warehouse management
- Stock movements
- Stock reports

### Phase 3: Purchase Orders (Week 5-6)
- Supplier management
- Create and manage POs
- Goods receipt
- Auto-update inventory

### Phase 4: Sales & Invoicing (Week 7-8)
- Customer management
- Sales orders
- Invoice generation
- Payment tracking

### Phase 5: Manufacturing (Week 9-10)
- Bill of Materials (BOM)
- Work orders
- Production tracking
- Material consumption

## Troubleshooting

### Database is locked
- Stop all running instances of the server
- SQLite only supports one writer at a time (by design)

### Port already in use
- Change the PORT in server/server.js or set environment variable
- Default backend port: 3001
- Default frontend port: 3000

### Authentication not working
- Clear browser localStorage
- Check if JWT_SECRET is set (defaults to dev value)

## Security Notes

- Default JWT secret is for development only
- Change JWT_SECRET in production (use environment variable)
- Default admin password should be changed immediately
- Database file contains sensitive data - protect it appropriately

## Backup Strategy

The SQLite database file is located at `database/erp.db`

**Manual Backup:**
```bash
# Simply copy the database file
cp database/erp.db database/backups/erp_backup_$(date +%Y%m%d).db
```

**Automatic backups** will be implemented in Phase 7.

## License

MIT
