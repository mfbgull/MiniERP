import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import './PurchasesPage.css';

export default function PurchasesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const response = await api.get('/purchases');
      return response.data;
    }
  });

  const columnDefs = [
    {
      headerName: 'Purchase #',
      field: 'purchase_no',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Date',
      field: 'purchase_date',
      sortable: true,
      filter: 'agDateColumnFilter',
      flex: 1,
      valueFormatter: params => format(new Date(params.value), 'dd MMM yyyy')
    },
    {
      headerName: 'Item',
      field: 'item_name',
      sortable: true,
      filter: true,
      flex: 2
    },
    {
      headerName: 'Quantity',
      field: 'quantity',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      valueFormatter: params => `${parseFloat(params.value).toFixed(2)} ${params.data.unit_of_measure}`
    },
    {
      headerName: 'Unit Cost',
      field: 'unit_cost',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      valueFormatter: params => `$${parseFloat(params.value).toFixed(2)}`
    },
    {
      headerName: 'Total',
      field: 'total_cost',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      cellRenderer: (params) => (
        <strong>${parseFloat(params.value).toFixed(2)}</strong>
      )
    },
    {
      headerName: 'Supplier',
      field: 'supplier_name',
      sortable: true,
      filter: true,
      flex: 1.5,
      valueFormatter: params => params.value || '—'
    },
    {
      headerName: 'Warehouse',
      field: 'warehouse_name',
      filter: true,
      flex: 1.5
    }
  ];

  const handleNew = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="purchases-page">
      <div className="page-header">
        <div>
          <h1>Purchases</h1>
          <p className="page-subtitle">Record direct purchases and track costs</p>
        </div>
        <Button variant="primary" onClick={handleNew}>
          + Record Purchase
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
              <div className="summary-label">Total Purchases</div>
              <div className="summary-value">{purchases.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Value</div>
              <div className="summary-value">
                ${purchases.reduce((sum, p) => sum + parseFloat(p.total_cost), 0).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
            <AgGridReact
              rowData={purchases}
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
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Purchase"
        size="medium"
      >
        <PurchaseForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['items']);
            setIsModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function PurchaseForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item_id: '',
    warehouse_id: '',
    quantity: '',
    unit_cost: '',
    supplier_name: '',
    purchase_date: new Date().toISOString().split('T')[0],
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
      return api.post('/purchases', data);
    },
    onSuccess: () => {
      toast.success('Purchase recorded successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to record purchase');
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
      unit_cost: parseFloat(formData.unit_cost)
    };

    mutation.mutate(data);
  };

  const totalCost = formData.quantity && formData.unit_cost
    ? (parseFloat(formData.quantity) * parseFloat(formData.unit_cost)).toFixed(2)
    : '0.00';

  return (
    <form onSubmit={handleSubmit} className="purchase-form">
      <div className="form-row">
        <FormInput
          label="Item *"
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
          label="Unit Cost *"
          name="unit_cost"
          type="number"
          step="0.01"
          value={formData.unit_cost}
          onChange={handleChange}
          placeholder="0.00"
          required
        />
      </div>

      {formData.quantity && formData.unit_cost && (
        <div className="total-cost-display">
          <span>Total Cost:</span>
          <strong>${totalCost}</strong>
        </div>
      )}

      <div className="form-row">
        <FormInput
          label="Purchase Date *"
          name="purchase_date"
          type="date"
          value={formData.purchase_date}
          onChange={handleChange}
          required
        />

        <FormInput
          label="Supplier Name"
          name="supplier_name"
          value={formData.supplier_name}
          onChange={handleChange}
          placeholder="e.g., ABC Suppliers"
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
        placeholder="Additional notes about this purchase..."
        rows={3}
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record Purchase
        </Button>
      </div>
    </form>
  );
}
