import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchableSelect from '../../components/common/SearchableSelect';
import './BOMPage.css';

export default function BOMPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const queryClient = useQueryClient();

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const response = await api.get('/boms');
      return response.data;
    }
  });

  const columns = [
    { key: 'bom_no', label: 'BOM #', sortable: true },
    { key: 'bom_name', label: 'BOM Name', sortable: true },
    { key: 'finished_item_name', label: 'Finished Item', sortable: true },
    {
      key: 'quantity',
      label: 'Output Qty',
      sortable: true,
      render: (value, row) => `${value} ${row.finished_uom}`
    },
    {
      key: 'item_count',
      label: 'Raw Materials',
      sortable: true,
      render: (value) => `${value} items`
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span className={`status-badge ${value ? 'active' : 'inactive'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ];

  const handleRowClick = async (bom) => {
    try {
      const response = await api.get(`/boms/${bom.id}`);
      setSelectedBOM(response.data);

      toast.success(
        <div>
          <strong>{response.data.bom_no}</strong><br/>
          <small>Materials: {response.data.items.map(i =>
            `${i.quantity} ${i.unit_of_measure} ${i.item_name}`
          ).join(', ')}</small>
        </div>,
        { duration: 5000 }
      );
    } catch (error) {
      toast.error('Failed to load BOM details');
    }
  };

  const handleNew = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="bom-page">
      <div className="page-header">
        <div>
          <h1>Bill of Materials (BOM)</h1>
          <p className="page-subtitle">Pre-configure production recipes for finished goods</p>
        </div>
        <Button variant="primary" onClick={handleNew}>
          + Create BOM
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
              <div className="summary-label">Total BOMs</div>
              <div className="summary-value">{boms.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Active BOMs</div>
              <div className="summary-value">
                {boms.filter(b => b.is_active).length}
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={boms}
            onRowClick={handleRowClick}
          />
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Bill of Materials"
        size="large"
      >
        <BOMForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['boms']);
            setIsModalOpen(false);
          }}
        />
      </Modal>

      {selectedBOM && (
        <Modal
          isOpen={!!selectedBOM}
          onClose={() => setSelectedBOM(null)}
          title={`BOM Details: ${selectedBOM.bom_no}`}
          size="medium"
        >
          <BOMDetails bom={selectedBOM} />
        </Modal>
      )}
    </div>
  );
}

function BOMForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    bom_name: '',
    finished_item_id: '',
    quantity: 1,
    description: ''
  });

  const [bomItems, setBomItems] = useState([
    { item_id: '', quantity: '' }
  ]);

  // Fetch items - MUST be called before any conditional returns
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get('/inventory/items');
      return response.data;
    }
  });

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const mutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/boms', data);
    },
    onSuccess: () => {
      toast.success('BOM created successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create BOM');
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBOMItemChange = (index, field, value) => {
    const newBOMItems = [...bomItems];
    newBOMItems[index][field] = value;
    setBomItems(newBOMItems);
  };

  const addBOMItem = () => {
    setBomItems([...bomItems, { item_id: '', quantity: '' }]);
  };

  const removeBOMItem = (index) => {
    if (bomItems.length > 1) {
      setBomItems(bomItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate BOM items
    const validBOMItems = bomItems.filter(i => i.item_id && i.quantity > 0);

    if (validBOMItems.length === 0) {
      toast.error('Please add at least one raw material');
      return;
    }

    // Convert to proper types
    const data = {
      bom_name: formData.bom_name,
      finished_item_id: parseInt(formData.finished_item_id),
      quantity: parseFloat(formData.quantity),
      description: formData.description || null,
      items: validBOMItems.map(item => ({
        item_id: parseInt(item.item_id),
        quantity: parseFloat(item.quantity)
      }))
    };

    mutation.mutate(data);
  };

  // Get raw materials and finished goods AFTER all hooks
  const rawMaterials = items.filter(i => i.is_raw_material || i.category === 'Packaging Material');
  const finishedGoods = items.filter(i => i.is_finished_good);

  // Debug logging
  console.log('BOMForm - Items loaded:', items.length);
  console.log('BOMForm - Raw materials:', rawMaterials.length);
  console.log('BOMForm - Finished goods:', finishedGoods.length);
  console.log('BOMForm - Items:', items);

  // Show loading state AFTER all hooks
  if (itemsLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading items...</p>
      </div>
    );
  }

  // Show message if no items
  if (items.length === 0) {
    return (
      <div className="loading">
        <p>No items found. Please create items first.</p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bom-form">
      <div className="form-section">
        <h3>Output (Finished Product)</h3>

        <FormInput
          label="BOM Name *"
          name="bom_name"
          type="text"
          value={formData.bom_name}
          onChange={handleChange}
          placeholder="e.g., Bottled Mustard Oil (1 Ltr) - Standard Recipe"
          required
        />

        <div className="form-row">
          <SearchableSelect
            label="Finished Item *"
            name="finished_item_id"
            value={formData.finished_item_id}
            onChange={handleChange}
            placeholder="Select Finished Good"
            required
            options={finishedGoods.map(item => ({
              value: item.id,
              label: `${item.item_code} - ${item.item_name}`,
              subtitle: `Stock: ${item.current_stock} ${item.unit_of_measure}`
            }))}
          />

          <FormInput
            label="Output Quantity *"
            name="quantity"
            type="number"
            step="0.001"
            value={formData.quantity}
            onChange={handleChange}
            placeholder="1.000"
            required
          />
        </div>

        <FormInput
          label="Description"
          name="description"
          type="textarea"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe the production process..."
          rows={2}
        />
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Input (Raw Materials Required)</h3>
          <Button type="button" variant="secondary" onClick={addBOMItem} className="btn-small">
            + Add Raw Material
          </Button>
        </div>

        <div className="bom-items-list">
          {bomItems.map((bomItem, index) => {
            const selectedItem = items.find(i => i.id === parseInt(bomItem.item_id));

            return (
              <div key={index} className="bom-item-row">
                <div className="bom-item-fields">
                  <SearchableSelect
                    label={`Raw Material ${index + 1} *`}
                    name={`bom_item_${index}`}
                    value={bomItem.item_id}
                    onChange={(e) => handleBOMItemChange(index, 'item_id', e.target.value)}
                    placeholder="Select Raw Material"
                    required
                    options={rawMaterials.map(item => ({
                      value: item.id,
                      label: `${item.item_code} - ${item.item_name}`,
                      subtitle: `Stock: ${item.current_stock} ${item.unit_of_measure}`
                    }))}
                  />

                  <FormInput
                    label="Quantity Required *"
                    name={`bom_quantity_${index}`}
                    type="number"
                    step="0.001"
                    value={bomItem.quantity}
                    onChange={(e) => handleBOMItemChange(index, 'quantity', e.target.value)}
                    placeholder="0.000"
                    required
                  />

                  {bomItems.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeBOMItem(index)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {selectedItem && (
                  <div className="stock-info-inline">
                    {selectedItem.item_name} - {selectedItem.unit_of_measure}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Create BOM
        </Button>
      </div>
    </form>
  );
}

function BOMDetails({ bom }) {
  return (
    <div className="bom-details">
      <div className="detail-section">
        <h3>Output</h3>
        <div className="detail-item">
          <span className="label">Finished Item:</span>
          <span className="value">{bom.finished_item_name}</span>
        </div>
        <div className="detail-item">
          <span className="label">Quantity:</span>
          <span className="value">{bom.quantity} {bom.finished_uom}</span>
        </div>
        {bom.description && (
          <div className="detail-item">
            <span className="label">Description:</span>
            <span className="value">{bom.description}</span>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3>Raw Materials Required</h3>
        <table className="materials-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Current Stock</th>
            </tr>
          </thead>
          <tbody>
            {bom.items.map((item, index) => (
              <tr key={index}>
                <td>{item.item_name}</td>
                <td>{item.quantity} {item.unit_of_measure}</td>
                <td className={item.current_stock < item.quantity ? 'low-stock' : ''}>
                  {item.current_stock} {item.unit_of_measure}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
