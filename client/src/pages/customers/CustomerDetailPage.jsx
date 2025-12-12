import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Clock,
  CreditCard,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Download,
  Printer,
  Image,
  FileSpreadsheet
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PaymentModal from '../../components/customers/PaymentModal';
import './CustomerDetailPage.css';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [paymentToEdit, setPaymentToEdit] = useState(null);

  // Fetch customer details
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data.data;
    }
  });

  // Fetch customer invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['customerInvoices', id],
    queryFn: async () => {
      const response = await api.get(`/invoices?customerId=${id}`);
      return response.data.data;
    },
    enabled: !!id
  });

  // Fetch customer ledger
  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ['customerLedger', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}/ledger`);
      return response.data.data;
    },
    enabled: !!id
  });

  // Fetch customer payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['customerPayments', id],
    queryFn: async () => {
      const response = await api.get(`/payments?customerId=${id}`);
      return response.data.data;
    },
    enabled: !!id
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId) => {
      return api.delete(`/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      toast.success('Invoice deleted successfully');
      queryClient.invalidateQueries(['customerInvoices', id]);
      queryClient.invalidateQueries(['customer', id]);
      queryClient.invalidateQueries(['customerLedger', id]);
      queryClient.invalidateQueries(['invoices']);
      setInvoiceToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete invoice');
    }
  });

  const handleDeleteInvoice = (invoice) => {
    setInvoiceToDelete(invoice);
  };

  const confirmDeleteInvoice = () => {
    if (invoiceToDelete) {
      deleteInvoiceMutation.mutate(invoiceToDelete.id);
    }
  };

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId) => {
      return api.delete(`/payments/${paymentId}`);
    },
    onSuccess: () => {
      toast.success('Payment deleted successfully');
      queryClient.invalidateQueries(['customerPayments', id]);
      queryClient.invalidateQueries(['customerInvoices', id]);
      queryClient.invalidateQueries(['customer', id]);
      queryClient.invalidateQueries(['customerLedger', id]);
      setPaymentToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete payment');
    }
  });

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment);
  };

  const confirmDeletePayment = () => {
    if (paymentToDelete) {
      deletePaymentMutation.mutate(paymentToDelete.id);
    }
  };

  const handleEditPayment = (payment) => {
    setPaymentToEdit(payment);
  };

  if (isLoading) {
    return (
      <div className="customer-detail-page loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-detail-page error">
        <h2>Error loading customer</h2>
        <p>{error.message}</p>
        <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  // Calculate customer metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalOutstanding = customer?.current_balance || 0;
  const creditUtilization = customer?.credit_limit && customer.credit_limit > 0 
    ? ((customer.current_balance || 0) / customer.credit_limit) * 100 
    : 0;

  const overdueInvoices = invoices.filter(inv => 
    inv.status === 'Overdue' && (inv.balance_amount || 0) > 0
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'ledger', label: 'Ledger', icon: Package },
    { id: 'payments', label: 'Payments', icon: CreditCard }
  ];

  return (
    <div className="customer-detail-page">
      <div className="page-header">
        <div className="header-content">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/customers')}
            className="back-button"
          >
            <ArrowLeft size={16} />
            Back to Customers
          </Button>
          
          <div className="customer-header">
            <div className="customer-basic-info">
              <h1>{customer.customer_name}</h1>
              <p className="customer-code">{customer.customer_code}</p>
              {customer.contact_person && (
                <p className="contact-person">Contact: {customer.contact_person}</p>
              )}
            </div>
            
            <div className="customer-actions">
              <Button 
                variant="primary" 
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <Plus size={16} />
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="quick-stats-bar">
        <div className="quick-stat">
          <DollarSign size={18} />
          <div className="quick-stat-content">
            <span className="quick-stat-value">${(customer.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="quick-stat-label">Balance</span>
          </div>
        </div>
        <div className="quick-stat-divider"></div>
        <div className="quick-stat">
          <CreditCard size={18} />
          <div className="quick-stat-content">
            <span className="quick-stat-value">${(customer.credit_limit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="quick-stat-label">Credit Limit</span>
          </div>
        </div>
        <div className="quick-stat-divider"></div>
        <div className={`quick-stat ${creditUtilization > 90 ? 'danger' : creditUtilization > 75 ? 'warning' : ''}`}>
          <TrendingUp size={18} />
          <div className="quick-stat-content">
            <span className="quick-stat-value">{creditUtilization.toFixed(1)}%</span>
            <span className="quick-stat-label">Utilization</span>
          </div>
        </div>
        <div className="quick-stat-divider"></div>
        <div className={`quick-stat ${overdueInvoices.length > 0 ? 'danger' : ''}`}>
          <AlertTriangle size={18} />
          <div className="quick-stat-content">
            <span className="quick-stat-value">{overdueInvoices.length}</span>
            <span className="quick-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-container">
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComponent size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <OverviewTab 
            customer={customer} 
            invoices={invoices}
            ledger={ledger}
            payments={payments}
          />
        )}
        
        {activeTab === 'invoices' && (
          <InvoicesTab
            invoices={invoices}
            loading={invoicesLoading}
            onViewInvoice={(invoiceId) => navigate(`/sales/invoice/${invoiceId}`)}
            onDeleteInvoice={handleDeleteInvoice}
          />
        )}
        
        {activeTab === 'ledger' && (
          <LedgerTab
            ledger={ledger}
            loading={ledgerLoading}
            customerName={customer?.customer_name}
          />
        )}
        
        {activeTab === 'payments' && (
          <PaymentsTab
            payments={payments}
            loading={paymentsLoading}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
          />
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Payment"
        size="large"
      >
        <PaymentModal
          customerId={id}
          customer={customer}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={() => {
            // Refresh data after payment is recorded
            queryClient.invalidateQueries(['customer', id]);
            queryClient.invalidateQueries(['customerInvoices', id]);
            queryClient.invalidateQueries(['customerLedger', id]);
            queryClient.invalidateQueries(['customerPayments', id]);
            queryClient.invalidateQueries(['invoices']);
          }}
        />
      </Modal>

      {/* Delete Invoice Confirmation Modal */}
      <Modal
        isOpen={!!invoiceToDelete}
        onClose={() => setInvoiceToDelete(null)}
        title="Delete Invoice"
        size="small"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete invoice <strong>{invoiceToDelete?.invoice_no}</strong>?</p>
          {invoiceToDelete?.paid_amount > 0 && (
            <p className="delete-warning">
              Warning: This invoice has payments recorded against it. Deleting it will affect the customer's balance.
            </p>
          )}
          <div className="delete-actions">
            <Button variant="secondary" onClick={() => setInvoiceToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteInvoice}
              loading={deleteInvoiceMutation.isPending}
            >
              Delete Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Payment Confirmation Modal */}
      <Modal
        isOpen={!!paymentToDelete}
        onClose={() => setPaymentToDelete(null)}
        title="Delete Payment"
        size="small"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete payment <strong>{paymentToDelete?.payment_no}</strong>?</p>
          <p className="delete-warning">
            Warning: Deleting this payment will update the associated invoice balances and customer balance.
          </p>
          <div className="delete-actions">
            <Button variant="secondary" onClick={() => setPaymentToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeletePayment}
              loading={deletePaymentMutation.isPending}
            >
              Delete Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal
        isOpen={!!paymentToEdit}
        onClose={() => setPaymentToEdit(null)}
        title="Edit Payment"
        size="medium"
      >
        {paymentToEdit && (
          <EditPaymentForm
            payment={paymentToEdit}
            onClose={() => setPaymentToEdit(null)}
            onSuccess={() => {
              queryClient.invalidateQueries(['customerPayments', id]);
              queryClient.invalidateQueries(['customerInvoices', id]);
              queryClient.invalidateQueries(['customer', id]);
              queryClient.invalidateQueries(['customerLedger', id]);
              setPaymentToEdit(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ customer, invoices, ledger, payments }) {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_amount || 0), 0);

  const paidInvoices = invoices.filter(inv => inv.status === 'Paid').length;
  const unpaidInvoices = invoices.filter(inv => inv.status === 'Unpaid' || inv.status === 'Partially Paid').length;
  const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue').length;

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date)).slice(0, 5);
  const recentPayments = [...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).slice(0, 5);

  // Calculate average days to pay
  const paidInvoicesWithPayments = invoices.filter(inv => inv.status === 'Paid' && inv.paid_amount > 0);
  const avgDaysToPay = paidInvoicesWithPayments.length > 0
    ? Math.round(paidInvoicesWithPayments.reduce((sum, inv) => {
        const invoiceDate = new Date(inv.invoice_date);
        const paidDate = new Date(inv.updated_at || inv.invoice_date);
        return sum + Math.max(0, (paidDate - invoiceDate) / (1000 * 60 * 60 * 24));
      }, 0) / paidInvoicesWithPayments.length)
    : 0;

  return (
    <div className="overview-tab">
      {/* Financial Summary Section */}
      <div className="overview-financial-summary">
        <h3 className="section-title">
          <DollarSign size={18} />
          Financial Summary
        </h3>
        <div className="financial-stats-grid">
          <div className="financial-stat-card">
            <div className="stat-icon invoiced">
              <FileText size={20} />
            </div>
            <div className="stat-content">
              <span className="stat-value">${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="stat-label">Total Invoiced</span>
            </div>
          </div>
          <div className="financial-stat-card">
            <div className="stat-icon paid">
              <CreditCard size={20} />
            </div>
            <div className="stat-content">
              <span className="stat-value">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="stat-label">Total Received</span>
            </div>
          </div>
          <div className="financial-stat-card">
            <div className="stat-icon outstanding">
              <Clock size={20} />
            </div>
            <div className="stat-content">
              <span className="stat-value">${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="stat-label">Outstanding Balance</span>
            </div>
          </div>
          <div className="financial-stat-card">
            <div className="stat-icon days">
              <Calendar size={20} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{avgDaysToPay}</span>
              <span className="stat-label">Avg. Days to Pay</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Status Overview */}
      <div className="overview-invoice-status">
        <h3 className="section-title">
          <Receipt size={18} />
          Invoice Status
        </h3>
        <div className="invoice-status-grid">
          <div className="status-card paid">
            <div className="status-count">{paidInvoices}</div>
            <div className="status-label">Paid</div>
            <div className="status-bar">
              <div className="status-bar-fill" style={{ width: invoices.length ? `${(paidInvoices / invoices.length) * 100}%` : '0%' }}></div>
            </div>
          </div>
          <div className="status-card pending">
            <div className="status-count">{unpaidInvoices}</div>
            <div className="status-label">Pending</div>
            <div className="status-bar">
              <div className="status-bar-fill" style={{ width: invoices.length ? `${(unpaidInvoices / invoices.length) * 100}%` : '0%' }}></div>
            </div>
          </div>
          <div className="status-card overdue">
            <div className="status-count">{overdueInvoices}</div>
            <div className="status-label">Overdue</div>
            <div className="status-bar">
              <div className="status-bar-fill" style={{ width: invoices.length ? `${(overdueInvoices / invoices.length) * 100}%` : '0%' }}></div>
            </div>
          </div>
          <div className="status-card total">
            <div className="status-count">{invoices.length}</div>
            <div className="status-label">Total Invoices</div>
            <div className="status-bar">
              <div className="status-bar-fill" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="overview-columns">
        {/* Customer Information */}
        <div className="overview-card">
          <h3 className="section-title">
            <FileText size={18} />
            Contact Information
          </h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </span>
              <div className="info-text">
                <span className="info-label">Phone</span>
                <span className="info-value">{customer.phone || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <div className="info-text">
                <span className="info-label">Email</span>
                <span className="info-value">{customer.email || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item full-width">
              <span className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div className="info-text">
                <span className="info-label">Billing Address</span>
                <span className="info-value">{customer.billing_address || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item full-width">
              <span className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13"/>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </span>
              <div className="info-text">
                <span className="info-label">Shipping Address</span>
                <span className="info-value">{customer.shipping_address || 'Same as billing'}</span>
              </div>
            </div>
          </div>

          <div className="info-divider"></div>

          <h4 className="subsection-title">Account Settings</h4>
          <div className="account-settings">
            <div className="setting-item">
              <span className="setting-label">Payment Terms</span>
              <span className="setting-value">{customer.payment_terms_days || 14} days</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Credit Limit</span>
              <span className="setting-value">${(customer.credit_limit || 0).toLocaleString()}</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Opening Balance</span>
              <span className="setting-value">${(customer.opening_balance || 0).toLocaleString()}</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Customer Since</span>
              <span className="setting-value">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overview-card">
          <h3 className="section-title">
            <Clock size={18} />
            Recent Activity
          </h3>

          <div className="activity-section">
            <h4 className="subsection-title">Latest Invoices</h4>
            {recentInvoices.length > 0 ? (
              <div className="activity-table">
                <div className="activity-table-header">
                  <span>Invoice</span>
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {recentInvoices.map(invoice => (
                  <div key={invoice.id} className="activity-table-row">
                    <span className="invoice-no">{invoice.invoice_no}</span>
                    <span className="invoice-date">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                    <span className="invoice-amount">${parseFloat(invoice.total_amount || 0).toLocaleString()}</span>
                    <span className={`invoice-status status-badge ${(invoice.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
                      {invoice.status || 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={24} />
                <p>No invoices yet</p>
              </div>
            )}
          </div>

          <div className="activity-divider"></div>

          <div className="activity-section">
            <h4 className="subsection-title">Latest Payments</h4>
            {recentPayments.length > 0 ? (
              <div className="activity-table">
                <div className="activity-table-header">
                  <span>Payment</span>
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Method</span>
                </div>
                {recentPayments.map(payment => (
                  <div key={payment.id} className="activity-table-row">
                    <span className="payment-no">{payment.payment_no}</span>
                    <span className="payment-date">{new Date(payment.payment_date).toLocaleDateString()}</span>
                    <span className="payment-amount success">${parseFloat(payment.amount || 0).toLocaleString()}</span>
                    <span className="payment-method">{payment.payment_method || 'Cash'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CreditCard size={24} />
                <p>No payments yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Invoices Tab Component
function InvoicesTab({ invoices, loading, onViewInvoice, onDeleteInvoice }) {
  const columnDefs = [
    {
      headerName: 'Invoice No',
      field: 'invoice_no',
      filter: true,
      width: 120,
      cellRenderer: (params) => (
        <button
          className="invoice-link"
          onClick={() => onViewInvoice(params.data.id)}
        >
          {params.value}
        </button>
      )
    },
    {
      headerName: 'Date',
      field: 'invoice_date',
      filter: true,
      width: 110,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      headerName: 'Due Date',
      field: 'due_date',
      filter: true,
      width: 110,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      headerName: 'Total',
      field: 'total_amount',
      filter: 'agNumberColumnFilter',
      width: 110,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`
    },
    {
      headerName: 'Paid',
      field: 'paid_amount',
      filter: 'agNumberColumnFilter',
      width: 100,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`
    },
    {
      headerName: 'Balance',
      field: 'balance_amount',
      filter: 'agNumberColumnFilter',
      width: 100,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: (params) => params.value > 0 ? 'balance-outstanding' : 'balance-paid'
    },
    {
      headerName: 'Status',
      field: 'status',
      filter: true,
      width: 110,
      cellRenderer: (params) => (
        <span className={`status ${params.value ? params.value.toLowerCase() : 'unknown'}`}>
          {params.value || 'Unknown'}
        </span>
      )
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <div className="action-buttons">
          <button
            className="action-btn edit-btn"
            onClick={() => onViewInvoice(params.data.id)}
            title="Edit Invoice"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="action-btn delete-btn"
            onClick={() => onDeleteInvoice(params.data)}
            title="Delete Invoice"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="invoices-tab">
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
          <AgGridReact
            rowData={invoices}
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
      )}
    </div>
  );
}

// Ledger Tab Component
function LedgerTab({ ledger, loading, customerName }) {
  const ledgerRef = useRef(null);
  const gridRef = useRef(null);

  // Calculate totals
  const totals = useMemo(() => {
    if (!ledger || ledger.length === 0) return { debit: 0, credit: 0, balance: 0 };

    const totalDebit = ledger.reduce((sum, item) => sum + parseFloat(item.debit || 0), 0);
    const totalCredit = ledger.reduce((sum, item) => sum + parseFloat(item.credit || 0), 0);
    // Balance = Total Debit - Total Credit (Debit increases AR, Credit decreases AR)
    const currentBalance = totalDebit - totalCredit;

    return { debit: totalDebit, credit: totalCredit, balance: currentBalance };
  }, [ledger]);

  const columnDefs = [
    {
      headerName: 'Date',
      field: 'transaction_date',
      filter: true,
      width: 110,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      headerName: 'Type',
      field: 'transaction_type',
      filter: true,
      width: 110,
      cellRenderer: (params) => (
        <span className={`transaction-type ${params.value?.toLowerCase()}`}>
          {params.value}
        </span>
      )
    },
    {
      headerName: 'Reference',
      field: 'reference_no',
      filter: true,
      width: 130
    },
    {
      headerName: 'Description',
      field: 'description',
      filter: true,
      flex: 1
    },
    {
      headerName: 'Debit',
      field: 'debit',
      filter: 'agNumberColumnFilter',
      width: 110,
      valueFormatter: (params) => params.value ? `$${parseFloat(params.value).toFixed(2)}` : ''
    },
    {
      headerName: 'Credit',
      field: 'credit',
      filter: 'agNumberColumnFilter',
      width: 110,
      valueFormatter: (params) => params.value ? `$${parseFloat(params.value).toFixed(2)}` : ''
    },
    {
      headerName: 'Balance',
      field: 'balance',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toFixed(2)}`
    }
  ];

  // Export to CSV
  const exportToCSV = () => {
    if (!ledger || ledger.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = ledger.map(item => [
      item.transaction_date ? new Date(item.transaction_date).toLocaleDateString() : '',
      item.transaction_type || '',
      item.reference_no || '',
      item.description || '',
      item.debit || 0,
      item.credit || 0,
      item.balance || 0
    ]);

    // Add totals row
    rows.push(['', '', '', 'TOTALS', totals.debit.toFixed(2), totals.credit.toFixed(2), totals.balance.toFixed(2)]);

    const csvContent = [
      `Customer Ledger - ${customerName || 'Customer'}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ledger_${customerName?.replace(/\s+/g, '_') || 'customer'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('CSV exported successfully');
  };

  // Export to PDF - using table-based approach for better results
  const exportToPDF = async () => {
    if (!ledger || ledger.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      toast.loading('Generating PDF...', { id: 'pdf-export' });

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();

      // Title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Customer Ledger - ${customerName || 'Customer'}`, 14, 15);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

      // Table headers
      const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
      const colWidths = [25, 25, 30, 80, 30, 30, 30];
      let startX = 14;
      let startY = 32;

      // Draw header row
      pdf.setFillColor(240, 240, 240);
      pdf.rect(startX, startY - 5, pageWidth - 28, 8, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');

      let xPos = startX;
      headers.forEach((header, i) => {
        pdf.text(header, xPos + 2, startY);
        xPos += colWidths[i];
      });

      // Draw data rows
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      startY += 8;

      ledger.forEach((item, index) => {
        if (startY > 190) {
          pdf.addPage();
          startY = 20;
        }

        xPos = startX;
        const row = [
          item.transaction_date ? new Date(item.transaction_date).toLocaleDateString() : '',
          item.transaction_type || '',
          item.reference_no || '',
          (item.description || '').substring(0, 40),
          item.debit ? `$${parseFloat(item.debit).toFixed(2)}` : '',
          item.credit ? `$${parseFloat(item.credit).toFixed(2)}` : '',
          `$${parseFloat(item.balance || 0).toFixed(2)}`
        ];

        row.forEach((cell, i) => {
          pdf.text(String(cell), xPos + 2, startY);
          xPos += colWidths[i];
        });

        startY += 6;
      });

      // Totals row
      startY += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(245, 245, 245);
      pdf.rect(startX, startY - 5, pageWidth - 28, 8, 'F');

      xPos = startX;
      const totalsRow = ['', '', '', 'TOTALS', `$${totals.debit.toFixed(2)}`, `$${totals.credit.toFixed(2)}`, `$${totals.balance.toFixed(2)}`];
      totalsRow.forEach((cell, i) => {
        pdf.text(String(cell), xPos + 2, startY);
        xPos += colWidths[i];
      });

      pdf.save(`ledger_${customerName?.replace(/\s+/g, '_') || 'customer'}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported successfully', { id: 'pdf-export' });
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF', { id: 'pdf-export' });
    }
  };

  // Export to Image
  const exportToImage = async () => {
    if (!ledgerRef.current) {
      toast.error('No content to export');
      return;
    }

    try {
      toast.loading('Generating image...', { id: 'image-export' });

      // Wait a moment for any pending renders
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(ledgerRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: false
      });

      const link = document.createElement('a');
      link.download = `ledger_${customerName?.replace(/\s+/g, '_') || 'customer'}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image exported successfully', { id: 'image-export' });
    } catch (error) {
      console.error('Image export error:', error);
      toast.error('Failed to export image. Try using Print instead.', { id: 'image-export' });
    }
  };

  // Print
  const handlePrint = () => {
    const printContent = ledgerRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Customer Ledger - ${customerName || 'Customer'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            .print-date { font-size: 12px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            .transaction-type { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
            .transaction-type.invoice { background: #e0f2fe; color: #0369a1; }
            .transaction-type.payment { background: #dcfce7; color: #166534; }
          </style>
        </head>
        <body>
          <h1>Customer Ledger - ${customerName || 'Customer'}</h1>
          <div class="print-date">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map(item => `
                <tr>
                  <td>${item.transaction_date ? new Date(item.transaction_date).toLocaleDateString() : ''}</td>
                  <td><span class="transaction-type ${item.transaction_type?.toLowerCase()}">${item.transaction_type || ''}</span></td>
                  <td>${item.reference_no || ''}</td>
                  <td>${item.description || ''}</td>
                  <td class="text-right">${item.debit ? '$' + parseFloat(item.debit).toFixed(2) : ''}</td>
                  <td class="text-right">${item.credit ? '$' + parseFloat(item.credit).toFixed(2) : ''}</td>
                  <td class="text-right">$${parseFloat(item.balance || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="totals-row">
                <td colspan="4"><strong>TOTALS</strong></td>
                <td class="text-right"><strong>$${totals.debit.toFixed(2)}</strong></td>
                <td class="text-right"><strong>$${totals.credit.toFixed(2)}</strong></td>
                <td class="text-right"><strong>$${totals.balance.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="ledger-tab">
      {/* Toolbar */}
      <div className="ledger-toolbar">
        <div className="ledger-title">
          <FileText size={18} />
          <span>Account Ledger</span>
        </div>
        <div className="ledger-actions">
          <button className="export-btn" onClick={exportToCSV} title="Export to CSV">
            <FileSpreadsheet size={16} />
            <span>CSV</span>
          </button>
          <button className="export-btn" onClick={exportToPDF} title="Export to PDF">
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button className="export-btn" onClick={exportToImage} title="Export to Image">
            <Image size={16} />
            <span>Image</span>
          </button>
          <button className="export-btn" onClick={handlePrint} title="Print">
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div ref={ledgerRef}>
          <div className="ag-theme-quartz" style={{ height: 350, width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={ledger}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true
              }}
              pagination={true}
              paginationPageSize={10}
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

          {/* Totals Section */}
          <div className="ledger-totals">
            <div className="totals-grid">
              <div className="total-item">
                <span className="total-label">Total Debit</span>
                <span className="total-value debit">${totals.debit.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span className="total-label">Total Credit</span>
                <span className="total-value credit">${totals.credit.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span className="total-label">Current Balance</span>
                <span className={`total-value balance ${totals.balance > 0 ? 'positive' : 'zero'}`}>
                  ${totals.balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Payments Tab Component
function PaymentsTab({ payments, loading, onEditPayment, onDeletePayment }) {
  const columnDefs = [
    {
      headerName: 'Payment No',
      field: 'payment_no',
      filter: true,
      width: 120
    },
    {
      headerName: 'Date',
      field: 'payment_date',
      filter: true,
      width: 110,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      headerName: 'Amount',
      field: 'amount',
      filter: 'agNumberColumnFilter',
      width: 110,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`
    },
    {
      headerName: 'Method',
      field: 'payment_method',
      filter: true,
      width: 110
    },
    {
      headerName: 'Reference',
      field: 'reference_no',
      filter: true,
      width: 120
    },
    {
      headerName: 'Notes',
      field: 'notes',
      filter: true,
      flex: 1
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <div className="action-buttons">
          <button
            className="action-btn edit-btn"
            onClick={() => onEditPayment(params.data)}
            title="Edit Payment"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="action-btn delete-btn"
            onClick={() => onDeletePayment(params.data)}
            title="Delete Payment"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="payments-tab">
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
          <AgGridReact
            rowData={payments}
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
      )}
    </div>
  );
}

// Edit Payment Form Component
function EditPaymentForm({ payment, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    payment_date: payment.payment_date?.split('T')[0] || '',
    payment_method: payment.payment_method || 'Cash',
    reference_no: payment.reference_no || '',
    notes: payment.notes || ''
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      return api.put(`/payments/${payment.id}`, data);
    },
    onSuccess: () => {
      toast.success('Payment updated successfully');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="edit-payment-form">
      <div className="form-group">
        <label>Payment No</label>
        <input type="text" value={payment.payment_no} disabled className="form-input disabled" />
      </div>

      <div className="form-group">
        <label>Amount</label>
        <input type="text" value={`$${parseFloat(payment.amount).toFixed(2)}`} disabled className="form-input disabled" />
        <small className="form-hint">Amount cannot be changed. Delete and create new payment if needed.</small>
      </div>

      <div className="form-row-edit">
        <div className="form-group">
          <label>Payment Date</label>
          <input
            type="date"
            name="payment_date"
            value={formData.payment_date}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Payment Method</label>
          <select
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            className="form-input"
          >
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Reference No</label>
        <input
          type="text"
          name="reference_no"
          value={formData.reference_no}
          onChange={handleChange}
          placeholder="Check number, transaction ID, etc."
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="form-input"
          placeholder="Optional notes..."
        />
      </div>

      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={mutation.isPending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
