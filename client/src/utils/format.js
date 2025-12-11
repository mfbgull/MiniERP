import { useQuery } from '@tanstack/react-query';

// Custom hook to get current settings
export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
};

// Function to format currency based on settings
export const formatCurrency = (amount, settings = null) => {
  try {
    // Default values if settings are not available
    const currencySymbol = settings?.currency_symbol?.value || '$';
    const currencyCode = settings?.currency_code?.value || 'USD';
    const decimalPlaces = parseInt(settings?.decimal_places?.value || 2);

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return `${currencySymbol}0.00`;
    }

    // Format the number with specified decimal places
    const formattedAmount = numAmount.toFixed(decimalPlaces);

    return `${currencySymbol}${formattedAmount}`;
  } catch (error) {
    // Fallback formatting if there's an error
    console.warn('Error formatting currency:', error);
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  }
};

// Function to format currency using the global settings
export const formatCurrencyWithGlobalSettings = (amount) => {
  // We'll use this function by importing settings from context later
  return formatCurrency(amount);
};