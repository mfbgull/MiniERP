import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer, Download, Send, Plus, Trash2, Hash, Edit2, DollarSign, CreditCard } from 'lucide-react';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import FormInput from '../../components/common/FormInput';
import './SalesInvoicePage.css';

export default function SalesInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState({
    invoice_no: '',
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    customer_current_balance: 0,
    customer_credit_limit: 0,
    customer_credit_utilization: 0,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Unpaid',
    discountScope: 'item',
    discount: {
      type: 'flat',
      value: 0
    },
    total_amount: 0,
    items: [
      {
        id: Date.now(),
        item_id: '',
        description: '',
        quantity: 1,
        rate: 0,
        tax: 0,
        discount: { type: 'flat', value: 0 }
      }
    ],
    notes: 'Thank you for your business. Payment is due within 14 days.',
    terms: 'Net 14 days. Late payments subject to 1.5% monthly interest.',
    created_by: null,
    company: {
      name: 'Mini ERP',
      email: 'support@minierp.com',
      phone: '+1 123 456 7890',
      address: '456 Enterprise Ave, BC 12345',
      taxId: 'TAX-123456789',
    },
    payment: {
      record_payment: true, // Default to checked
      payment_date: new Date().toISOString().split('T')[0],
      payment_amount: 0,
      payment_method: 'Cash',
      reference_no: '',
      payment_notes: ''
    }
  });

  const [editingCell, setEditingCell] = useState(null);
  const [existingPayments, setExistingPayments] = useState([]);
  const [showNewPaymentForm, setShowNewPaymentForm] = useState(false);

  // Fetch customers
  const { data: customers = [], error: customersError, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      // Make sure response.data.data is an array
      const customerData = Array.isArray(response.data.data) ? response.data.data : [];
      console.log('Fetched customers:', customerData.length, 'customers');
      return customerData;
    },
    onError: (error) => {
      console.error('Error fetching customers:', error);
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

  // Fetch company settings
  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  // Update company info when settings are loaded
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setInvoice(prev => ({
        ...prev,
        company: {
          name: settings.company_name?.value || 'Mini ERP',
          email: settings.company_email?.value || 'support@minierp.com',
          phone: settings.company_phone?.value || '+1 123 456 7890',
          address: settings.company_address?.value || '456 Enterprise Ave, BC 12345',
          taxId: settings.company_tax_id?.value || 'TAX-123456789',
        }
      }));
    }
  }, [settings]);

  // Update payment amount when invoice total changes and payment is being recorded
  useEffect(() => {
    if (invoice.payment.record_payment && !invoiceId) {
      const total = calculateTotal();
      setInvoice(prev => ({
        ...prev,
        payment: {
          ...prev.payment,
          payment_amount: total
        }
      }));
    }
  }, [invoice.items, invoice.discount, invoice.discountScope]);

  // Set initial payment amount for new invoices
  useEffect(() => {
    if (!invoiceId && invoice.payment.record_payment) {
      const total = calculateTotal();
      if (total > 0 && invoice.payment.payment_amount === 0) {
        setInvoice(prev => ({
          ...prev,
          payment: {
            ...prev.payment,
            payment_amount: total
          }
        }));
      }
    }
  }, []); // Run once on mount

  // Calculate expected status based on payment
  const getExpectedStatus = () => {
    if (!invoiceId) {
      if (invoice.payment.record_payment) {
        const total = calculateTotal();
        const paymentAmount = invoice.payment.payment_amount;
        if (paymentAmount >= total) {
          return 'Paid';
        } else if (paymentAmount > 0) {
          return 'Partially Paid';
        }
      }
      return 'Unpaid';
    }
    return invoice.status || 'Unpaid';
  };

  // If editing existing invoice, fetch it
  useEffect(() => {
    if (invoiceId) {
      const fetchInvoice = async () => {
        try {
          const response = await api.get(`/invoices/${invoiceId}`);
          const invoiceData = response.data;

          // Convert item data to match form structure
          const formattedItems = invoiceData.items?.map((item, index) => ({
            id: index + 1,
            item_id: item.item_id,
            description: item.item_name || item.description,
            quantity: item.quantity,
            rate: item.unit_price,
            tax: item.tax_rate || 0,
            discount: {
              type: item.discount_type || 'flat',
              value: item.discount_value || 0
            }
          })) || [];

          // Fetch customer balance information
          let customerBalance = { currentBalance: 0 };
          let customerInfo = {};

          try {
            const balanceResponse = await api.get(`/customers/${invoiceData.customer_id}/balance`);
            customerBalance = balanceResponse.data.data;

            const customerResponse = await api.get(`/customers/${invoiceData.customer_id}`);
            customerInfo = customerResponse.data.data;
          } catch (error) {
            console.error('Error fetching customer info:', error);
          }

          // Fetch existing payments for this invoice
          try {
            const paymentsResponse = await api.get(`/invoices/${invoiceId}/payments`);
            setExistingPayments(paymentsResponse.data.data || []);
          } catch (error) {
            console.error('Error fetching invoice payments:', error);
            setExistingPayments([]);
          }

           setInvoice({
             ...invoiceData,
             items: formattedItems,
             customer_id: invoiceData.customer_id,
             customer_name: invoiceData.customer_name,
             customer_email: invoiceData.customer_email,
             customer_phone: invoiceData.customer_phone,
             customer_address: invoiceData.customer_address,
             customer_current_balance: customerBalance.currentBalance || 0,
             customer_credit_limit: customerInfo.credit_limit || 0,
             customer_credit_utilization: customerInfo.credit_limit && customerInfo.credit_limit > 0
               ? (customerBalance.currentBalance / customerInfo.credit_limit) * 100
               : 0,
             discountScope: invoiceData.discount_scope || 'item',
             discount: {
               type: invoiceData.discount_type || 'flat',
               value: invoiceData.discount_value || 0
             },
             notes: invoiceData.notes || 'Thank you for your business. Payment is due within 14 days.',
             terms: invoiceData.terms || 'Net 14 days. Late payments subject to 1.5% monthly interest.',
             company: invoice.company,
             // Initialize payment object for new payments on existing invoices
             payment: {
               record_payment: false,
               payment_date: new Date().toISOString().split('T')[0],
               payment_amount: invoiceData.balance_amount || 0,
               payment_method: 'Cash',
               reference_no: '',
               payment_notes: ''
             }
           });
        } catch (error) {
          toast.error('Failed to load invoice');
          navigate('/sales');
        }
      };

      fetchInvoice();
    } else {
      // Generate new invoice number
      const newInvoiceNo = `INV-${new Date().getFullYear()}-${String(Date.now() % 1000000).padStart(6, '0')}`;
      setInvoice(prev => ({ ...prev, invoice_no: newInvoiceNo }));
    }
  }, [invoiceId, navigate]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (invoiceId) {
        return api.put(`/invoices/${invoiceId}`, data);
      } else {
        return api.post('/invoices', data);
      }
    },
    onSuccess: () => {
      toast.success(invoiceId ? 'Invoice updated successfully!' : 'Invoice created successfully!');
      queryClient.invalidateQueries(['invoices']);
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['customerInvoices', invoice.customer_id]);
      // Navigate to customer detail page
      navigate(`/customers/${invoice.customer_id}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || `Failed to ${invoiceId ? 'update' : 'create'} invoice`);
    }
  });

  // Mutation for recording payment on existing invoice
  const paymentMutation = useMutation({
    mutationFn: async (paymentData) => {
      return api.post('/payments', paymentData);
    },
    onSuccess: async () => {
      toast.success('Payment recorded successfully!');
      queryClient.invalidateQueries(['invoices']);
      // Refresh existing payments list
      try {
        const paymentsResponse = await api.get(`/invoices/${invoiceId}/payments`);
        setExistingPayments(paymentsResponse.data.data || []);
        // Refresh invoice data to update balance
        const invoiceResponse = await api.get(`/invoices/${invoiceId}`);
        setInvoice(prev => ({
          ...prev,
          paid_amount: invoiceResponse.data.paid_amount,
          balance_amount: invoiceResponse.data.balance_amount,
          status: invoiceResponse.data.status,
          payment: {
            ...prev.payment,
            record_payment: false,
            payment_amount: invoiceResponse.data.balance_amount || 0
          }
        }));
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
      setShowNewPaymentForm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    }
  });

  const handleRecordPayment = () => {
    if (!invoice.payment.payment_amount || invoice.payment.payment_amount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    const paymentData = {
      customer_id: invoice.customer_id,
      payment_date: invoice.payment.payment_date,
      amount: invoice.payment.payment_amount,
      payment_method: invoice.payment.payment_method,
      reference_no: invoice.payment.reference_no,
      notes: invoice.payment.payment_notes,
      invoice_allocations: [{
        invoice_id: parseInt(invoiceId, 10),
        amount: invoice.payment.payment_amount
      }]
    };

    paymentMutation.mutate(paymentData);
  };

  const calculateItemDiscount = (item) => {
    const subtotal = item.quantity * item.rate;
    if (item.discount.type === 'percentage') {
      return (subtotal * item.discount.value) / 100;
    } else {
      return item.discount.value;
    }
  };

  const calculateItemTotal = (item) => {
    const subtotal = item.quantity * item.rate;
    const discount = invoice.discountScope === 'item' ? calculateItemDiscount(item) : 0;
    const afterDiscount = subtotal - discount;
    const taxAmount = (afterDiscount * item.tax) / 100;
    return afterDiscount + taxAmount;
  };

  const calculateSubtotal = () => {
    return invoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  const calculateTax = () => {
    return invoice.items.reduce((sum, item) => {
      const subtotal = item.quantity * item.rate;
      const discount = invoice.discountScope === 'item' ? calculateItemDiscount(item) : 0;
      const afterDiscount = subtotal - discount;
      return sum + (afterDiscount * item.tax / 100);
    }, 0);
  };

  const calculateDiscount = () => {
    if (invoice.discountScope === 'item') {
      return invoice.items.reduce((sum, item) => sum + calculateItemDiscount(item), 0);
    } else {
      const subtotal = calculateSubtotal();
      if (invoice.discount.type === 'percentage') {
        return (subtotal * invoice.discount.value) / 100;
      } else {
        return invoice.discount.value;
      }
    }
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - calculateDiscount();
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-700',
      'Sent': 'bg-blue-100 text-blue-700',
      'Unpaid': 'bg-gray-100 text-gray-700',
      'Partially Paid': 'bg-yellow-100 text-yellow-700',
      'Paid': 'bg-green-100 text-green-700',
      'Overdue': 'bg-red-100 text-red-700',
      'Cancelled': 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const addNewItem = () => {
    const newItemId = Date.now();
    const newItem = {
      id: newItemId,
      item_id: '',
      description: '',
      quantity: 1,
      rate: 0,
      tax: 0,
      discount: { type: 'flat', value: 0 }
    };
    setInvoice({
      ...invoice,
      items: [...invoice.items, newItem]
    });
    return newItemId;
  };

  const removeItem = (id) => {
    setInvoice({
      ...invoice,
      items: invoice.items.filter(item => item.id !== id)
    });
  };

  const updateItem = (id, field, value) => {
    setInvoice({
      ...invoice,
      items: invoice.items.map(item => {
        if (item.id === id) {
          if (field === 'itemId') {
            const selectedItem = items.find(i => i.id === Number(value));
            return {
              ...item,
              item_id: Number(value),
              description: selectedItem?.item_name || item.description,
              rate: selectedItem?.standard_selling_price || item.rate
            };
          } else if (field === 'discountType') {
            return { ...item, discount: { ...item.discount, type: value } };
          } else if (field === 'discountValue') {
            return { ...item, discount: { ...item.discount, value: Number(value) || 0 } };
          } else {
            return { ...item, [field]: field === 'description' ? value : Number(value) || 0 };
          }
        }
        return item;
      })
    });
  };

  const getNextField = (currentField) => {
    if (invoice.discountScope === 'item') {
      const fieldOrder = ['description', 'quantity', 'rate', 'discountValue', 'tax'];
      const currentIndex = fieldOrder.indexOf(currentField);
      return fieldOrder[currentIndex + 1];
    } else {
      const fieldOrder = ['description', 'quantity', 'rate', 'tax'];
      const currentIndex = fieldOrder.indexOf(currentField);
      return fieldOrder[currentIndex + 1];
    }
  };

  const isLastField = (field) => {
    return field === 'tax';
  };

  const handleCustomerSelect = async (customer) => {
    try {
      // Fetch detailed customer information including balance
      const response = await api.get(`/customers/${customer.id}/balance`);
      const customerBalance = response.data.data;

      // Update invoice with customer details and balance information
      setInvoice({
        ...invoice,
        customer_id: customer.id,
        customer_name: customer.customer_name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.billing_address,
        customer_current_balance: customerBalance.currentBalance,
        customer_credit_limit: customer.credit_limit || 0,
        customer_credit_utilization: customer.credit_limit && customer.credit_limit > 0
          ? (customerBalance.currentBalance / customer.credit_limit) * 100
          : 0
      });
    } catch (error) {
      // If balance fetch fails, still update with basic customer info
      setInvoice({
        ...invoice,
        customer_id: customer.id,
        customer_name: customer.customer_name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.billing_address
      });
      console.error('Error fetching customer balance:', error);
    }
  };

  // Searchable Select Cell for Description with Stock Info
  const SearchableDescriptionCell = ({ value, itemId, isLastItem }) => {
    const isEditing = editingCell === `${itemId}-description`;
    const [tempValue, setTempValue] = useState(value);
    const [filteredItems, setFilteredItems] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);

    // Sync tempValue with value when it changes from outside
    useEffect(() => {
      if (value !== tempValue && !isEditing) {
        setTempValue(value);
      }
    }, [value, isEditing]);

    const handleInputChange = (e) => {
      const searchValue = e.target.value;
      setTempValue(searchValue);

      // Filter out raw materials (only show finished goods and purchasable items for sale)
      const sellableItems = items.filter(item =>
        !item.is_raw_material && // Exclude raw materials
        (item.is_finished_good || item.is_purchased) // Include finished goods or purchasable items
      );

      if (searchValue.trim()) {
        const matches = sellableItems.filter(item =>
          item.item_name.toLowerCase().includes(searchValue.toLowerCase()) ||
          item.item_code.toLowerCase().includes(searchValue.toLowerCase())
        ).slice(0, 10);
        setFilteredItems(matches);
        setShowDropdown(matches.length > 0);
        setSelectedIndex(matches.length > 0 ? 0 : -1); // Auto-select first item
      } else {
        const allSellableItems = sellableItems.slice(0, 10);
        setFilteredItems(allSellableItems);
        setShowDropdown(allSellableItems.length > 0);
        setSelectedIndex(allSellableItems.length > 0 ? 0 : -1);
      }
    };

    const selectItem = (item, moveNext = true) => {
      // Immediately update all fields in one state update
      setInvoice(prev => ({
        ...prev,
        items: prev.items.map(invItem => {
          if (invItem.id === itemId) {
            return {
              ...invItem,
              item_id: item.id,
              description: item.item_name,
              rate: item.standard_selling_price || 0
            };
          }
          return invItem;
        })
      }));

      // Update local state
      setTempValue(item.item_name);
      setShowDropdown(false);
      setFilteredItems([]);
      setSelectedIndex(-1);

      // Move to next field after selection
      if (moveNext) {
        setTimeout(() => {
          const nextField = getNextField('description');
          if (nextField) {
            setEditingCell(`${itemId}-${nextField}`);
          }
        }, 0);
      } else {
        setEditingCell(null);
      }
    };

    const handleSave = () => {
      if (tempValue !== value) {
        updateItem(itemId, 'description', tempValue);
      }
      setShowDropdown(false);
      setFilteredItems([]);
      setEditingCell(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (showDropdown && filteredItems.length > 0) {
          setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        } else if (!showDropdown && tempValue.trim()) {
          // Re-trigger search if dropdown was closed
          handleInputChange({ target: { value: tempValue } });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (showDropdown && filteredItems.length > 0) {
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showDropdown && selectedIndex >= 0 && filteredItems[selectedIndex]) {
          selectItem(filteredItems[selectedIndex], true);
        } else {
          handleSave();
          // Move to next row or field
          if (isLastField('description') && isLastItem) {
            const newItemId = addNewItem();
            setTimeout(() => setEditingCell(`${newItemId}-description`), 50);
          } else {
            const nextField = getNextField('description');
            if (nextField) {
              setTimeout(() => setEditingCell(`${itemId}-${nextField}`), 0);
            }
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (showDropdown && selectedIndex >= 0 && filteredItems[selectedIndex]) {
          selectItem(filteredItems[selectedIndex], true);
        } else {
          handleSave();
          const nextField = getNextField('description');
          if (nextField) {
            setTimeout(() => setEditingCell(`${itemId}-${nextField}`), 0);
          } else if (isLastItem) {
            const newItemId = addNewItem();
            setTimeout(() => setEditingCell(`${newItemId}-description`), 50);
          }
        }
      } else if (e.key === 'Escape') {
        setTempValue(value);
        setShowDropdown(false);
        setFilteredItems([]);
        setEditingCell(null);
      }
    };

    const handleBlur = (e) => {
      // Check if the blur is caused by clicking on a dropdown item
      const isClickingDropdown = e.relatedTarget?.closest('.item-dropdown');

      if (!isClickingDropdown) {
        setTimeout(() => {
          if (showDropdown && selectedIndex >= 0 && filteredItems[selectedIndex]) {
            // Auto-select the highlighted item on blur
            selectItem(filteredItems[selectedIndex], false);
          } else {
            handleSave();
          }
        }, 150);
      }
    };

    if (isEditing) {
      return (
        <div className="searchable-cell-container">
          <input
            ref={inputRef}
            type="text"
            value={tempValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              e.target.select();
              // Show dropdown with all sellable items if field is empty
              if (!tempValue.trim() && items.length > 0) {
                const sellableItems = items.filter(item =>
                  !item.is_raw_material && // Exclude raw materials
                  (item.is_finished_good || item.is_purchased) // Include finished goods or purchasable items
                ).slice(0, 10);
                setFilteredItems(sellableItems);
                setShowDropdown(sellableItems.length > 0);
                setSelectedIndex(sellableItems.length > 0 ? 0 : -1);
              }
            }}
            autoFocus
            className="editable-input"
            placeholder="Type to search items..."
          />
          {showDropdown && filteredItems.length > 0 && (
            <div className="item-dropdown">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`item-dropdown-option ${index === selectedIndex ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur from firing
                    selectItem(item, true);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="item-dropdown-main">
                    <span className="item-dropdown-name">{item.item_name}</span>
                    <span className="item-dropdown-code">{item.item_code}</span>
                  </div>
                  <div className="item-dropdown-details">
                    <span className="item-dropdown-stock">
                      Stock: {item.current_stock || 0}
                    </span>
                    <span className="item-dropdown-price">
                      ${(item.standard_selling_price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        onClick={() => {
          setTempValue(value || '');
          setEditingCell(`${itemId}-description`);
        }}
        className="editable-cell"
      >
        {value || <span className="cell-placeholder">Click to add item...</span>}
        <Edit2 className="edit-icon" />
      </div>
    );
  };

  // Regular Editable Cell for other fields
  const EditableCell = ({ value, itemId, field, type = 'text', isLastItem }) => {
    const isEditing = editingCell === `${itemId}-${field}`;
    const [tempValue, setTempValue] = useState(value);

    const handleSave = () => {
      updateItem(itemId, field, tempValue);
      setEditingCell(null);
    };

    const moveToCell = (rowOffset, colOffset) => {
      const currentItemIndex = invoice.items.findIndex(item => item.id === itemId);
      const fieldOrder = invoice.discountScope === 'item'
        ? ['description', 'quantity', 'rate', 'discountValue', 'tax']
        : ['description', 'quantity', 'rate', 'tax'];

      const currentFieldIndex = fieldOrder.indexOf(field);

      // Move vertically (row)
      if (rowOffset !== 0) {
        const newItemIndex = currentItemIndex + rowOffset;
        if (newItemIndex >= 0 && newItemIndex < invoice.items.length) {
          const newItemId = invoice.items[newItemIndex].id;
          handleSave();
          setTimeout(() => setEditingCell(`${newItemId}-${field}`), 0);
        } else if (rowOffset > 0 && newItemIndex >= invoice.items.length) {
          // Add new row when going down past last row
          handleSave();
          const newItemId = addNewItem();
          setTimeout(() => setEditingCell(`${newItemId}-description`), 50);
        }
      }

      // Move horizontally (column)
      if (colOffset !== 0) {
        const newFieldIndex = currentFieldIndex + colOffset;
        if (newFieldIndex >= 0 && newFieldIndex < fieldOrder.length) {
          handleSave();
          setTimeout(() => setEditingCell(`${itemId}-${fieldOrder[newFieldIndex]}`), 0);
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveToCell(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveToCell(1, 0);
      } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
        e.preventDefault();
        moveToCell(0, -1);
      } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
        e.preventDefault();
        moveToCell(0, 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
        if (isLastField(field) && isLastItem) {
          const newItemId = addNewItem();
          setTimeout(() => setEditingCell(`${newItemId}-description`), 50);
        } else {
          moveToCell(1, 0); // Move down on Enter
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleSave();
        const nextField = getNextField(field);
        if (nextField) {
          setEditingCell(`${itemId}-${nextField}`);
        } else if (isLastItem) {
          const newItemId = addNewItem();
          setTimeout(() => setEditingCell(`${newItemId}-description`), 50);
        } else {
          moveToCell(1, 0);
        }
      } else if (e.key === 'Escape') {
        setTempValue(value);
        setEditingCell(null);
      }
    };

    if (isEditing) {
      return (
        <input
          type={type}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          autoFocus
          className="editable-input"
        />
      );
    }

    return (
      <div
        onClick={() => {
          setTempValue(value);
          setEditingCell(`${itemId}-${field}`);
        }}
        className="editable-cell"
      >
        {value}
        <Edit2 className="edit-icon" />
      </div>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!invoice.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (invoice.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    // Prepare invoice data for submission
    const invoiceData = {
      // For new invoices, don't send status - backend will determine it
      // For existing invoices, send the status
      ...(invoiceId && { status: invoice.status }),
      invoice_no: invoice.invoice_no,
      customer_id: invoice.customer_id,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: calculateTotal(),
      discount_scope: invoice.discountScope,
      discount_type: invoice.discount.type,
      discount_value: invoice.discount.value,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items.map(item => ({
        item_id: item.item_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.rate,
        tax_rate: item.tax,
        discount_type: item.discount.type,
        discount_value: item.discount.value
      })),
      // Include payment data if payment is being recorded
      ...(invoice.payment.record_payment && {
        record_payment: true,
        payment: {
          payment_date: invoice.payment.payment_date,
          amount: invoice.payment.payment_amount,
          payment_method: invoice.payment.payment_method,
          reference_no: invoice.payment.reference_no,
          notes: invoice.payment.payment_notes
        }
      })
    };

    mutation.mutate(invoiceData);
  };

  return (
    <div className="sales-invoice-page-modern">
      {/* Action Bar */}
      <div className="action-bar-modern">
        <div className="action-left">
          <select
            value={invoiceId ? (invoice.status || 'Unpaid') : getExpectedStatus()}
            onChange={(e) => setInvoice({ ...invoice, status: e.target.value })}
            className={`status-select-modern ${getStatusColor(invoiceId ? (invoice.status || 'Unpaid') : getExpectedStatus())}`}
            disabled={!invoiceId} // Disable for new invoices
            title={invoiceId ? 'Change invoice status' : 'Status determined automatically based on payment'}
          >
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="action-right">
          <Button variant="secondary" onClick={() => navigate('/sales')}>
            Cancel
          </Button>
          {invoice.customer_id && (
            <button
              className="action-btn-secondary"
              onClick={() => navigate(`/customers/${invoice.customer_id}`)}
            >
              <span>View Customer</span>
            </button>
          )}
          <button className="action-btn-secondary">
            <Download className="action-icon" />
            PDF
          </button>
          <button className="action-btn-secondary">
            <Printer className="action-icon" />
            Print
          </button>
          <Button variant="primary" onClick={handleSubmit} loading={mutation.isPending}>
            <Send className="action-icon" />
            {invoiceId ? 'Update' : 'Create'} Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="invoice-document-modern">
        {/* Compact Header */}
        <div className="invoice-header-modern">
          <div className="header-grid-modern">
            {/* Invoice Title & Number - 25% */}
            <div className="header-section">
              <h1 className="invoice-title-modern">INVOICE</h1>
              <div className="invoice-number-modern">
                <Hash className="hash-icon" />
                <span>{invoice.invoice_no}</span>
              </div>
            </div>

            {/* From - 25% */}
            <div className="header-section">
              <div className="section-label-modern">FROM</div>
              <div className="company-name-modern">{invoice.company.name}</div>
              <div className="contact-info-modern">
                <div>{invoice.company.email}</div>
                <div>{invoice.company.phone}</div>
              </div>
            </div>

            {/* Bill To - 25% */}
            <div className="header-section">
              <div className="section-label-modern">BILL TO</div>
              <FormInput
                name="customer_name"
                type="searchable-select"
                value={invoice.customer_name}
                onChange={(e) => {
                  const customer = Array.isArray(customers) ? customers.find(c => c.customer_name === e.target.value) : null;
                  if (customer) {
                    handleCustomerSelect(customer);
                  }
                }}
                options={Array.isArray(customers)
                  ? customers.map(c => ({
                      value: c.customer_name,
                      label: `${c.customer_name}${c.customer_code ? ` (${c.customer_code})` : ''}`
                    }))
                  : []
                }
                placeholder={customersLoading ? "Loading customers..." : customersError ? "Error loading customers" : "Select customer..."}
                required
                small
                disabled={customersLoading || !!customersError}
              />
              <div className="contact-info-modern">
                <div>{invoice.customer_email}</div>
                <div>{invoice.customer_phone}</div>
              </div>

              {/* Customer Balance Information */}
              {invoice.customer_id && (
                <div className="customer-balance-info">
                  <div className="balance-info-row">
                    <span className="balance-label">Current Balance:</span>
                    <span className={`balance-value ${invoice.customer_current_balance > 0 ? 'balance-positive' : 'balance-zero'}`}>
                      ${Math.abs(invoice.customer_current_balance || 0).toFixed(2)}
                      {invoice.customer_current_balance > 0 && <span className="balance-indicator">(Due)</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Details - 25% */}
            <div className="header-section text-right">
              <div className="invoice-total-modern">${calculateTotal().toFixed(2)}</div>
              <div className="invoice-meta-modern">
                <div>
                  <span className="meta-label">Date: </span>
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </div>
                <div>
                  <span className="meta-label">Due: </span>
                  {new Date(invoice.due_date).toLocaleDateString()}
                </div>
                <div className="meta-label">Net 14 Days</div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="invoice-body-modern">
          <div className="items-header-modern">
            <div className="items-header-left">
              <h3 className="items-title-modern">Line Items</h3>
              <div className="discount-scope-controls-modern">
                <span className="discount-label-modern">Discount:</span>
                <label className="discount-scope-option-modern">
                  <input
                    type="radio"
                    name="discountScope"
                    value="invoice"
                    checked={invoice.discountScope === 'invoice'}
                    onChange={(e) => setInvoice({ ...invoice, discountScope: e.target.value })}
                  />
                  <span>Invoice Level</span>
                </label>
                <label className="discount-scope-option-modern">
                  <input
                    type="radio"
                    name="discountScope"
                    value="item"
                    checked={invoice.discountScope === 'item'}
                    onChange={(e) => setInvoice({ ...invoice, discountScope: e.target.value })}
                  />
                  <span>Per Item</span>
                </label>
              </div>
            </div>
            <button
              onClick={() => {
                const newItemId = addNewItem();
                setTimeout(() => {
                  setEditingCell(`${newItemId}-description`);
                }, 50);
              }}
              className="add-item-btn-modern"
            >
              <Plus className="action-icon" />
              Add Item
            </button>
          </div>

          <div className="items-table-container-modern">
            <table className="items-table-modern">
              <thead>
                <tr>
                  <th className="text-left">Description</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Rate</th>
                  {invoice.discountScope === 'item' && (
                    <th className="text-right">Discount</th>
                  )}
                  <th className="text-right">Tax %</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <SearchableDescriptionCell
                        value={item.description}
                        itemId={item.id}
                        isLastItem={index === invoice.items.length - 1}
                      />
                    </td>
                    <td className="text-right">
                      <EditableCell
                        value={item.quantity}
                        itemId={item.id}
                        field="quantity"
                        type="number"
                        isLastItem={index === invoice.items.length - 1}
                      />
                    </td>
                    <td className="text-right">
                      <EditableCell
                        value={item.rate.toFixed(2)}
                        itemId={item.id}
                        field="rate"
                        type="number"
                        isLastItem={index === invoice.items.length - 1}
                      />
                    </td>
                    {invoice.discountScope === 'item' && (
                      <td className="text-right">
                        <div className="discount-cell-modern">
                          <select
                            value={item.discount.type}
                            onChange={(e) => updateItem(item.id, 'discountType', e.target.value)}
                            className="discount-type-select-modern"
                          >
                            <option value="percentage">%</option>
                            <option value="flat">$</option>
                          </select>
                          <EditableCell
                            value={item.discount.value}
                            itemId={item.id}
                            field="discountValue"
                            type="number"
                            isLastItem={index === invoice.items.length - 1}
                          />
                        </div>
                      </td>
                    )}
                    <td className="text-right">
                      <EditableCell
                        value={item.tax}
                        itemId={item.id}
                        field="tax"
                        type="number"
                        isLastItem={index === invoice.items.length - 1}
                      />
                    </td>
                    <td className="text-right amount-cell-modern">
                      ${calculateItemTotal(item).toFixed(2)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="remove-btn-modern"
                      >
                        <Trash2 className="trash-icon" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="totals-section-modern">
            <div className="totals-breakdown-modern">
              <div className="total-row-modern">
                <span>Subtotal:</span>
                <span className="total-value">${calculateSubtotal().toFixed(2)}</span>
              </div>

              {/* Discount Section */}
              {invoice.discountScope === 'invoice' ? (
                <div className="total-row-modern">
                  <div className="discount-input-modern">
                    <span>Discount:</span>
                    <div className="discount-controls">
                      <select
                        value={invoice.discount.type}
                        onChange={(e) => setInvoice({
                          ...invoice,
                          discount: { ...invoice.discount, type: e.target.value }
                        })}
                        className="discount-type-select-modern"
                      >
                        <option value="percentage">%</option>
                        <option value="flat">$</option>
                      </select>
                      <input
                        type="number"
                        value={invoice.discount.value}
                        onChange={(e) => setInvoice({
                          ...invoice,
                          discount: { ...invoice.discount, value: Number(e.target.value) || 0 }
                        })}
                        onFocus={(e) => e.target.select()}
                        className="discount-value-input"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <span className="discount-amount">
                    -${calculateDiscount().toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="total-row-modern">
                  <span>Discount (Per Item):</span>
                  <span className="discount-amount">
                    -${calculateDiscount().toFixed(2)}
                  </span>
                </div>
              )}

              <div className="total-row-modern border-top">
                <span>Tax:</span>
                <span className="total-value">${calculateTax().toFixed(2)}</span>
              </div>
              <div className="total-row-modern total-final">
                <span>Total:</span>
                <span className="total-amount-final">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="invoice-footer-modern">
            <div>
              <label className="footer-label">NOTES</label>
              <textarea
                value={invoice.notes}
                onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                rows="3"
                className="footer-textarea"
              />
            </div>
            <div>
              <label className="footer-label">TERMS & CONDITIONS</label>
              <textarea
                value={invoice.terms}
                onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                rows="3"
                className="footer-textarea"
              />
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="payment-section-modern">
          <div className="payment-header">
            <h3 className="payment-title">
              <DollarSign size={20} />
              Payment Information
            </h3>
            {!invoiceId ? (
              <label className="payment-checkbox">
                <input
                  type="checkbox"
                  checked={invoice.payment.record_payment}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: {
                      ...invoice.payment,
                      record_payment: e.target.checked,
                      payment_amount: e.target.checked ? calculateTotal() : invoice.payment.payment_amount
                    }
                  })}
                />
                <span>Record payment for this invoice</span>
              </label>
            ) : (
              <div className="payment-summary-header">
                <span className="payment-summary-item">
                  Total: <strong>${(invoice.total_amount || 0).toFixed(2)}</strong>
                </span>
                <span className="payment-summary-item">
                  Paid: <strong className="text-green">${(invoice.paid_amount || 0).toFixed(2)}</strong>
                </span>
                <span className="payment-summary-item">
                  Balance: <strong className={invoice.balance_amount > 0 ? 'text-red' : 'text-green'}>
                    ${(invoice.balance_amount || 0).toFixed(2)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Existing Payments - Show when editing invoice */}
          {invoiceId && existingPayments.length > 0 && (
            <div className="existing-payments">
              <h4 className="existing-payments-title">
                <CreditCard size={16} />
                Payment History
              </h4>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Payment No</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {existingPayments.map(payment => (
                    <tr key={payment.id}>
                      <td>{payment.payment_no}</td>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td>{payment.payment_method}</td>
                      <td>{payment.reference_no || '-'}</td>
                      <td className="text-right">${parseFloat(payment.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* No payments message for existing invoice */}
          {invoiceId && existingPayments.length === 0 && !showNewPaymentForm && (
            <div className="no-payments-message">
              <p>No payments recorded for this invoice.</p>
            </div>
          )}

          {/* Add New Payment Button for existing invoice with balance */}
          {invoiceId && invoice.balance_amount > 0 && !showNewPaymentForm && (
            <div className="add-payment-btn-container">
              <Button
                variant="primary"
                onClick={() => setShowNewPaymentForm(true)}
              >
                <Plus size={16} />
                Record Payment
              </Button>
            </div>
          )}

          {/* New Payment Form - For new invoices OR when adding payment to existing */}
          {(!invoiceId && invoice.payment.record_payment) || (invoiceId && showNewPaymentForm) ? (
            <div className="payment-fields">
              <div className="payment-row">
                <FormInput
                  label="Payment Date"
                  name="payment_date"
                  type="date"
                  value={invoice.payment.payment_date}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: { ...invoice.payment, payment_date: e.target.value }
                  })}
                />
                <FormInput
                  label="Payment Amount"
                  name="payment_amount"
                  type="number"
                  value={invoice.payment.payment_amount}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: { ...invoice.payment, payment_amount: parseFloat(e.target.value) || 0 }
                  })}
                  step="0.01"
                  max={invoiceId ? invoice.balance_amount : undefined}
                />
              </div>
              <div className="payment-row">
                <FormInput
                  label="Payment Method"
                  name="payment_method"
                  type="select"
                  value={invoice.payment.payment_method}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: { ...invoice.payment, payment_method: e.target.value }
                  })}
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'Check', label: 'Check' },
                    { value: 'Bank Transfer', label: 'Bank Transfer' },
                    { value: 'Credit Card', label: 'Credit Card' },
                    { value: 'Online Payment', label: 'Online Payment' }
                  ]}
                />
                <FormInput
                  label="Reference No"
                  name="reference_no"
                  type="text"
                  value={invoice.payment.reference_no}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: { ...invoice.payment, reference_no: e.target.value }
                  })}
                  placeholder="Check number, transaction ID, etc."
                />
              </div>
              <div className="payment-row">
                <FormInput
                  label="Payment Notes"
                  name="payment_notes"
                  type="textarea"
                  value={invoice.payment.payment_notes}
                  onChange={(e) => setInvoice({
                    ...invoice,
                    payment: { ...invoice.payment, payment_notes: e.target.value }
                  })}
                  placeholder="Optional payment notes..."
                  rows={2}
                />
              </div>
              {/* Action buttons for existing invoice payment form */}
              {invoiceId && showNewPaymentForm && (
                <div className="payment-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setShowNewPaymentForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRecordPayment}
                    loading={paymentMutation.isPending}
                  >
                    Save Payment
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="invoice-bottom-footer">
          <p className="footer-thanks">Thank you for your business!</p>
          <p className="footer-contact">Questions? Contact {invoice.company.email}</p>
        </div>
      </div>
    </div>
  );
}
