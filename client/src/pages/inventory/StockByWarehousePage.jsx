import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';

export default function StockByWarehousePage() {
  const { data: stockBalances = [], isLoading } = useQuery({
    queryKey: ['stock-balances'],
    queryFn: async () => {
      const response = await api.get('/inventory/stock-balances');
      // Filter out items with zero or negative quantity
      return response.data.filter(item => item.quantity > 0);
    }
  });

  const columnDefs = [
    {
      headerName: 'Item Code',
      field: 'item_code',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Item Name',
      field: 'item_name',
      sortable: true,
      filter: true,
      flex: 2
    },
    {
      headerName: 'Warehouse Code',
      field: 'warehouse_code',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      headerName: 'Warehouse Name',
      field: 'warehouse_name',
      sortable: true,
      filter: true,
      flex: 1.5
    },
    {
      headerName: 'Quantity',
      field: 'quantity',
      sortable: true,
      filter: 'agNumberColumnFilter',
      flex: 1,
      valueFormatter: params => `${parseFloat(params.value).toFixed(2)} ${params.data.unit_of_measure}`,
      cellStyle: params => ({
        fontWeight: 'bold',
        color: params.value > 0 ? 'var(--success)' : 'var(--neutral-400)'
      })
    }
  ];

  return (
    <div className="items-page">
      <div className="page-header">
        <div>
          <h1>Stock by Warehouse</h1>
          <p className="page-subtitle">View current stock levels for each item by warehouse</p>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={stockBalances}
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
    </div>
  );
}
