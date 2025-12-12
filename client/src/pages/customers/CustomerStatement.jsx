import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import FormInput from '../../components/common/FormInput';
import './CustomerStatement.css';

export default function CustomerStatement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });

  // Fetch customer details
  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data.data;
    }
  });

  // Fetch customer statement data
  const { data: statement, isLoading } = useQuery({
    queryKey: ['customerStatement', id, dateRange.fromDate, dateRange.toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('fromDate', dateRange.fromDate);
      params.append('toDate', dateRange.toDate);
      
      const response = await api.get(`/customers/${id}/statement?${params.toString()}`);
      return response.data.data;
    },
    enabled: !!id
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real implementation, this would download a PDF
    toast.success('Statement download would start in a real implementation');
  };

  if (isLoading) {
    return (
      <div className="customer-statement-page loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="customer-statement-page error">
        <h2>Statement not available</h2>
        <p>Could not load customer statement data.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  const { customer: customerInfo, openingBalance, closingBalance, transactions } = statement;

  return (
    <div className="customer-statement-page">
      <div className="statement-header">
        <div className="header-content">
          <Button 
            variant="secondary" 
            onClick={() => navigate(-1)}
            className="back-button"
          >
            ← Back
          </Button>
          
          <div className="statement-title">
            <h1>Customer Statement</h1>
            <p>For {customerInfo?.customer_name}</p>
          </div>
          
          <div className="statement-actions">
            <Button variant="secondary" onClick={handlePrint}>
              <Printer size={16} />
              Print
            </Button>
            <Button variant="primary" onClick={handleDownload}>
              <Download size={16} />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="statement-filters">
        <div className="date-filters">
          <FormInput
            label="From Date"
            type="date"
            value={dateRange.fromDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
          />
          <FormInput
            label="To Date"
            type="date"
            value={dateRange.toDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="statement-body">
        <div className="statement-info">
          <div className="customer-details">
            <h3>Customer Information</h3>
            <div className="detail-row">
              <span className="label">Name:</span>
              <span className="value">{customerInfo?.customer_name}</span>
            </div>
            <div className="detail-row">
              <span className="label">Code:</span>
              <span className="value">{customerInfo?.customer_code}</span>
            </div>
            <div className="detail-row">
              <span className="label">Contact:</span>
              <span className="value">{customerInfo?.contact_person}</span>
            </div>
            <div className="detail-row">
              <span className="label">Email:</span>
              <span className="value">{customerInfo?.email}</span>
            </div>
            <div className="detail-row">
              <span className="label">Phone:</span>
              <span className="value">{customerInfo?.phone}</span>
            </div>
          </div>

          <div className="statement-summary">
            <h3>Statement Summary</h3>
            <div className="summary-row">
              <span className="label">Opening Balance:</span>
              <span className="value">${openingBalance?.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Closing Balance:</span>
              <span className="value">${closingBalance?.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Total Debits:</span>
              <span className="value">
                ${transactions
                  .reduce((sum, t) => sum + (parseFloat(t.debit || 0)), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">Total Credits:</span>
              <span className="value">
                ${transactions
                  .reduce((sum, t) => sum + (parseFloat(t.credit || 0)), 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="transaction-table">
          <h3>Transaction Details</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="amount">Debit</th>
                <th className="amount">Credit</th>
                <th className="amount">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="opening-balance-row">
                <td>{dateRange.fromDate}</td>
                <td>Opening Balance</td>
                <td>Beginning balance</td>
                <td className="amount"></td>
                <td className="amount"></td>
                <td className="amount balance">${openingBalance?.toFixed(2)}</td>
              </tr>
              
              {transactions.map((transaction, index) => {
                // Calculate running balance
                let runningBalance = openingBalance;
                for (let i = 0; i <= index; i++) {
                  runningBalance += parseFloat(transactions[i].debit || 0) - parseFloat(transactions[i].credit || 0);
                }
                
                return (
                  <tr key={index} className="transaction-row">
                    <td>{transaction.transaction_date}</td>
                    <td>{transaction.reference_no}</td>
                    <td>{transaction.description}</td>
                    <td className="amount debit">
                      {transaction.debit > 0 ? `$${parseFloat(transaction.debit).toFixed(2)}` : ''}
                    </td>
                    <td className="amount credit">
                      {transaction.credit > 0 ? `$${parseFloat(transaction.credit).toFixed(2)}` : ''}
                    </td>
                    <td className="amount balance">${runningBalance.toFixed(2)}</td>
                  </tr>
                );
              })}
              
              <tr className="closing-balance-row">
                <td>{dateRange.toDate}</td>
                <td>Closing Balance</td>
                <td>Ending balance</td>
                <td className="amount"></td>
                <td className="amount"></td>
                <td className="amount balance">${closingBalance?.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}