import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import './ItemsPage.css';

export default function ItemsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Fetch items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', searchTerm],
    queryFn: async () => {
      const response = await api.get('/inventory/items', {
        params: { search: searchTerm }
      });
      return response.data;
    }
  });

  const columns = [
    { key: 'item_code', label: 'Item Code', sortable: true },
    { key: 'item_name', label: 'Item Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'unit_of_measure', label: 'UOM', sortable: false },
    {
      key: 'current_stock',
      label: 'Stock',
      sortable: true,
      render: (value, row) => (
        <span className={value <= row.reorder_level && row.reorder_level > 0 ? 'low-stock' : ''}>
          {parseFloat(value).toFixed(2)}
        </span>
      )
    },
    {
      key: 'standard_cost',
      label: 'Cost',
      sortable: true,
      render: (value) => `$${parseFloat(value).toFixed(2)}`
    },
    {
      key: 'standard_selling_price',
      label: 'Price',
      sortable: true,
      render: (value) => `$${parseFloat(value).toFixed(2)}`
    }
  ];

  const handleRowClick = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleNewItem = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="items-page">
      <div className="page-header">
        <div>
          <h1>Items</h1>
          <p className="page-subtitle">Manage your product catalog and inventory items</p>
        </div>
        <Button variant="primary" onClick={handleNewItem}>
          + New Item
        </Button>
      </div>

      <div className="page-filters">
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          onRowClick={handleRowClick}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? 'Edit Item' : 'New Item'}
        size="medium"
      >
        <ItemForm
          item={editingItem}
          onClose={handleCloseModal}
          onSuccess={() => {
            queryClient.invalidateQueries(['items']);
            handleCloseModal();
          }}
        />
      </Modal>
    </div>
  );
}

// Item Form Component
function ItemForm({ item, onClose, onSuccess }) {
  const isEdit = !!item;
  const [formData, setFormData] = useState({
    item_code: item?.item_code || '',
    item_name: item?.item_name || '',
    description: item?.description || '',
    category: item?.category || '',
    unit_of_measure: item?.unit_of_measure || 'Nos',
    reorder_level: item?.reorder_level || 0,
    standard_cost: item?.standard_cost || 0,
    standard_selling_price: item?.standard_selling_price || 0,
    is_raw_material: item?.is_raw_material || false,
    is_finished_good: item?.is_finished_good || false,
    is_purchased: item?.is_purchased !== undefined ? item.is_purchased : true,
    is_manufactured: item?.is_manufactured || false
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        return api.put(`/inventory/items/${item.id}`, data);
      } else {
        return api.post('/inventory/items', data);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Item updated!' : 'Item created!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to save item');
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="item-form">
      <div className="form-row">
        <FormInput
          label="Item Code"
          name="item_code"
          value={formData.item_code}
          onChange={handleChange}
          placeholder="e.g., ITEM-001"
          required
          disabled={isEdit}
        />
        <FormInput
          label="Item Name"
          name="item_name"
          value={formData.item_name}
          onChange={handleChange}
          placeholder="e.g., Mustard Seeds"
          required
        />
      </div>

      <FormInput
        label="Description"
        name="description"
        type="textarea"
        value={formData.description}
        onChange={handleChange}
        placeholder="Item description..."
        rows={2}
      />

      <div className="form-row">
        <FormInput
          label="Category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="e.g., Raw Materials"
        />
        <FormInput
          label="Unit of Measure"
          name="unit_of_measure"
          type="searchable-select"
          value={formData.unit_of_measure}
          onChange={handleChange}
          required
          options={[
            { value: 'Nos', label: 'Nos (Pieces)' },
            { value: 'Kg', label: 'Kg (Kilogram)' },
            { value: 'Ltr', label: 'Ltr (Liter)' },
            { value: 'Box', label: 'Box' },
            { value: 'Pack', label: 'Pack' },
            { value: 'Bottle', label: 'Bottle' }
          ]}
          placeholder="Search UOM..."
        />
      </div>

      <div className="form-row">
        <FormInput
          label="Standard Cost"
          name="standard_cost"
          type="number"
          value={formData.standard_cost}
          onChange={handleChange}
          placeholder="0.00"
        />
        <FormInput
          label="Selling Price"
          name="standard_selling_price"
          type="number"
          value={formData.standard_selling_price}
          onChange={handleChange}
          placeholder="0.00"
        />
        <FormInput
          label="Reorder Level"
          name="reorder_level"
          type="number"
          value={formData.reorder_level}
          onChange={handleChange}
          placeholder="0"
        />
      </div>

      <div className="form-section">
        <h4>Item Type</h4>
        <div className="checkbox-group">
          <FormInput
            label=""
            name="is_raw_material"
            type="checkbox"
            value={formData.is_raw_material}
            onChange={handleChange}
            placeholder="Raw Material"
          />
          <FormInput
            label=""
            name="is_finished_good"
            type="checkbox"
            value={formData.is_finished_good}
            onChange={handleChange}
            placeholder="Finished Good"
          />
          <FormInput
            label=""
            name="is_purchased"
            type="checkbox"
            value={formData.is_purchased}
            onChange={handleChange}
            placeholder="Purchased Item"
          />
          <FormInput
            label=""
            name="is_manufactured"
            type="checkbox"
            value={formData.is_manufactured}
            onChange={handleChange}
            placeholder="Manufactured Item"
          />
        </div>
      </div>

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {isEdit ? 'Update Item' : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
