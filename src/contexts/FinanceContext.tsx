import { createContext, useContext, ReactNode } from 'react';
import { useFinance } from '@/hooks/useFinance';

type FinanceContextType = ReturnType<typeof useFinance>;

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const finance = useFinance();

  return (
    <FinanceContext.Provider value={finance}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceContext() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinanceContext must be used within a FinanceProvider');
  }
  return context;
}
