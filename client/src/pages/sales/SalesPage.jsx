import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import './SalesPage.css';

export default function SalesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await api.get('/sales');
      return response.data;
    }
  });

  const columns = [
    { key: 'sale_no', label: 'Sale #', sortable: true },
    { key: 'sale_date', label: 'Date', sortable: true,
      render: (value) => format(new Date(value), 'dd MMM yyyy')
    },
    { key: 'item_name', label: 'Item', sortable: true },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      render: (value, row) => `${parseFloat(value).toFixed(2)} ${row.unit_of_measure}`
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      sortable: true,
      render: (value) => `$${parseFloat(value).toFixed(2)}`
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value) => <strong className="revenue">${parseFloat(value).toFixed(2)}</strong>
    },
    { key: 'customer_name', label: 'Customer', sortable: true,
      render: (value) => value || '—'
    },
    { key: 'warehouse_name', label: 'Warehouse', sortable: false }
  ];

  const handleNew = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="sales-page">
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p className="page-subtitle">Record direct sales and track revenue</p>
        </div>
        <Button variant="primary" onClick={handleNew}>
          + Record Sale
        </Button>
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-label">Total Sales</div>
              <div className="summary-value">{sales.length}</div>
            </div>
            <div className="summary-card revenue-card">
              <div className="summary-label">Total Revenue</div>
              <div className="summary-value revenue">
                ${sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0).toFixed(2)}
              </div>
            </div>
          </div>
          <DataTable columns={columns} data={sales} />
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Sale"
        size="medium"
      >
        <SaleForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['sales']);
            queryClient.invalidateQueries(['items']);
            setIsModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function SaleForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item_id: '',
    warehouse_id: '',
    quantity: '',
    unit_price: '',
    customer_name: '',
    sale_date: new Date().toISOString().split('T')[0],
    invoice_no: '',
    remarks: ''
  });

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get('/inventory/items');
      return response.data;
    }
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/sales', data);
    },
    onSuccess: () => {
      toast.success('Sale recorded successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to record sale');
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Convert to proper types
    const data = {
      ...formData,
      item_id: parseInt(formData.item_id),
      warehouse_id: parseInt(formData.warehouse_id),
      quantity: parseFloat(formData.quantity),
      unit_price: parseFloat(formData.unit_price)
    };

    mutation.mutate(data);
  };

  const totalAmount = formData.quantity && formData.unit_price
    ? (parseFloat(formData.quantity) * parseFloat(formData.unit_price)).toFixed(2)
    : '0.00';

  // Get selected item for stock info
  const selectedItem = items.find(i => i.id === parseInt(formData.item_id));
  const selectedWarehouseId = parseInt(formData.warehouse_id);

  return (
    <form onSubmit={handleSubmit} className="sale-form">
      <div className="form-row">
        <FormInput
          label="Item *"
          name="item_id"
          type="searchable-select"
          value={formData.item_id}
          onChange={handleChange}
          options={items.map(item => ({
            value: item.id,
            label: `${item.item_code} - ${item.item_name} (Stock: ${item.current_stock})`
          }))}
          placeholder="Search items..."
          required
        />

        <FormInput
          label="Warehouse *"
          name="warehouse_id"
          type="searchable-select"
          value={formData.warehouse_id}
          onChange={handleChange}
          options={warehouses.map(wh => ({
            value: wh.id,
            label: `${wh.warehouse_code} - ${wh.warehouse_name}`
          }))}
          placeholder="Search warehouses..."
          required
        />
      </div>

      {selectedItem && (
        <div className="stock-info">
          <span>Available Stock: <strong>{selectedItem.current_stock} {selectedItem.unit_of_measure}</strong></span>
        </div>
      )}

      <div className="form-row">
        <FormInput
          label="Quantity *"
          name="quantity"
          type="number"
          step="0.001"
          value={formData.quantity}
          onChange={handleChange}
          placeholder="0.000"
          required
        />

        <FormInput
          label="Unit Price *"
          name="unit_price"
          type="number"
          step="0.01"
          value={formData.unit_price}
          onChange={handleChange}
          placeholder="0.00"
          required
        />
      </div>

      {formData.quantity && formData.unit_price && (
        <div className="total-amount-display">
          <span>Total Amount:</span>
          <strong className="revenue">${totalAmount}</strong>
        </div>
      )}

      <div className="form-row">
        <FormInput
          label="Sale Date *"
          name="sale_date"
          type="date"
          value={formData.sale_date}
          onChange={handleChange}
          required
        />

        <FormInput
          label="Customer Name"
          name="customer_name"
          value={formData.customer_name}
          onChange={handleChange}
          placeholder="e.g., John Doe"
        />
      </div>

      <FormInput
        label="Invoice Number"
        name="invoice_no"
        value={formData.invoice_no}
        onChange={handleChange}
        placeholder="e.g., INV-2025-001"
      />

      <FormInput
        label="Remarks"
        name="remarks"
        type="textarea"
        value={formData.remarks}
        onChange={handleChange}
        placeholder="Additional notes about this sale..."
        rows={3}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record Sale
        </Button>
      </div>
    </form>
  );
}
