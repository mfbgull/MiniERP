import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar, 
  DollarSign, 
  TrendingDown, 
  AlertTriangle, 
  FileText, 
  Download,
  BarChart3
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import FormInput from '../../components/common/FormInput';
import './ARReportsPage.css';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

export default function ARReportsPage() {
  const [reportType, setReportType] = useState('aging');
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch AR Aging Report
  const { data: agingData, isLoading: agingLoading } = useQuery({
    queryKey: ['arAging', asOfDate],
    queryFn: async () => {
      const response = await api.get(`/reports/ar-aging?asOfDate=${asOfDate}`);
      return response.data.data;
    },
    enabled: reportType === 'aging'
  });

  // Fetch Top Debtors
  const { data: topDebtors, isLoading: debtorsLoading } = useQuery({
    queryKey: ['topDebtors'],
    queryFn: async () => {
      const response = await api.get('/reports/top-debtors');
      return response.data.data;
    },
    enabled: reportType === 'topDebtors'
  });

  // Fetch Receivables Summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['arSummary'],
    queryFn: async () => {
      const response = await api.get('/reports/ar-summary');
      return response.data.data;
    },
    enabled: reportType === 'summary'
  });

  // Fetch DSO
  const { data: dsoData, isLoading: dsoLoading } = useQuery({
    queryKey: ['dso'],
    queryFn: async () => {
      const response = await api.get('/reports/dso');
      return response.data.data;
    },
    enabled: reportType === 'dso'
  });

  const reportTypes = [
    { id: 'aging', label: 'AR Aging', icon: TrendingDown },
    { id: 'summary', label: 'Receivables Summary', icon: DollarSign },
    { id: 'topDebtors', label: 'Top Debtors', icon: AlertTriangle },
    { id: 'dso', label: 'Days Sales Outstanding', icon: Calendar }
  ];

  const renderReport = () => {
    switch (reportType) {
      case 'aging':
        return <ARAgingReport data={agingData} loading={agingLoading} asOfDate={asOfDate} />;
      case 'summary':
        return <ReceivablesSummary data={summaryData} loading={summaryLoading} />;
      case 'topDebtors':
        return <TopDebtorsReport data={topDebtors} loading={debtorsLoading} />;
      case 'dso':
        return <DSOReport data={dsoData} loading={dsoLoading} />;
      default:
        return <ARAgingReport data={agingData} loading={agingLoading} asOfDate={asOfDate} />;
    }
  };

  return (
    <div className="ar-reports-page">
      <div className="page-header">
        <div>
          <h1>Accounts Receivable Reports</h1>
          <p className="page-subtitle">Analyze customer receivables and payment patterns</p>
        </div>
      </div>

      <div className="report-controls">
        <div className="report-selector">
          {reportTypes.map(type => {
            const IconComponent = type.icon;
            return (
              <button
                key={type.id}
                className={`report-type-btn ${reportType === type.id ? 'active' : ''}`}
                onClick={() => setReportType(type.id)}
              >
                <IconComponent size={18} />
                {type.label}
              </button>
            );
          })}
        </div>

        <div className="report-filters">
          {reportType === 'aging' && (
            <FormInput
              label="As of Date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="date-filter"
            />
          )}
          
          <Button variant="secondary" className="export-btn">
            <Download size={18} />
            Export
          </Button>
        </div>
      </div>

      <div className="report-content">
        {renderReport()}
      </div>
    </div>
  );
}

// AR Aging Report Component
function ARAgingReport({ data, loading, asOfDate }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="no-data">No data available</div>;
  }

  // Column definitions for aging report
  const columnDefs = [
    {
      headerName: 'Customer',
      field: 'customer_name',
      filter: true,
      flex: 1
    },
    {
      headerName: 'Customer Code',
      field: 'customer_code',
      filter: true,
      width: 120
    },
    {
      headerName: 'Total Outstanding',
      field: 'total_outstanding',
      filter: 'agNumberColumnFilter',
      width: 140,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: 'Current',
      field: 'current_amount',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: '1-30 Days',
      field: 'days_1_30',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: '31-60 Days',
      field: 'days_31_60',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: '61-90 Days',
      field: 'days_61_90',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: '90+ Days',
      field: 'days_over_90',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: 'amount-cell'
    }
  ];

  // Summary cards
  const summary = data.summary || {};

  return (
    <div className="ar-aging-report">
      <div className="report-summary">
        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(summary.totalReceivables || 0).toLocaleString()}</div>
              <div className="summary-label">Total Receivables</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <TrendingDown size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(summary.total_1_30 || 0).toLocaleString()}</div>
              <div className="summary-label">Current & 1-30 Days</div>
            </div>
          </div>
        </div>

        <div className="summary-card warning">
          <div className="summary-content">
            <div className="summary-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(summary.total_over_90 || 0).toLocaleString()}</div>
              <div className="summary-label">Over 90 Days</div>
            </div>
          </div>
        </div>
      </div>

      <div className="aging-grid-container">
        <h3>AR Aging as of {new Date(asOfDate).toLocaleDateString()}</h3>
        <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
          <AgGridReact
            rowData={data.agingBuckets || []}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true
            }}
            pagination={true}
            paginationPageSize={15}
            paginationPageSizeSelector={[10, 15, 25, 50]}
            rowSelection={{ mode: 'singleRow' }}
            onGridReady={(params) => {
              params.api.sizeColumnsToFit({
                defaultMinWidth: 100,
                columnLimits: []
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Receivables Summary Component
function ReceivablesSummary({ data, loading }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="no-data">No data available</div>;
  }

  return (
    <div className="receivables-summary">
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(data.totalValue || 0).toLocaleString()}</div>
              <div className="summary-label">Total Invoices</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(data.totalOutstanding || 0).toLocaleString()}</div>
              <div className="summary-label">Total Outstanding</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">${(data.totalPaid || 0).toLocaleString()}</div>
              <div className="summary-label">Total Paid</div>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="summary-text">
              <div className="summary-value">{data.overdue?.count || 0}</div>
              <div className="summary-label">Overdue Invoices</div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-breakdown">
        <h3>Invoice Status Breakdown</h3>
        <div className="status-chart">
          <div className="status-item">
            <div className="status-label">Unpaid</div>
            <div className="status-bar">
              <div 
                className="status-fill unpaid" 
                style={{ 
                  width: `${data.statusBreakdown?.unpaid?.count ? 
                    (data.statusBreakdown.unpaid.count / 
                    (data.totalInvoices || 1)) * 100 : 0}%` 
                }}
              ></div>
            </div>
            <div className="status-count">{data.statusBreakdown?.unpaid?.count || 0}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Partially Paid</div>
            <div className="status-bar">
              <div 
                className="status-fill partiallyPaid" 
                style={{ 
                  width: `${data.statusBreakdown?.partiallyPaid?.count ? 
                    (data.statusBreakdown.partiallyPaid.count / 
                    (data.totalInvoices || 1)) * 100 : 0}%` 
                }}
              ></div>
            </div>
            <div className="status-count">{data.statusBreakdown?.partiallyPaid?.count || 0}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Overdue</div>
            <div className="status-bar">
              <div 
                className="status-fill overdue" 
                style={{ 
                  width: `${data.statusBreakdown?.overdue?.count ? 
                    (data.statusBreakdown.overdue.count / 
                    (data.totalInvoices || 1)) * 100 : 0}%` 
                }}
              ></div>
            </div>
            <div className="status-count">{data.statusBreakdown?.overdue?.count || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Top Debtors Report
function TopDebtorsReport({ data, loading }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="no-data">No data available</div>;
  }

  const columnDefs = [
    {
      headerName: 'Customer',
      field: 'customer_name',
      filter: true,
      flex: 1
    },
    {
      headerName: 'Customer Code',
      field: 'customer_code',
      filter: true,
      width: 120
    },
    {
      headerName: 'Outstanding Balance',
      field: 'outstanding_balance',
      filter: 'agNumberColumnFilter',
      width: 160,
      valueFormatter: (params) => `$${parseFloat(params.value).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: 'Total Invoiced',
      field: 'total_invoiced',
      filter: 'agNumberColumnFilter',
      width: 140,
      valueFormatter: (params) => `$${parseFloat(params.value).toLocaleString()}`,
      cellClass: 'amount-cell'
    },
    {
      headerName: 'Invoice Count',
      field: 'invoice_count',
      filter: 'agNumberColumnFilter',
      width: 120,
      cellClass: 'number-cell'
    }
  ];

  return (
    <div className="top-debtors-report">
      <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true
          }}
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          rowSelection="single"
          onGridReady={(params) => {
            params.api.sizeColumnsToFit({
              defaultMinWidth: 100,
              columnLimits: []
            });
          }}
        />
      </div>
    </div>
  );
}

// Days Sales Outstanding Report
function DSOReport({ data, loading }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="no-data">No data available</div>;
  }

  return (
    <div className="dso-report">
      <div className="dso-metric">
        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-icon">
              <Calendar size={32} />
            </div>
            <div className="metric-text">
              <div className="metric-value">{data.dso}</div>
              <div className="metric-label">Days Sales Outstanding</div>
            </div>
          </div>
        </div>

        <div className="metric-details">
          <div className="detail-item">
            <span className="detail-label">Period:</span>
            <span className="detail-value">{data.period} days</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Sales:</span>
            <span className="detail-value">${(data.totalSales || 0).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total AR:</span>
            <span className="detail-value">${(data.totalAR || 0).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Avg. Invoice Value:</span>
            <span className="detail-value">${(data.avgInvoiceValue || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="dso-info">
        <h4>About Days Sales Outstanding (DSO)</h4>
        <p>
          DSO = (Total Accounts Receivable ÷ Total Credit Sales) × Number of Days<br />
          DSO measures the average number of days it takes to collect payment after a sale.
        </p>
        <p className="dso-calculation">{data.calculation}</p>
      </div>
    </div>
  );
}