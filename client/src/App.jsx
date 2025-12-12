import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ItemsPage from './pages/inventory/ItemsPage';
import WarehousesPage from './pages/inventory/WarehousesPage';
import StockMovementPage from './pages/inventory/StockMovementPage';
import StockByWarehousePage from './pages/inventory/StockByWarehousePage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import BOMPage from './pages/bom/BOMPage';
import ProductionPage from './pages/production/ProductionPage';
import SalesPage from './pages/sales/SalesPage';
import SalesInvoicePage from './pages/sales/SalesInvoicePage';
import InvoiceViewPage from './pages/sales/InvoiceViewPage';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import CustomerStatement from './pages/customers/CustomerStatement';
import ARReportsPage from './pages/reports/ARReportsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/layout/Sidebar';

import './assets/styles/variables.css';
import './assets/styles/global.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}


// App Layout with Sidebar
function AppLayout() {
  return (
    <SettingsProvider>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory/items" element={<ItemsPage />} />
              <Route path="/inventory/warehouses" element={<WarehousesPage />} />
              <Route path="/inventory/stock-movements" element={<StockMovementPage />} />
              <Route path="/inventory/stock-by-warehouse" element={<StockByWarehousePage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/bom" element={<BOMPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/customers/:id/statement" element={<CustomerStatement />} />
              <Route path="/reports/accounts-receivable" element={<ARReportsPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales/invoice" element={<SalesInvoicePage />} />
              <Route path="/sales/invoice/:invoiceId" element={<SalesInvoicePage />} />
              <Route path="/sales/invoice/:invoiceId/view" element={<InvoiceViewPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>        </div>
        </div>
      </div>
    </SettingsProvider>
  );
}

// Main App Component (updated)
function AppRoutesOuter() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutesOuter />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff'
              },
              success: {
                iconTheme: {
                  primary: 'var(--success)',
                  secondary: '#fff'
                }
              },
              error: {
                iconTheme: {
                  primary: 'var(--error)',
                  secondary: '#fff'
                }
              }
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
