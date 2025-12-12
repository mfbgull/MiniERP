import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { Plus, Edit2, Trash2, Eye, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import './CustomersPage.css';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

export default function CustomersPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers', searchTerm, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('search', searchTerm);
      params.append('status', activeTab);
      
      const response = await api.get(`/customers?${params.toString()}`);
      return response.data.data;
    }
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      queryClient.invalidateQueries(['customers']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete customer');
    }
  });

  const handleDelete = (id, customerName) => {
    if (window.confirm(`Are you sure you want to delete customer "${customerName}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleView = (customer) => {
    // Navigate to customer detail page
    navigate(`/customers/${customer.id}`);
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
  };

  const columnDefs = [
    {
      headerName: 'Customer Code',
      field: 'customer_code',
      filter: true,
      width: 120,
      cellRenderer: (params) => (
        <span className="customer-code">{params.value}</span>
      )
    },
    {
      headerName: 'Customer Name',
      field: 'customer_name',
      filter: true,
      flex: 1,
      cellRenderer: (params) => (
        <div>
          <div className="customer-name">{params.value}</div>
          {params.data.contact_person && (
            <div className="contact-person">{params.data.contact_person}</div>
          )}
        </div>
      )
    },
    {
      headerName: 'Contact Info',
      field: 'phone',
      filter: true,
      width: 180,
      cellRenderer: (params) => (
        <div>
          <div>{params.value}</div>
          <div className="email">{params.data.email}</div>
        </div>
      )
    },
    {
      headerName: 'Address',
      field: 'billing_address',
      filter: true,
      width: 200,
      cellRenderer: (params) => (
        <div className="address">
          {params.value && params.value.split('\n').map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )
    },
    {
      headerName: 'Credit Limit',
      field: 'credit_limit',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: (params) => {
        if (!params.data.credit_limit || params.data.credit_limit === 0) return '';
        
        const utilization = ((params.data.current_balance || 0) / params.data.credit_limit) * 100;
        if (utilization >= 90) return 'credit-limit-exceeded';
        if (utilization >= 75) return 'credit-limit-warning';
        return '';
      }
    },
    {
      headerName: 'Current Balance',
      field: 'current_balance',
      filter: 'agNumberColumnFilter',
      width: 140,
      valueFormatter: (params) => `$${parseFloat(params.value || 0).toLocaleString()}`,
      cellClass: (params) => {
        if (params.value > 0) return 'balance-outstanding';
        return 'balance-paid';
      }
    },
    {
      headerName: 'Credit Utilization',
      field: 'credit_utilization_percent',
      filter: 'agNumberColumnFilter',
      width: 140,
      valueFormatter: (params) => {
        if (!params.data.credit_limit || params.data.credit_limit === 0) return 'N/A';
        return `${(params.value || 0).toFixed(2)}%`;
      },
      cellRenderer: (params) => {
        if (!params.data.credit_limit || params.data.credit_limit === 0) {
          return <span className="credit-utilization">N/A</span>;
        }
        
        const utilization = params.value || 0;
        let className = 'credit-utilization ';
        if (utilization >= 90) className += 'utilization-high';
        else if (utilization >= 75) className += 'utilization-medium';
        else className += 'utilization-low';
        
        return <span className={className}>{utilization.toFixed(2)}%</span>;
      }
    },
    {
      headerName: 'Payment Terms',
      field: 'payment_terms_days',
      filter: 'agNumberColumnFilter',
      width: 120,
      valueFormatter: (params) => `${params.value || 0} days`
    },
    {
      headerName: 'Status',
      field: 'is_active',
      filter: true,
      width: 100,
      cellRenderer: (params) => (
        <span className={`status ${params.value ? 'status-active' : 'status-inactive'}`}>
          {params.value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 150,
      cellRenderer: (params) => (
        <div className="action-buttons">
          <button
            className="action-btn view-btn"
            onClick={() => handleView(params.data)}
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button
            className="action-btn edit-btn"
            onClick={() => handleEdit(params.data)}
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            className="action-btn delete-btn"
            onClick={() => handleDelete(params.data.id, params.data.customer_name)}
            title="Delete"
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      sortable: false,
      filter: false,
      pinned: 'right'
    }
  ];

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="page-subtitle">Manage customer accounts and credit information</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <Plus size={18} />
          Add Customer
        </Button>
      </div>

      <div className="page-controls">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="tab-container">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active
          </button>
          <button
            className={`tab ${activeTab === 'inactive' ? 'active' : ''}`}
            onClick={() => setActiveTab('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={customers}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true
            }}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
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

      {/* Customer Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={selectedCustomer ? 'Edit Customer' : 'Add Customer'}
        size="large"
      >
        <CustomerForm
          customer={selectedCustomer}
          onClose={handleModalClose}
          onSuccess={() => {
            queryClient.invalidateQueries(['customers']);
            handleModalClose();
          }}
        />
      </Modal>
    </div>
  );
}

function CustomerForm({ customer, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_person: '',
    email: '',
    phone: '',
    billing_address: '',
    shipping_address: '',
    payment_terms: '',
    payment_terms_days: 14,
    credit_limit: 0,
    opening_balance: 0
  });
  
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: async (data) => {
      if (customer) {
        return api.put(`/customers/${customer.id}`, data);
      } else {
        return api.post('/customers', data);
      }
    },
    onSuccess: () => {
      toast.success(customer ? 'Customer updated successfully' : 'Customer created successfully');
      onSuccess();
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || (customer ? 'Failed to update customer' : 'Failed to create customer');
      toast.error(errorMsg);
    }
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        customer_name: customer.customer_name || '',
        contact_person: customer.contact_person || '',
        email: customer.email || '',
        phone: customer.phone || '',
        billing_address: customer.billing_address || '',
        shipping_address: customer.shipping_address || '',
        payment_terms: customer.payment_terms || '',
        payment_terms_days: customer.payment_terms_days || 14,
        credit_limit: customer.credit_limit || 0,
        opening_balance: customer.opening_balance || 0
      });
    } else {
      setFormData({
        customer_name: '',
        contact_person: '',
        email: '',
        phone: '',
        billing_address: '',
        shipping_address: '',
        payment_terms: '',
        payment_terms_days: 14,
        credit_limit: 0,
        opening_balance: 0
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('_days') || name === 'credit_limit' || name === 'opening_balance' 
        ? Number(value) || 0 
        : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="customer-form">
      <div className="form-row">
        <FormInput
          label="Customer Name *"
          name="customer_name"
          value={formData.customer_name}
          onChange={handleChange}
          error={errors.customer_name}
          required
          autoFocus={!customer}
        />
        
        <FormInput
          label="Contact Person"
          name="contact_person"
          value={formData.contact_person}
          onChange={handleChange}
        />
      </div>

      <div className="form-row">
        <FormInput
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />
        
        <FormInput
          label="Phone *"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
          required
        />
      </div>

      <div className="form-row">
        <FormInput
          label="Payment Terms (days)"
          name="payment_terms_days"
          type="number"
          value={formData.payment_terms_days}
          onChange={handleChange}
          min="0"
          step="1"
        />
        
        <FormInput
          label="Credit Limit ($)"
          name="credit_limit"
          type="number"
          value={formData.credit_limit}
          onChange={handleChange}
          min="0"
          step="0.01"
        />
      </div>

      <FormInput
        label="Billing Address"
        name="billing_address"
        type="textarea"
        value={formData.billing_address}
        onChange={handleChange}
        rows={3}
      />

      <FormInput
        label="Shipping Address"
        name="shipping_address"
        type="textarea"
        value={formData.shipping_address}
        onChange={handleChange}
        rows={3}
      />

      {customer && (
        <FormInput
          label="Opening Balance ($)"
          name="opening_balance"
          type="number"
          value={formData.opening_balance}
          onChange={handleChange}
          min="0"
          step="0.01"
          help="Only for creating a new customer. Existing customers will have their balance adjusted through transactions."
        />
      )}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {customer ? 'Update' : 'Create'} Customer
        </Button>
      </div>
    </form>
  );
}