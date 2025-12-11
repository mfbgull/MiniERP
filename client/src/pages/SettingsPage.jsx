import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import FormInput from '../components/common/FormInput';
import Button from '../components/common/Button';
import './SettingsPage.css';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    currency_symbol: '$',
    currency_code: 'USD',
    company_name: 'Mini ERP',
    date_format: 'MM/DD/YYYY',
    decimal_places: '2'
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        currency_symbol: settings.currency_symbol?.value || '$',
        currency_code: settings.currency_code?.value || 'USD',
        company_name: settings.company_name?.value || 'Mini ERP',
        date_format: settings.date_format?.value || 'MM/DD/YYYY',
        decimal_places: settings.decimal_places?.value || '2'
      });
    }
  }, [settings]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const settingsPayload = {};
      Object.entries(data).forEach(([key, value]) => {
        settingsPayload[key] = {
          value: value,
          description: settings[key]?.description || ''
        };
      });
      return api.post('/settings/bulk', settingsPayload);
    },
    onSuccess: () => {
      toast.success('Settings updated successfully!');
      queryClient.invalidateQueries(['settings']);
      // Reload page to apply new settings
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update settings');
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        currency_symbol: settings.currency_symbol?.value || '$',
        currency_code: settings.currency_code?.value || 'USD',
        company_name: settings.company_name?.value || 'Mini ERP',
        date_format: settings.date_format?.value || 'MM/DD/YYYY',
        decimal_places: settings.decimal_places?.value || '2'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Configure your ERP system preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {/* Currency Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2>💰 Currency Settings</h2>
            <p className="section-description">Configure currency display preferences</p>
          </div>
          <div className="settings-grid">
            <FormInput
              label="Currency Symbol"
              name="currency_symbol"
              value={formData.currency_symbol}
              onChange={handleChange}
              placeholder="e.g., $, €, £, Rs"
              required
              helpText="This symbol will appear before all monetary values"
            />
            <FormInput
              label="Currency Code"
              name="currency_code"
              value={formData.currency_code}
              onChange={handleChange}
              placeholder="e.g., USD, EUR, GBP, PKR"
              required
              helpText="Standard 3-letter currency code"
            />
            <FormInput
              label="Decimal Places"
              name="decimal_places"
              type="number"
              min="0"
              max="4"
              value={formData.decimal_places}
              onChange={handleChange}
              required
              helpText="Number of decimal places for currency amounts"
            />
          </div>
        </div>

        {/* Company Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2>🏢 Company Settings</h2>
            <p className="section-description">Basic company information</p>
          </div>
          <div className="settings-grid">
            <FormInput
              label="Company Name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="e.g., ABC Manufacturing Ltd."
              required
              helpText="Your company or business name"
            />
          </div>
        </div>

        {/* Display Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2>🎨 Display Settings</h2>
            <p className="section-description">Customize how information is displayed</p>
          </div>
          <div className="settings-grid">
            <FormInput
              label="Date Format"
              name="date_format"
              type="select"
              value={formData.date_format}
              onChange={handleChange}
              options={[
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
                { value: 'DD MMM YYYY', label: 'DD MMM YYYY (31 Dec 2025)' }
              ]}
              required
              helpText="Preferred date format for reports"
            />
          </div>
        </div>

        {/* Preview Section */}
        <div className="settings-section preview-section">
          <div className="section-header">
            <h2>👁️ Preview</h2>
            <p className="section-description">See how your settings will look</p>
          </div>
          <div className="preview-content">
            <div className="preview-item">
              <span className="preview-label">Currency Display:</span>
              <span className="preview-value">
                {formData.currency_symbol}{parseFloat(1234.56).toFixed(parseInt(formData.decimal_places))}
              </span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Company Name:</span>
              <span className="preview-value">{formData.company_name}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Date Format:</span>
              <span className="preview-value">{formData.date_format}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={updateMutation.isPending}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={updateMutation.isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
