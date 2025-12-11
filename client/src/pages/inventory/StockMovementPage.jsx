import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
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

  const columnDefs = [
    {
      headerName: 'Movement No',
      field: 'movement_no',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Date',
      field: 'movement_date',
      sortable: true,
      filter: 'agDateColumnFilter',
      flex: 1,
      valueFormatter: params => format(new Date(params.value), 'dd MMM yyyy')
    },
    {
      headerName: 'Item Code',
      field: 'item_code',
      filter: true,
      flex: 1
    },
    {
      headerName: 'Item Name',
      field: 'item_name',
      filter: true,
      flex: 2
    },
    {
      headerName: 'Quantity',
      field: 'quantity',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1.5,
      cellRenderer: (params) => (
        <span className={params.value >= 0 ? 'qty-in' : 'qty-out'}>
          {params.value >= 0 ? '+' : ''}{parseFloat(params.value).toFixed(2)} {params.data.unit_of_measure}
        </span>
      )
    },
    {
      headerName: 'Warehouse',
      field: 'warehouse_name',
      filter: true,
      flex: 1.5
    },
    {
      headerName: 'Type',
      field: 'movement_type',
      sortable: true,
      filter: true,
      flex: 1,
      cellRenderer: (params) => (
        <span className="status-tag">{params.value}</span>
      )
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
        <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={movements}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: false,
              filter: false
            }}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
          />
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Stock Movement"
        size="large"
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
  const [movementType, setMovementType] = useState('ADJUSTMENT');
  const [formData, setFormData] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    movement_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [lineItems, setLineItems] = useState([
    { item_id: '', quantity: 0, available_stock: 0 }
  ]);

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

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock-balances'],
    queryFn: async () => {
      const response = await api.get('/inventory/stock-balances');
      return response.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (movements) => {
      // Submit each line item as a separate movement
      const promises = movements.map(movement =>
        api.post('/inventory/stock-movements', movement)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${lineItems.length} stock movement(s) recorded successfully!`);
      queryClient.invalidateQueries(['stock-movements']);
      queryClient.invalidateQueries(['items']);
      queryClient.invalidateQueries(['stock-balances']);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to adjust stock');
    }
  });

  const getItemStock = (itemId, warehouseId) => {
    if (!itemId || !warehouseId) {
      console.log('getItemStock: missing params', { itemId, warehouseId });
      return 0;
    }
    console.log('getItemStock: searching for', { itemId: parseInt(itemId), warehouseId: parseInt(warehouseId) });
    console.log('Available stock balances:', stockBalances.length);
    const stock = stockBalances.find(
      sb => sb.item_id === parseInt(itemId) && sb.warehouse_id === parseInt(warehouseId)
    );
    console.log('Found stock:', stock);
    return stock ? parseFloat(stock.quantity) : 0;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    // Update available stock when item or warehouse changes
    if (field === 'item_id') {
      const warehouseId = movementType === 'TRANSFER'
        ? formData.from_warehouse_id
        : formData.to_warehouse_id;
      updated[index].available_stock = getItemStock(value, warehouseId);
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { item_id: '', quantity: 0, available_stock: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate line items
    const validItems = lineItems.filter(item => item.item_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity');
      return;
    }

    // Create movements based on type
    const movements = [];

    if (movementType === 'TRANSFER') {
      // For transfers, create two movements per item (OUT from source, IN to destination)
      validItems.forEach(item => {
        // Negative movement from source warehouse
        movements.push({
          item_id: item.item_id,
          warehouse_id: formData.from_warehouse_id,
          quantity: -Math.abs(item.quantity),
          movement_type: 'TRANSFER',
          movement_date: formData.movement_date,
          remarks: formData.remarks || 'Stock transfer'
        });

        // Positive movement to destination warehouse
        movements.push({
          item_id: item.item_id,
          warehouse_id: formData.to_warehouse_id,
          quantity: Math.abs(item.quantity),
          movement_type: 'TRANSFER',
          movement_date: formData.movement_date,
          remarks: formData.remarks || 'Stock transfer'
        });
      });
    } else {
      // For adjustments, create one movement per item
      validItems.forEach(item => {
        movements.push({
          item_id: item.item_id,
          warehouse_id: formData.to_warehouse_id,
          quantity: item.quantity,
          movement_type: 'ADJUSTMENT',
          movement_date: formData.movement_date,
          remarks: formData.remarks || 'Stock adjustment'
        });
      });
    }

    mutation.mutate(movements);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <FormInput
          label="Movement Type"
          name="movement_type"
          type="select"
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          options={[
            { value: 'ADJUSTMENT', label: 'Stock Adjustment' },
            { value: 'TRANSFER', label: 'Stock Transfer' }
          ]}
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

      <div style={{ display: 'grid', gridTemplateColumns: movementType === 'TRANSFER' ? '1fr 1fr' : '1fr', gap: 'var(--space-md)' }}>
        {movementType === 'TRANSFER' ? (
          <>
            <FormInput
              label="From Warehouse"
              name="from_warehouse_id"
              type="searchable-select"
              value={formData.from_warehouse_id}
              onChange={(e) => {
                handleChange(e);
                const updated = lineItems.map(item => ({
                  ...item,
                  available_stock: getItemStock(item.item_id, e.target.value)
                }));
                setLineItems(updated);
              }}
              options={warehouses.map(wh => ({
                value: wh.id,
                label: `${wh.warehouse_code} - ${wh.warehouse_name}`
              }))}
              placeholder="Select source warehouse..."
              required
            />
            <FormInput
              label="To Warehouse"
              name="to_warehouse_id"
              type="searchable-select"
              value={formData.to_warehouse_id}
              onChange={handleChange}
              options={warehouses.filter(wh => wh.id !== parseInt(formData.from_warehouse_id)).map(wh => ({
                value: wh.id,
                label: `${wh.warehouse_code} - ${wh.warehouse_name}`
              }))}
              placeholder="Select destination warehouse..."
              required
            />
          </>
        ) : (
          <FormInput
            label="Warehouse"
            name="to_warehouse_id"
            type="searchable-select"
            value={formData.to_warehouse_id}
            onChange={(e) => {
              handleChange(e);
              const updated = lineItems.map(item => ({
                ...item,
                available_stock: getItemStock(item.item_id, e.target.value)
              }));
              setLineItems(updated);
            }}
            options={warehouses.map(wh => ({
              value: wh.id,
              label: `${wh.warehouse_code} - ${wh.warehouse_name}`
            }))}
            placeholder="Select warehouse..."
            required
          />
        )}
      </div>

      <div style={{ marginTop: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h4 style={{ margin: 0 }}>Items</h4>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={addLineItem}
          >
            + Add Row
          </Button>
        </div>

        <div className="ag-theme-quartz" style={{ height: 300, width: '100%' }}>
          <AgGridReact
            rowData={lineItems}
            columnDefs={[
              {
                headerName: '#',
                valueGetter: 'node.rowIndex + 1',
                width: 60,
                cellStyle: { color: 'var(--neutral-500)' }
              },
              {
                headerName: 'Item',
                field: 'item_id',
                flex: 2,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                  values: items.map(i => String(i.id))
                },
                valueFormatter: params => {
                  if (!params.value) return '';
                  const item = items.find(i => i.id === parseInt(params.value));
                  return item ? `${item.item_code} - ${item.item_name}` : '';
                },
                valueParser: params => params.newValue ? String(params.newValue) : '',
                onCellValueChanged: params => {
                  const warehouseId = movementType === 'TRANSFER'
                    ? formData.from_warehouse_id
                    : formData.to_warehouse_id;
                  params.data.available_stock = getItemStock(params.value, warehouseId);
                  params.api.refreshCells({ rowNodes: [params.node], force: true });
                }
              },
              {
                headerName: 'Available Stock',
                field: 'available_stock',
                flex: 1,
                valueGetter: params => {
                  if (!params.data.item_id) return null;
                  const warehouseId = movementType === 'TRANSFER'
                    ? formData.from_warehouse_id
                    : formData.to_warehouse_id;
                  if (!warehouseId) return null;
                  return getItemStock(params.data.item_id, warehouseId);
                },
                valueFormatter: params => {
                  if (!params.data.item_id || !(formData.from_warehouse_id || formData.to_warehouse_id)) return '-';
                  const item = items.find(i => i.id === parseInt(params.data.item_id));
                  const stockValue = params.value !== null ? params.value : 0;
                  return `${stockValue} ${item?.unit_of_measure || ''}`;
                },
                cellStyle: params => {
                  const stockValue = params.value !== null ? params.value : 0;
                  return {
                    color: stockValue > 0 ? 'var(--success)' : params.data.item_id ? 'var(--error)' : 'var(--neutral-400)'
                  };
                }
              },
              {
                headerName: 'Quantity',
                field: 'quantity',
                flex: 1,
                editable: true,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: {
                  precision: 2
                }
              },
              {
                headerName: '',
                width: 60,
                cellRenderer: (params) => (
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: lineItems.length === 1 ? 'var(--neutral-300)' : 'var(--error)',
                      cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      padding: '4px 8px'
                    }}
                    disabled={lineItems.length === 1}
                    title="Remove row"
                    onClick={() => removeLineItem(params.node.rowIndex)}
                  >
                    ×
                  </button>
                )
              }
            ]}
            defaultColDef={{
              sortable: false,
              resizable: true
            }}
            domLayout="autoHeight"
            suppressCellFocus={false}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
            onCellValueChanged={params => {
              const updatedItems = [...lineItems];
              updatedItems[params.node.rowIndex] = params.data;
              setLineItems(updatedItems);
            }}
          />
        </div>
      </div>

      <FormInput
        label="Remarks"
        name="remarks"
        type="textarea"
        value={formData.remarks}
        onChange={handleChange}
        placeholder="Reason for movement..."
        rows={2}
        style={{ marginTop: 'var(--space-md)' }}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record {movementType === 'TRANSFER' ? 'Transfer' : 'Adjustment'}
        </Button>
      </div>
    </form>
  );
}
