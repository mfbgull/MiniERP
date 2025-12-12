import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Calendar, CreditCard, FileText, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import FormInput from '../../components/common/FormInput';
import './PaymentModal.css';

export default function PaymentModal({ customerId, customer, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'Cash',
    reference_no: '',
    notes: '',
    invoice_allocations: []
  });
  
  const [errors, setErrors] = useState({});
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [allocationTotal, setAllocationTotal] = useState(0);
  const [unallocatedAmount, setUnallocatedAmount] = useState(0);
  const queryClient = useQueryClient();

  // Fetch outstanding invoices for the customer
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['outstandingInvoices', customerId],
    queryFn: async () => {
      const response = await api.get(`/invoices?customerId=${customerId}&status=Unpaid,Partially Paid,Overdue`);
      return response.data.data.filter(inv => (inv.balance_amount || 0) > 0);
    },
    enabled: !!customerId
  });

  useEffect(() => {
    if (invoices.length > 0) {
      setOutstandingInvoices(invoices);
    }
  }, [invoices]);

  useEffect(() => {
    // Calculate allocation total and unallocated amount
    const totalAllocated = formData.invoice_allocations.reduce((sum, alloc) => 
      sum + parseFloat(alloc.amount || 0), 0
    );
    
    setAllocationTotal(totalAllocated);
    setUnallocatedAmount(parseFloat(formData.amount || 0) - totalAllocated);
  }, [formData.invoice_allocations, formData.amount]);

  const handleAddAllocation = (invoiceId) => {
    const invoice = outstandingInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Check if already added
    if (formData.invoice_allocations.some(alloc => alloc.invoice_id === invoiceId)) {
      return;
    }

    const newAllocation = {
      invoice_id: invoiceId,
      invoice_no: invoice.invoice_no,
      amount: Math.min(invoice.balance_amount, parseFloat(formData.amount || 0)),
      max_amount: invoice.balance_amount
    };

    setFormData(prev => ({
      ...prev,
      invoice_allocations: [...prev.invoice_allocations, newAllocation]
    }));
  };

  const handleRemoveAllocation = (invoiceId) => {
    setFormData(prev => ({
      ...prev,
      invoice_allocations: prev.invoice_allocations.filter(alloc => alloc.invoice_id !== invoiceId)
    }));
  };

  const handleAllocationAmountChange = (invoiceId, amount) => {
    const invoice = outstandingInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const newAmount = Math.min(parseFloat(amount || 0), invoice.balance_amount);
    
    setFormData(prev => ({
      ...prev,
      invoice_allocations: prev.invoice_allocations.map(alloc => 
        alloc.invoice_id === invoiceId ? { ...alloc, amount: newAmount } : alloc
      )
    }));
  };

  const handleAutoAllocate = () => {
    const remainingAmount = parseFloat(formData.amount || 0);
    const newAllocations = [];
    let amountLeft = remainingAmount;

    outstandingInvoices.forEach(invoice => {
      if (amountLeft <= 0) return;
      
      const existingAllocation = formData.invoice_allocations.find(alloc => alloc.invoice_id === invoice.id);
      if (existingAllocation) {
        // Skip if already allocated
        amountLeft -= existingAllocation.amount;
        return;
      }

      const allocationAmount = Math.min(invoice.balance_amount, amountLeft);
      if (allocationAmount > 0) {
        newAllocations.push({
          invoice_id: invoice.id,
          invoice_no: invoice.invoice_no,
          amount: allocationAmount,
          max_amount: invoice.balance_amount
        });
        amountLeft -= allocationAmount;
      }
    });

    setFormData(prev => ({
      ...prev,
      invoice_allocations: [...prev.invoice_allocations, ...newAllocations]
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? value : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/payments', data);
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['customer', customerId]);
      queryClient.invalidateQueries(['customerInvoices', customerId]);
      queryClient.invalidateQueries(['customerLedger', customerId]);
      queryClient.invalidateQueries(['customerPayments', customerId]);
      queryClient.invalidateQueries(['invoices']);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || 'Failed to record payment';
      toast.error(errorMsg);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.payment_date) newErrors.payment_date = 'Payment date is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (parseFloat(formData.amount) !== allocationTotal) {
      newErrors.amount = `Amount must match total allocated (${allocationTotal.toFixed(2)})`;
    }
    if (formData.invoice_allocations.length === 0) {
      newErrors.invoice_allocations = 'At least one invoice allocation is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    mutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      customer_id: customerId,
      invoice_allocations: formData.invoice_allocations.map(alloc => ({
        invoice_id: alloc.invoice_id,
        amount: parseFloat(alloc.amount)
      }))
    });
  };

  return (
    <form onSubmit={handleSubmit} className="payment-modal">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Customer</label>
          <div className="customer-info">
            <div className="customer-name">{customer?.customer_name}</div>
            <div className="customer-code">{customer?.customer_code}</div>
          </div>
        </div>
        
        <FormInput
          label="Payment Date *"
          name="payment_date"
          type="date"
          value={formData.payment_date}
          onChange={handleChange}
          error={errors.payment_date}
          required
        />
      </div>

      <div className="form-row">
        <FormInput
          label="Total Amount *"
          name="amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={handleChange}
          error={errors.amount}
          required
        />
        
        <FormInput
          label="Payment Method"
          name="payment_method"
          type="select"
          value={formData.payment_method}
          onChange={handleChange}
          options={[
            { value: 'Cash', label: 'Cash' },
            { value: 'Check', label: 'Check' },
            { value: 'Bank Transfer', label: 'Bank Transfer' },
            { value: 'Credit Card', label: 'Credit Card' },
            { value: 'Debit Card', label: 'Debit Card' }
          ]}
        />
      </div>

      <FormInput
        label="Reference Number"
        name="reference_no"
        value={formData.reference_no}
        onChange={handleChange}
      />

      <FormInput
        label="Notes"
        name="notes"
        type="textarea"
        value={formData.notes}
        onChange={handleChange}
        rows={3}
      />

      {/* Invoice Allocations */}
      <div className="allocation-section">
        <div className="allocation-header">
          <h3>Invoice Allocations</h3>
          <Button 
            type="button" 
            variant="secondary" 
            size="small" 
            onClick={handleAutoAllocate}
            disabled={formData.invoice_allocations.length === 0 && !formData.amount}
          >
            <Plus size={16} />
            Auto Allocate
          </Button>
        </div>

        {errors.invoice_allocations && (
          <div className="error-message">{errors.invoice_allocations}</div>
        )}

        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            <div className="available-invoices">
              <label className="form-label">Available Invoices</label>
              {outstandingInvoices
                .filter(inv => !formData.invoice_allocations.some(alloc => alloc.invoice_id === inv.id))
                .map(invoice => (
                  <div key={invoice.id} className="invoice-item">
                    <div className="invoice-info">
                      <div className="invoice-no">{invoice.invoice_no}</div>
                      <div className="invoice-details">
                        <span className="invoice-date">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                        <span className="invoice-amount">${invoice.balance_amount?.toFixed(2)}</span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleAddAllocation(invoice.id)}
                      disabled={parseFloat(formData.amount || 0) <= 0}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                ))}
              
              {outstandingInvoices.filter(inv => 
                !formData.invoice_allocations.some(alloc => alloc.invoice_id === inv.id)
              ).length === 0 && (
                <p className="no-invoices">No outstanding invoices</p>
              )}
            </div>

            {formData.invoice_allocations.length > 0 && (
              <div className="allocated-invoices">
                <label className="form-label">Allocated Invoices</label>
                {formData.invoice_allocations.map(allocation => {
                  const invoice = outstandingInvoices.find(inv => inv.id === allocation.invoice_id);
                  return (
                    <div key={allocation.invoice_id} className="allocation-item">
                      <div className="allocation-info">
                        <div className="allocation-invoice">{allocation.invoice_no}</div>
                        <div className="allocation-details">
                          <span className="allocation-amount">Balance: ${allocation.max_amount.toFixed(2)}</span>
                          <FormInput
                            type="number"
                            step="0.01"
                            value={allocation.amount}
                            onChange={(e) => handleAllocationAmountChange(allocation.invoice_id, e.target.value)}
                            className="allocation-input"
                            min="0"
                            max={allocation.max_amount}
                          />
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => handleRemoveAllocation(allocation.invoice_id)}
                      >
                        <Minus size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Allocation Summary */}
        <div className="allocation-summary">
          <div className="summary-row">
            <span>Total Payment Amount:</span>
            <span>${parseFloat(formData.amount || 0).toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Total Allocated:</span>
            <span>${allocationTotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Unallocated Amount:</span>
            <span className={unallocatedAmount !== 0 ? 'unallocated-amount' : ''}>
              ${unallocatedAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Record Payment
        </Button>
      </div>
    </form>
  );
}