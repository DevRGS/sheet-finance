import { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleSheetsConfig } from '@/types/finance';

const STORAGE_KEY = 'google_sheets_config';

export function useGoogleSheetsConfig() {
  const [config, setConfig] = useState<GoogleSheetsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load config from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig(parsed);
      }
    } catch (error) {
      console.error('Error loading Google Sheets config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback((newConfig: GoogleSheetsConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
      return true;
    } catch (error) {
      console.error('Error saving Google Sheets config:', error);
      return false;
    }
  }, []);

  // Clear config
  const clearConfig = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(null);
      return true;
    } catch (error) {
      console.error('Error clearing Google Sheets config:', error);
      return false;
    }
  }, []);

  // Check if config is valid
  const isValid = useMemo(() => {
    if (!config) return false;
    
    const sheetsId = config.sheetsId?.trim();
    
    // Validate sheets ID (should be alphanumeric, usually long)
    const sheetsIdValid = sheetsId && sheetsId.length > 10;
    
    return !!sheetsIdValid;
  }, [config]);

  return {
    config,
    isLoading,
    saveConfig,
    clearConfig,
    isValid,
  };
}

