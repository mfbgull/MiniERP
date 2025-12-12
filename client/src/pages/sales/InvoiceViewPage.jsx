import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Edit2, Mail, Share2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Button from '../../components/common/Button';
import InvoiceTemplate from '../../components/invoice/InvoiceTemplate';
import './InvoiceViewPage.css';

export default function InvoiceViewPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const invoiceRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch invoice data
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const response = await api.get(`/invoices/${invoiceId}`);
      return response.data;
    },
    enabled: !!invoiceId
  });

  // Fetch company settings
  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  const company = {
    name: settings.company_name?.value || 'Mini ERP',
    email: settings.company_email?.value || 'support@minierp.com',
    phone: settings.company_phone?.value || '+1 123 456 7890',
    address: settings.company_address?.value || '456 Enterprise Ave, BC 12345',
    taxId: settings.company_tax_id?.value || '',
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${invoice.invoice_no}.pdf`);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmail = () => {
    if (invoice?.customer_email) {
      const subject = encodeURIComponent(`Invoice ${invoice.invoice_no} from ${company.name}`);
      const body = encodeURIComponent(
        `Dear ${invoice.customer_name},\n\n` +
        `Please find attached Invoice ${invoice.invoice_no} for the amount of $${invoice.total_amount?.toFixed(2)}.\n\n` +
        `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}\n\n` +
        `Thank you for your business.\n\n` +
        `Best regards,\n${company.name}`
      );
      window.open(`mailto:${invoice.customer_email}?subject=${subject}&body=${body}`);
    } else {
      toast.error('Customer email not available');
    }
  };

  if (isLoading) {
    return (
      <div className="invoice-view-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="invoice-view-page">
        <div className="error-container">
          <h2>Invoice not found</h2>
          <p>The invoice you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/sales')}>Back to Sales</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-view-page">
      {/* Toolbar */}
      <div className="invoice-view-toolbar no-print">
        <div className="toolbar-left">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            Back
          </Button>
          <h2 className="toolbar-title">Invoice {invoice.invoice_no}</h2>
        </div>
        <div className="toolbar-right">
          <Button variant="secondary" onClick={() => navigate(`/sales/invoice/${invoiceId}`)}>
            <Edit2 size={18} />
            Edit
          </Button>
          <Button variant="secondary" onClick={handleEmail}>
            <Mail size={18} />
            Email
          </Button>
          <Button variant="secondary" onClick={handleDownloadPDF} loading={isExporting}>
            <Download size={18} />
            PDF
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer size={18} />
            Print
          </Button>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="invoice-view-container">
        <div className="invoice-preview-wrapper">
          <InvoiceTemplate
            ref={invoiceRef}
            invoice={invoice}
            company={company}
          />
        </div>
      </div>
    </div>
  );
}
