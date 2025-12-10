import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';

export default function StockMovementPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const response = await api.get('/inventory/stock-movements', {
        params: { limit: 100 }
      });
      return response.data;
    }
  });

  const columns = [
    { key: 'movement_no', label: 'Movement No', sortable: true },
    {
      key: 'movement_date',
      label: 'Date',
      sortable: true,
      render: (value) => format(new Date(value), 'dd MMM yyyy')
    },
    { key: 'item_code', label: 'Item Code', sortable: false },
    { key: 'item_name', label: 'Item Name', sortable: false },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      render: (value, row) => (
        <span className={value >= 0 ? 'qty-in' : 'qty-out'}>
          {value >= 0 ? '+' : ''}{parseFloat(value).toFixed(2)} {row.unit_of_measure}
        </span>
      )
    },
    { key: 'warehouse_name', label: 'Warehouse', sortable: false },
    {
      key: 'movement_type',
      label: 'Type',
      sortable: true,
      render: (value) => <span className="status-tag">{value}</span>
    }
  ];

  return (
    <div className="items-page">
      <div className="page-header">
        <div>
          <h1>Stock Movements</h1>
          <p className="page-subtitle">Track all stock transactions</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + New Adjustment
        </Button>
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <DataTable columns={columns} data={movements} />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Stock Adjustment"
        size="medium"
      >
        <StockAdjustmentForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function StockAdjustmentForm({ onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    item_id: '',
    warehouse_id: '',
    quantity: 0,
    movement_type: 'ADJUSTMENT',
    movement_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get('/inventory/items');
      return response.data;
    }
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data) => api.post('/inventory/stock-movements', data),
    onSuccess: () => {
      toast.success('Stock adjusted successfully!');
      queryClient.invalidateQueries(['stock-movements']);
      queryClient.invalidateQueries(['items']);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to adjust stock');
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormInput
        label="Item"
        name="item_id"
        type="searchable-select"
        value={formData.item_id}
        onChange={handleChange}
        options={items.map(item => ({
          value: item.id,
          label: `${item.item_code} - ${item.item_name}`
        }))}
        placeholder="Search items..."
        required
      />

      <FormInput
        label="Warehouse"
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

      <div className="form-row">
        <FormInput
          label="Quantity"
          name="quantity"
          type="number"
          value={formData.quantity}
          onChange={handleChange}
          placeholder="Positive to add, Negative to remove"
          required
        />
        <FormInput
          label="Date"
          name="movement_date"
          type="date"
          value={formData.movement_date}
          onChange={handleChange}
          required
        />
      </div>

      <FormInput
        label="Remarks"
        name="remarks"
        type="textarea"
        value={formData.remarks}
        onChange={handleChange}
        placeholder="Reason for adjustment..."
        rows={2}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record Adjustment
        </Button>
      </div>
    </form>
  );
}
