import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import api from '../utils/api';
import './Dashboard.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch real data
  const { data: items = [] } = useQuery({
    queryKey: ['dashboard-items'],
    queryFn: async () => {
      const response = await api.get('/inventory/items');
      return response.data;
    }
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: async () => {
      const response = await api.get('/sales');
      return response.data;
    }
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['dashboard-purchases'],
    queryFn: async () => {
      const response = await api.get('/purchases');
      return response.data;
    }
  });

  const { data: productions = [] } = useQuery({
    queryKey: ['dashboard-productions'],
    queryFn: async () => {
      const response = await api.get('/productions');
      return response.data;
    }
  });

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['dashboard-stock-balances'],
    queryFn: async () => {
      const response = await api.get('/inventory/stock-balances');
      return response.data.filter(sb => sb.quantity > 0);
    }
  });

  // Calculate statistics
  const totalItems = items.length;
  const totalStockValue = items.reduce((sum, item) =>
    sum + (parseFloat(item.current_stock || 0) * parseFloat(item.standard_cost || 0)), 0
  );
  const totalSalesRevenue = sales.reduce((sum, sale) =>
    sum + parseFloat(sale.total_amount || 0), 0
  );
  const totalPurchases = purchases.reduce((sum, purchase) =>
    sum + parseFloat(purchase.total_cost || 0), 0
  );
  const lowStockItems = items.filter(item =>
    item.reorder_level > 0 && item.current_stock <= item.reorder_level
  );

  // Stock by Category Chart Data
  const categoryData = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = 0;
    acc[item.category] += parseFloat(item.current_stock || 0);
    return acc;
  }, {});

  const stockByCategoryData = {
    labels: Object.keys(categoryData),
    datasets: [{
      label: 'Stock Quantity',
      data: Object.values(categoryData),
      backgroundColor: [
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 99, 132, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)'
      ],
      borderColor: [
        'rgba(54, 162, 235, 1)',
        'rgba(255, 99, 132, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Sales vs Purchases Trend (last 7 days)
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const last7Days = getLast7Days();
  const salesByDay = last7Days.map(day =>
    sales.filter(s => s.sale_date === day)
      .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0)
  );
  const purchasesByDay = last7Days.map(day =>
    purchases.filter(p => p.purchase_date === day)
      .reduce((sum, p) => sum + parseFloat(p.total_cost || 0), 0)
  );

  const salesPurchasesTrendData = {
    labels: last7Days.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Sales',
        data: salesByDay,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4
      },
      {
        label: 'Purchases',
        data: purchasesByDay,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.4
      }
    ]
  };

  // Production Output Chart
  const productionData = productions.slice(0, 5).reduce((acc, prod) => {
    if (!acc[prod.output_item_name]) acc[prod.output_item_name] = 0;
    acc[prod.output_item_name] += parseFloat(prod.output_quantity || 0);
    return acc;
  }, {});

  const productionChartData = {
    labels: Object.keys(productionData),
    datasets: [{
      label: 'Production Output',
      data: Object.values(productionData),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  };

  const { formatCurrency } = useSettings();

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Welcome back, {user?.full_name}!</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            📦
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Items</div>
            <div className="kpi-value">{totalItems}</div>
            <div className="kpi-subtitle">{stockBalances.length} warehouses with stock</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            💰
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Stock Value</div>
            <div className="kpi-value">{formatCurrency(totalStockValue)}</div>
            <div className="kpi-subtitle">Current inventory worth</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            📈
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Sales Revenue</div>
            <div className="kpi-value">{formatCurrency(totalSalesRevenue)}</div>
            <div className="kpi-subtitle">{sales.length} total sales</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            🏭
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Production</div>
            <div className="kpi-value">{productions.length}</div>
            <div className="kpi-subtitle">Total production runs</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Sales vs Purchases (Last 7 Days)</h3>
          <div className="chart-container">
            <Line
              data={salesPurchasesTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>

        <div className="chart-card">
          <h3>Stock by Category</h3>
          <div className="chart-container">
            <Doughnut
              data={stockByCategoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right' }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="dashboard-bottom">
        {/* Low Stock Alerts */}
        <div className="alert-card">
          <h3>⚠️ Low Stock Alerts</h3>
          {lowStockItems.length === 0 ? (
            <p className="no-alerts">All items are well stocked!</p>
          ) : (
            <div className="alert-list">
              {lowStockItems.slice(0, 5).map(item => (
                <Link to="/inventory/items" key={item.id} className="alert-item">
                  <div>
                    <div className="alert-item-name">{item.item_name}</div>
                    <div className="alert-item-code">{item.item_code}</div>
                  </div>
                  <div className="alert-item-stock">
                    <span className="stock-low">{item.current_stock} {item.unit_of_measure}</span>
                    <span className="stock-reorder">Reorder: {item.reorder_level}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Production Chart */}
        <div className="chart-card">
          <h3>Recent Production Output</h3>
          <div className="chart-container" style={{ height: '250px' }}>
            {productions.length === 0 ? (
              <div className="no-data">No production data available</div>
            ) : (
              <Bar
                data={productionChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions-grid">
            <Link to="/inventory/items" className="quick-action-btn">
              <span className="action-icon">📦</span>
              <span>New Item</span>
            </Link>
            <Link to="/sales" className="quick-action-btn">
              <span className="action-icon">💰</span>
              <span>Record Sale</span>
            </Link>
            <Link to="/purchases" className="quick-action-btn">
              <span className="action-icon">🛒</span>
              <span>New Purchase</span>
            </Link>
            <Link to="/production" className="quick-action-btn">
              <span className="action-icon">🏭</span>
              <span>Production</span>
            </Link>
            <Link to="/inventory/stock-movements" className="quick-action-btn">
              <span className="action-icon">📊</span>
              <span>Stock Movement</span>
            </Link>
            <Link to="/bom" className="quick-action-btn">
              <span className="action-icon">📋</span>
              <span>BOM</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
