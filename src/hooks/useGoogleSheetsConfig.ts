import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { GoogleSheetsConfig } from '@/types/finance';

const STORAGE_KEY = 'google_sheets_config';

/**
 * Store único (módulo) para a configuração da planilha.
 * Todos os componentes que usam o hook partilham o mesmo estado — ao escolher uma planilha em
 * Configurações, o FinanceProvider recebe a mudança imediatamente e conecta-se a ela.
 */
function readConfig(): GoogleSheetsConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as GoogleSheetsConfig) : null;
  } catch (error) {
    console.error('Error loading Google Sheets config:', error);
    return null;
  }
}

let currentConfig: GoogleSheetsConfig | null = readConfig();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GoogleSheetsConfig | null {
  return currentConfig;
}

// Sincroniza com outros separadores
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      currentConfig = readConfig();
      emit();
    }
  });
}

export function useGoogleSheetsConfig() {
  const config = useSyncExternalStore(subscribe, getSnapshot);

  const saveConfig = useCallback((newConfig: GoogleSheetsConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      currentConfig = newConfig;
      emit();
      return true;
    } catch (error) {
      console.error('Error saving Google Sheets config:', error);
      return false;
    }
  }, []);

  const clearConfig = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      currentConfig = null;
      emit();
      return true;
    } catch (error) {
      console.error('Error clearing Google Sheets config:', error);
      return false;
    }
  }, []);

  // Validate sheets ID (should be alphanumeric, usually long)
  const isValid = useMemo(() => (config?.sheetsId?.trim().length ?? 0) > 10, [config]);

  return {
    config,
    isLoading: false,
    saveConfig,
    clearConfig,
    isValid,
  };
}
