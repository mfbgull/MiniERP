import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="card">
        <h3>Welcome, {user?.full_name}!</h3>
        <p className="mt-sm">
          You are logged in as <strong>{user?.username}</strong> ({user?.role})
        </p>
        <p className="mt-md small" style={{ color: 'var(--neutral-400)' }}>
          Your mini ERP system is ready. Start building your inventory, purchase orders,
          sales orders, and manufacturing workflows.
        </p>
      </div>

      <div className="card">
        <h3>Getting Started</h3>
        <ul style={{ marginTop: 'var(--space-md)', paddingLeft: 'var(--space-lg)' }}>
          <li>Phase 1: Foundation & Authentication ✅ <strong>COMPLETE</strong></li>
          <li>Phase 2: Inventory Management - Coming next</li>
          <li>Phase 3: Purchase Orders</li>
          <li>Phase 4: Sales Orders & Invoicing</li>
          <li>Phase 5: Manufacturing</li>
        </ul>
      </div>
    </div>
  );
}
