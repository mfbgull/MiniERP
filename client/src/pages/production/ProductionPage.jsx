import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../utils/api';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchableSelect from '../../components/common/SearchableSelect';
import './ProductionPage.css';

export default function ProductionPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: async () => {
      const response = await api.get('/productions');
      return response.data;
    }
  });

  const columns = [
    { key: 'production_no', label: 'Production #', sortable: true },
    { key: 'production_date', label: 'Date', sortable: true,
      render: (value) => format(new Date(value), 'dd MMM yyyy')
    },
    { key: 'output_item_name', label: 'Output Item', sortable: true },
    {
      key: 'output_quantity',
      label: 'Quantity Produced',
      sortable: true,
      render: (value, row) => (
        <span className="production-output">
          {parseFloat(value).toFixed(2)} {row.output_uom}
        </span>
      )
    },
    { key: 'warehouse_name', label: 'Warehouse', sortable: false },
    { key: 'remarks', label: 'Remarks', sortable: false,
      render: (value) => value || '—'
    }
  ];

  const handleRowClick = async (production) => {
    // Fetch full production details with inputs
    const response = await api.get(`/productions/${production.id}`);
    toast.success(
      <div>
        <strong>{response.data.production_no}</strong><br/>
        <small>Consumed: {response.data.inputs.map(i =>
          `${i.quantity} ${i.unit_of_measure} ${i.item_name}`
        ).join(', ')}</small>
      </div>,
      { duration: 5000 }
    );
  };

  const handleNew = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="production-page">
      <div className="page-header">
        <div>
          <h1>Production</h1>
          <p className="page-subtitle">Record manufacturing and track production output</p>
        </div>
        <Button variant="primary" onClick={handleNew}>
          + Record Production
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
              <div className="summary-label">Total Productions</div>
              <div className="summary-value">{productions.length}</div>
            </div>
          </div>
          <DataTable columns={columns} data={productions} onRowClick={handleRowClick} />
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Production"
        size="large"
      >
        <ProductionForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['productions']);
            queryClient.invalidateQueries(['items']);
            setIsModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function ProductionForm({ onClose, onSuccess }) {
  const [selectedBOMId, setSelectedBOMId] = useState('');
  const [formData, setFormData] = useState({
    output_item_id: '',
    output_quantity: '',
    warehouse_id: '',
    production_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [inputItems, setInputItems] = useState([
    { item_id: '', quantity: '' }
  ]);

  // Fetch BOMs
  const { data: boms = [] } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const response = await api.get('/boms');
      return response.data.filter(b => b.is_active);
    }
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

  // When BOM is selected, auto-populate form
  useEffect(() => {
    if (selectedBOMId) {
      const fetchBOMDetails = async () => {
        try {
          const response = await api.get(`/boms/${selectedBOMId}`);
          const bomDetails = response.data;

          // Auto-populate output item
          setFormData(prev => ({
            ...prev,
            output_item_id: bomDetails.finished_item_id
          }));

          // Auto-populate input items (scaled for quantity 1)
          setInputItems(bomDetails.items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
          })));

          toast.success(`BOM loaded: ${bomDetails.bom_no}`);
        } catch (error) {
          toast.error('Failed to load BOM details');
        }
      };

      fetchBOMDetails();
    }
  }, [selectedBOMId]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/productions', data);
    },
    onSuccess: () => {
      toast.success('Production recorded successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to record production');
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleInputItemChange = (index, field, value) => {
    const newInputItems = [...inputItems];
    newInputItems[index][field] = value;
    setInputItems(newInputItems);
  };

  const addInputItem = () => {
    setInputItems([...inputItems, { item_id: '', quantity: '' }]);
  };

  const removeInputItem = (index) => {
    if (inputItems.length > 1) {
      setInputItems(inputItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate input items
    const validInputItems = inputItems.filter(i => i.item_id && i.quantity > 0);

    if (validInputItems.length === 0) {
      toast.error('Please add at least one input item (raw material)');
      return;
    }

    // Convert to proper types
    const data = {
      output_item_id: parseInt(formData.output_item_id),
      output_quantity: parseFloat(formData.output_quantity),
      warehouse_id: parseInt(formData.warehouse_id),
      production_date: formData.production_date,
      bom_id: selectedBOMId ? parseInt(selectedBOMId) : null,
      remarks: formData.remarks || null,
      input_items: validInputItems.map(item => ({
        item_id: parseInt(item.item_id),
        quantity: parseFloat(item.quantity)
      }))
    };

    mutation.mutate(data);
  };

  // Handle quantity change - scale BOM materials if BOM is selected
  const handleQuantityChange = (e) => {
    const newQuantity = parseFloat(e.target.value) || 0;
    setFormData({ ...formData, output_quantity: e.target.value });

    // If BOM is selected, scale the input quantities
    if (selectedBOMId && newQuantity > 0) {
      const selectedBOM = boms.find(b => b.id === parseInt(selectedBOMId));
      if (selectedBOM) {
        // Fetch BOM details to get base quantities
        api.get(`/boms/${selectedBOMId}`).then(response => {
          const bomDetails = response.data;
          setInputItems(bomDetails.items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity * newQuantity
          })));
        });
      }
    }
  };

  // Get raw materials and finished goods
  const rawMaterials = items.filter(i => i.is_raw_material);
  const finishedGoods = items.filter(i => i.is_finished_good);

  return (
    <form onSubmit={handleSubmit} className="production-form">
      <div className="form-section">
        <h3>Output (Finished Product)</h3>

        <div className="form-row">
          <FormInput
            label="Output Item (Finished Good) *"
            name="output_item_id"
            type="searchable-select"
            value={formData.output_item_id}
            onChange={handleChange}
            options={finishedGoods.map(item => ({
              value: item.id,
              label: `${item.item_code} - ${item.item_name}`
            }))}
            placeholder="Search finished goods..."
            required
          />

          <FormInput
            label="Quantity to Produce *"
            name="output_quantity"
            type="number"
            step="0.001"
            value={formData.output_quantity}
            onChange={handleChange}
            placeholder="0.000"
            required
          />
        </div>

        <div className="form-row">
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

          <FormInput
            label="Production Date *"
            name="production_date"
            type="date"
            value={formData.production_date}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Input (Raw Materials Consumed)</h3>
          <Button type="button" variant="secondary" onClick={addInputItem} className="btn-small">
            + Add Raw Material
          </Button>
        </div>

        <div className="input-items-list">
          {inputItems.map((input, index) => {
            const selectedItem = items.find(i => i.id === parseInt(input.item_id));

            return (
              <div key={index} className="input-item-row">
                <div className="input-item-fields">
                  <FormInput
                    label={`Raw Material ${index + 1} *`}
                    name={`input_item_${index}`}
                    type="searchable-select"
                    value={input.item_id}
                    onChange={(e) => handleInputItemChange(index, 'item_id', e.target.value)}
                    options={rawMaterials.map(item => ({
                      value: item.id,
                      label: `${item.item_code} - ${item.item_name} (Stock: ${item.current_stock})`
                    }))}
                    placeholder="Search raw materials..."
                    required
                  />

                  <FormInput
                    label="Quantity to Consume *"
                    name={`input_quantity_${index}`}
                    type="number"
                    step="0.001"
                    value={input.quantity}
                    onChange={(e) => handleInputItemChange(index, 'quantity', e.target.value)}
                    placeholder="0.000"
                    required
                  />

                  {inputItems.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeInputItem(index)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {selectedItem && (
                  <div className="stock-info-inline">
                    Available: <strong>{selectedItem.current_stock} {selectedItem.unit_of_measure}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FormInput
        label="Remarks"
        name="remarks"
        type="textarea"
        value={formData.remarks}
        onChange={handleChange}
        placeholder="Notes about this production batch..."
        rows={2}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record Production
        </Button>
      </div>
    </form>
  );
}
