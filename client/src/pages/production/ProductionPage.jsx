import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchableSelect from '../../components/common/SearchableSelect';
import './ProductionPage.css';

export default function ProductionPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteProductionMutation = useMutation({
    mutationFn: async (productionId) => {
      return api.delete(`/productions/${productionId}`);
    },
    onSuccess: () => {
      toast.success('Production record deleted successfully!');
      queryClient.invalidateQueries(['productions']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete production record');
    }
  });

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: async () => {
      const response = await api.get('/productions');
      return response.data;
    }
  });

  const handleDeleteProduction = (production) => {
    if (window.confirm(`Are you sure you want to delete production: ${production.production_no}?`)) {
      deleteProductionMutation.mutate(production.id);
    }
  };

  const columnDefs = [
    {
      headerName: 'Production #',
      field: 'production_no',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Date',
      field: 'production_date',
      sortable: true,
      filter: 'agDateColumnFilter',
      flex: 1,
      valueFormatter: params => format(new Date(params.value), 'dd MMM yyyy')
    },
    {
      headerName: 'Output Item',
      field: 'output_item_name',
      sortable: true,
      filter: true,
      flex: 2
    },
    {
      headerName: 'Quantity Produced',
      field: 'output_quantity',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1.5,
      cellRenderer: (params) => (
        <span className="production-output">
          {parseFloat(params.value).toFixed(2)} {params.data.output_uom}
        </span>
      )
    },
    {
      headerName: 'Warehouse',
      field: 'finished_goods_warehouse_name',
      filter: true,
      flex: 1.5
    },
    {
      headerName: 'Remarks',
      field: 'remarks',
      filter: true,
      flex: 1.5,
      valueFormatter: params => params.value || '—'
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 1,
      cellRenderer: (params) => (
        <div className="table-actions">
          <Button
            variant="danger"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteProduction(params.data);
            }}
            disabled={deleteProductionMutation.isPending}
          >
            {deleteProductionMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      )
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
          <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
            <AgGridReact
              rowData={productions}
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
    warehouse_id: '', // Finished goods warehouse
    raw_materials_warehouse_id: '', // Raw materials warehouse
    production_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [calculatedInputItems, setCalculatedInputItems] = useState([]);

  // Fetch BOMs
  const { data: boms = [], isLoading: isLoadingBoms } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const response = await api.get('/boms');
      return response.data.filter(b => b.is_active);
    }
  });

  // Fetch items
  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get('/inventory/items');
      return response.data;
    }
  });

  // Fetch warehouses
  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
      return response.data;
    }
  });

  // When a finished good is selected, check for existing BOMs
  useEffect(() => {
    if (formData.output_item_id) {
      const associatedBOMs = boms.filter(bom => bom.finished_item_id === parseInt(formData.output_item_id));

      if (associatedBOMs.length > 0) {
        // Auto-select the first BOM if available
        const firstBOM = associatedBOMs[0];
        setSelectedBOMId(firstBOM.id.toString());
      } else {
        // No BOM found for this product
        const message = (
          <div>
            <strong>No BOM found for this product.</strong>
            <div>Please create a BOM first in the BOM module.</div>
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => window.location.href = '/bom'}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px'
                }}
              >
                Go to BOM
              </button>
              <small style={{ color: '#6c757d' }}>
                (You can return to complete the production after creating the BOM)
              </small>
            </div>
          </div>
        );

        toast.error(message, {
          duration: 10000,
          style: { background: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7', maxWidth: '400px' }
        });
      }
    } else {
      // Reset BOM if no output item is selected
      setSelectedBOMId('');
      setCalculatedInputItems([]);
    }
  }, [formData.output_item_id, boms]);

  // When BOM is selected, get BOM details to auto-populate output item and calculate materials
  useEffect(() => {
    if (selectedBOMId) {
      const fetchBOMDetails = async () => {
        try {
          const response = await api.get(`/boms/${selectedBOMId}`);
          const bomDetails = response.data;

          // Auto-populate output item if not already set
          if (!formData.output_item_id) {
            setFormData(prev => ({
              ...prev,
              output_item_id: bomDetails.finished_item_id
            }));
          }
        } catch (error) {
          toast.error('Failed to load BOM details');
        }
      };

      fetchBOMDetails();
    }
  }, [selectedBOMId, formData.output_item_id]);

  // When BOM is selected or quantity changes, calculate materials
  useEffect(() => {
    if (selectedBOMId && formData.output_quantity) {
      const fetchBOMDetails = async () => {
        try {
          const response = await api.get(`/boms/${selectedBOMId}`);
          const bomDetails = response.data;

          // Calculate required quantities based on production quantity
          const quantity = parseFloat(formData.output_quantity) || 0;
          const calculatedItems = bomDetails.items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity * quantity // Scale by production quantity
          }));

          setCalculatedInputItems(calculatedItems);

          // Only show toast when we have a valid quantity (not just when BOM is selected)
          if (quantity > 0) {
            toast.success(`Calculated materials for ${quantity} units of ${bomDetails.finished_item_name}`);
          }
        } catch (error) {
          toast.error('Failed to load BOM details for calculation');
          setCalculatedInputItems([]);
        }
      };

      fetchBOMDetails();
    } else {
      // Clear calculated items if no BOM or no quantity
      setCalculatedInputItems([]);
    }
  }, [selectedBOMId, formData.output_quantity]);

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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate stock availability before submitting with warehouse-specific stock check
  const validateStockBeforeSubmission = async (data) => {
    try {
      // Fetch stock balances for the specific warehouse where production will happen
      const stockBalancesResponse = await api.get('/inventory/stock-movements');
      // Actually, let's fetch stock balances more specifically
      // For now, we'll fetch all items but also get warehouse-specific stock if possible

      // Get fresh items data
      const itemsResponse = await api.get('/inventory/items');
      const freshItems = itemsResponse.data;

      // Since we don't have a direct endpoint for warehouse-specific stock,
      // we need to make an API call that validates warehouse-specific stock
      // The best approach is to let the backend do the validation since it has the correct logic

      // For now, let's try to get stock data by warehouse by using stock movements
      // We'll fetch stock balances which should have warehouse-specific data
      const balancesResponse = await api.get('/inventory/stock-movements');

      // However, to properly validate by warehouse, we need to check against the specific warehouse
      // Since the backend already has the correct validation, let's implement a more direct approach
      // We'll call the production API with a simulation to see if it would pass validation

      const insufficientMaterials = [];

      // For now, continue with the warehouse-specific validation approach
      // by checking stock balances for the specific warehouse
      for (const inputItem of data.input_items) {
        // The backend validation happens at the warehouse level
        // So we need to get stock balance for this item in the production warehouse
        // Since we don't have a direct warehouse-balance endpoint, let's validate differently

        // Get the specific item details with warehouse stock
        const itemBalanceResponse = await api.get(`/inventory/items/${inputItem.item_id}`);
        const itemDetails = itemBalanceResponse.data;

        // If itemDetails has warehouse-specific info, check against the production warehouse
        // Otherwise, fall back to the total current_stock
        let availableStock = itemDetails.current_stock || 0;

        // If itemDetails has warehouse balances, check the specific raw materials warehouse
        if (itemDetails.warehouse_balances) {
          // Use raw materials warehouse if specified, otherwise use finished goods warehouse
          const materialsWarehouseId = data.raw_materials_warehouse_id || data.warehouse_id;
          const warehouseBalance = itemDetails.warehouse_balances.find(
            balance => balance.warehouse_id === materialsWarehouseId
          );
          availableStock = warehouseBalance ? warehouseBalance.quantity : 0;
        }

        if (availableStock < inputItem.quantity) {
          const item = freshItems.find(i => i.id === inputItem.item_id);
          if (item) {
            insufficientMaterials.push({
              name: item.item_name,
              available: availableStock,
              required: inputItem.quantity,
              uom: item.unit_of_measure
            });
          }
        }
      }

      return insufficientMaterials;
    } catch (error) {
      console.error('Error fetching warehouse-specific stock data for validation:', error);
      // Fallback: Use the original validation method
      const itemsResponse = await api.get('/inventory/items');
      const freshItems = itemsResponse.data;

      const insufficientMaterials = [];
      for (const inputItem of data.input_items) {
        const item = freshItems.find(i => i.id === inputItem.item_id);
        if (item && item.current_stock < inputItem.quantity) {
          insufficientMaterials.push({
            name: item.item_name,
            available: item.current_stock,
            required: inputItem.quantity,
            uom: item.unit_of_measure
          });
        }
      }
      return insufficientMaterials;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Use calculated input items when BOM is selected
    let inputItemsToUse = [];
    if (selectedBOMId) {
      inputItemsToUse = calculatedInputItems;
    } else {
      toast.error('Please select a product with a BOM to proceed with production.');
      return;
    }

    // Validate input items
    const validInputItems = inputItemsToUse.filter(i => i.item_id && i.quantity > 0);

    if (validInputItems.length === 0) {
      toast.error('No materials calculated from BOM. Please check the BOM configuration.');
      return;
    }

    // Convert to proper types
    const data = {
      output_item_id: parseInt(formData.output_item_id),
      output_quantity: parseFloat(formData.output_quantity),
      warehouse_id: parseInt(formData.warehouse_id),
      raw_materials_warehouse_id: formData.raw_materials_warehouse_id ? parseInt(formData.raw_materials_warehouse_id) : null,
      production_date: formData.production_date,
      bom_id: selectedBOMId ? parseInt(selectedBOMId) : null,
      remarks: formData.remarks || null,
      input_items: validInputItems.map(item => ({
        item_id: parseInt(item.item_id),
        quantity: parseFloat(item.quantity)
      }))
    };

    // Validate stock availability if using BOM
    if (selectedBOMId) {
      const insufficientMaterials = await validateStockBeforeSubmission(data);

      if (insufficientMaterials.length > 0) {
        const message = (
          <div>
            <strong>Insufficient stock for the following materials:</strong>
            <ul style={{ textAlign: 'left', marginTop: '8px' }}>
              {insufficientMaterials.map((mat, idx) => (
                <li key={idx}>
                  <strong>{mat.name}</strong>: Available {mat.available} {mat.uom}, Required {mat.required} {mat.uom}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '8px' }}>Please adjust quantities or increase stock before production.</div>
          </div>
        );

        toast.error(message, { duration: 10000 });
        return;
      }
    }

    mutation.mutate(data);
  };

  // Get raw materials and finished goods
  const rawMaterials = items.filter(i => i.is_raw_material);
  const finishedGoods = items.filter(i => i.is_finished_good);

  // Get selected output item for display
  const selectedOutputItem = items.find(i => i.id === parseInt(formData.output_item_id));

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
            tooltip="Select the finished product to be produced. Associated BOM will be automatically loaded if available."
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
            tooltip="Enter the total quantity of finished goods to be produced. Raw material quantities will be calculated automatically based on BOM."
          />
        </div>

        <div className="form-row">
          <FormInput
            label="Raw Materials Warehouse *"
            name="raw_materials_warehouse_id"
            type="searchable-select"
            value={formData.raw_materials_warehouse_id}
            onChange={handleChange}
            options={warehouses.map(wh => ({
              value: wh.id,
              label: `${wh.warehouse_code} - ${wh.warehouse_name}`
            }))}
            placeholder="Select warehouse for raw materials..."
            required
            tooltip="Select warehouse where raw materials will be consumed from. Production will check stock availability in this warehouse."
          />

          <FormInput
            label="Finished Goods Warehouse *"
            name="warehouse_id"
            type="searchable-select"
            value={formData.warehouse_id}
            onChange={handleChange}
            options={warehouses.map(wh => ({
              value: wh.id,
              label: `${wh.warehouse_code} - ${wh.warehouse_name}`
            }))}
            placeholder="Select warehouse for finished goods..."
            required
            tooltip="Select warehouse where finished goods will be stored after production is complete."
          />
        </div>

        <div className="form-row">
          <FormInput
            label="Production Date *"
            name="production_date"
            type="date"
            value={formData.production_date}
            onChange={handleChange}
            required
            tooltip="Date when the production will be recorded and stock levels will be updated."
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Input (Raw Materials Consumed)</h3>
        </div>

        {selectedBOMId ? (
          <div className="calculated-materials-summary">
            <div className="materials-header">
              <p>Based on BOM and production quantity of <strong>{formData.output_quantity}</strong> units:</p>
              {formData.raw_materials_warehouse_id && (
                <p className="warehouse-note">
                  Stock checked from warehouse:
                  {warehouses.find(w => w.id === parseInt(formData.raw_materials_warehouse_id))?.warehouse_name || 'N/A'}
                </p>
              )}
            </div>
            {calculatedInputItems.length > 0 ? (
              <ul className="materials-list">
                {calculatedInputItems.map((input, index) => {
                  const item = items.find(i => i.id === parseInt(input.item_id));
                  if (!item) return null;

                  const stockAvailable = item.current_stock || 0;
                  const isSufficient = stockAvailable >= input.quantity;

                  return (
                    <li key={index} className={`material-item ${isSufficient ? 'sufficient' : 'insufficient'}`}>
                      <div className="material-info">
                        <div className="material-name-quantity">
                          <span className="material-name">{item.item_code} - {item.item_name}</span>
                          <span className="material-quantity">
                            {parseFloat(input.quantity).toFixed(3)} {item.unit_of_measure}
                          </span>
                        </div>
                        <div className="material-stock-info">
                          <span className={isSufficient ? 'stock-sufficient' : 'stock-insufficient'}>
                            Stock: {stockAvailable} {item.unit_of_measure}
                          </span>
                          {!isSufficient && (
                            <span className="insufficient-warning">
                              ⚠ Insufficient stock
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="no-materials">No materials calculated yet. Enter a production quantity.</p>
            )}
          </div>
        ) : (
          <p className="no-bom-message">
            Please select a finished good that has a BOM defined, or create a BOM first.
          </p>
        )}
      </div>

      <FormInput
        label="Remarks"
        name="remarks"
        type="textarea"
        value={formData.remarks}
        onChange={handleChange}
        placeholder="Notes about this production batch..."
        rows={2}
        tooltip="Optional notes about this specific production run, such as batch number, operator notes, or special instructions."
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
