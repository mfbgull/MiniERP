import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    {
      label: 'Inventory',
      icon: '📦',
      children: [
        { path: '/inventory/items', label: 'Items' },
        { path: '/inventory/warehouses', label: 'Warehouses' },
        { path: '/inventory/stock-movements', label: 'Stock Movements' }
      ]
    },
    { path: '/purchases', label: 'Purchases', icon: '🛒' },
    { path: '/bom', label: 'Bill of Materials', icon: '📋' },
    { path: '/production', label: 'Production', icon: '🏭' },
    { path: '/sales', label: 'Sales', icon: '💰' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h3>Mini ERP</h3>
        <p className="small">Simple & Powerful</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, index) => (
          item.children ? (
            <div key={index} className="nav-section">
              <div className="nav-section-title">
                <span>{item.icon}</span> {item.label}
              </div>
              {item.children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive }) => `nav-item nav-sub-item ${isActive ? 'active' : ''}`}
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          )
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.full_name?.charAt(0)}</div>
          <div className="user-details">
            <div className="user-name">{user?.full_name}</div>
            <div className="user-role tiny">{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          🚪
        </button>
      </div>
    </div>
  );
}
