import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchableSelect from '../../components/common/SearchableSelect';
import './BOMPage.css';

export default function BOMPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const queryClient = useQueryClient();

  const deleteBomMutation = useMutation({
    mutationFn: async (bomId) => {
      return api.delete(`/boms/${bomId}`);
    },
    onSuccess: () => {
      toast.success('BOM deleted successfully!');
      queryClient.invalidateQueries(['boms']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete BOM');
    }
  });

  const toggleBomStatusMutation = useMutation({
    mutationFn: async (bomId) => {
      return api.patch(`/boms/${bomId}/toggle-active`);
    },
    onSuccess: (updatedBom) => {
      const message = updatedBom.is_active ?
        'BOM activated successfully!' :
        'BOM deactivated successfully!';
      toast.success(message);
      queryClient.invalidateQueries(['boms']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update BOM status');
    }
  });

  const [editingBOM, setEditingBOM] = useState(null);

  const columnDefs = [
    {
      headerName: 'BOM #',
      field: 'bom_no',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'BOM Name',
      field: 'bom_name',
      sortable: true,
      filter: true,
      flex: 2
    },
    {
      headerName: 'Finished Item',
      field: 'finished_item_name',
      sortable: true,
      filter: true,
      flex: 2
    },
    {
      headerName: 'Output Qty',
      field: 'quantity',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      valueFormatter: params => `${params.value} ${params.data.finished_uom}`
    },
    {
      headerName: 'Raw Materials',
      field: 'item_count',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      valueFormatter: params => `${params.value} items`
    },
    {
      headerName: 'Status',
      field: 'is_active',
      sortable: true,
      filter: true,
      flex: 1,
      cellRenderer: (params) => (
        <span className={`status-badge ${params.value ? 'active' : 'inactive'}`}>
          {params.value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 2,
      cellRenderer: (params) => (
        <div className="table-actions">
          <Button
            variant={params.data.is_active ? "warning" : "secondary"}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleBomStatus(params.data);
            }}
            disabled={toggleBomStatusMutation.isPending}
          >
            {params.data.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setEditingBOM(params.data);
              setIsModalOpen(true);
            }}
            disabled={deleteBomMutation.isPending}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteBom(params.data);
            }}
            disabled={deleteBomMutation.isPending}
          >
            {deleteBomMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      )
    }
  ];

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const response = await api.get('/boms');
      return response.data;
    }
  });

  const handleDeleteBom = (bom) => {
    if (window.confirm(`Are you sure you want to delete BOM: ${bom.bom_name}?`)) {
      deleteBomMutation.mutate(bom.id);
    }
  };

  const handleToggleBomStatus = (bom) => {
    const action = bom.is_active ? 'deactivate' : 'activate';
    if (window.confirm(`Are you sure you want to ${action} BOM: ${bom.bom_name}?`)) {
      toggleBomStatusMutation.mutate(bom.id);
    }
  };

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

          <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
            <AgGridReact
              rowData={boms}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: false,
                filter: false
              }}
              pagination={true}
              paginationPageSize={20}
              paginationPageSizeSelector={[10, 20, 50, 100]}
              onRowClicked={(params) => handleRowClick(params.data)}
              rowSelection={{ mode: 'singleRow' }}
            />
          </div>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBOM(null);
        }}
        title={editingBOM ? "Edit Bill of Materials" : "Create Bill of Materials"}
        size="large"
      >
        <BOMForm
          bom={editingBOM}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBOM(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['boms']);
            setIsModalOpen(false);
            setEditingBOM(null);
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

function BOMForm({ bom, onClose, onSuccess }) {
  const isEdit = !!bom;

  const [formData, setFormData] = useState({
    bom_name: bom?.bom_name || '',
    finished_item_id: bom?.finished_item_id || '',
    quantity: bom?.quantity || 1,
    description: bom?.description || ''
  });

  const [bomItems, setBomItems] = useState(
    bom?.items?.map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      id: item.id // Keep the original item ID if editing
    })) || [{ item_id: '', quantity: '' }]
  );

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
      if (isEdit && bom?.id) {
        return api.put(`/boms/${bom.id}`, data);
      } else {
        return api.post('/boms', data);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'BOM updated successfully!' : 'BOM created successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || (isEdit ? 'Failed to update BOM' : 'Failed to create BOM'));
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
          {isEdit ? 'Update BOM' : 'Create BOM'}
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
