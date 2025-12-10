import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';

export default function WarehousesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const queryClient = useQueryClient();

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
      return response.data;
    }
  });

  const columns = [
    { key: 'warehouse_code', label: 'Code', sortable: true },
    { key: 'warehouse_name', label: 'Name', sortable: true },
    { key: 'location', label: 'Location', sortable: false }
  ];

  const handleRowClick = (warehouse) => {
    setEditingWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingWarehouse(null);
    setIsModalOpen(true);
  };

  return (
    <div className="items-page">
      <div className="page-header">
        <div>
          <h1>Warehouses</h1>
          <p className="page-subtitle">Manage storage locations</p>
        </div>
        <Button variant="primary" onClick={handleNew}>
          + New Warehouse
        </Button>
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <DataTable columns={columns} data={warehouses} onRowClick={handleRowClick} />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWarehouse ? 'Edit Warehouse' : 'New Warehouse'}
        size="small"
      >
        <WarehouseForm
          warehouse={editingWarehouse}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['warehouses']);
            setIsModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function WarehouseForm({ warehouse, onClose, onSuccess }) {
  const isEdit = !!warehouse;
  const [formData, setFormData] = useState({
    warehouse_code: warehouse?.warehouse_code || '',
    warehouse_name: warehouse?.warehouse_name || '',
    location: warehouse?.location || ''
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        return api.put(`/inventory/warehouses/${warehouse.id}`, data);
      } else {
        return api.post('/inventory/warehouses', data);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Warehouse updated!' : 'Warehouse created!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to save warehouse');
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
        label="Warehouse Code"
        name="warehouse_code"
        value={formData.warehouse_code}
        onChange={handleChange}
        placeholder="e.g., WH-001"
        required
        disabled={isEdit}
      />
      <FormInput
        label="Warehouse Name"
        name="warehouse_name"
        value={formData.warehouse_name}
        onChange={handleChange}
        placeholder="e.g., Main Warehouse"
        required
      />
      <FormInput
        label="Location"
        name="location"
        value={formData.location}
        onChange={handleChange}
        placeholder="Physical location or address"
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {isEdit ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
