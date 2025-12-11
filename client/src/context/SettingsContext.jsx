import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
      setLoading(false);
    } else if (!isLoading) {
      setLoading(false);
    }
  }, [data, isLoading]);

  // Function to refresh settings
  const refreshSettings = async () => {
    setLoading(true);
    const newData = await refetch();
    setSettings(newData.data);
    setLoading(false);
    return newData.data;
  };

  // Helper function to get a specific setting value
  const getSettingValue = (key, defaultValue = '') => {
    return settings?.[key]?.value || defaultValue;
  };

  const value = {
    settings,
    loading,
    refreshSettings,
    getSettingValue,
    formatCurrency: (amount) => {
      if (!settings) {
        return `$${parseFloat(amount || 0).toFixed(2)}`;
      }
      const currencySymbol = settings.currency_symbol?.value || '$';
      const decimalPlaces = parseInt(settings.decimal_places?.value || 2);
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) {
        return `${currencySymbol}0.00`;
      }
      return `${currencySymbol}${numAmount.toFixed(decimalPlaces)}`;
    }
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};