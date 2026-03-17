import { createContext, useContext, ReactNode } from 'react';
import { useFinance } from '@/hooks/useFinance';
import { useGoogleAuthContext } from '@/contexts/GoogleAuthContext';

type FinanceContextType = ReturnType<typeof useFinance>;

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  // Consume the shared auth state so auto-connect reacts to sign-in/silent-refresh
  const { isSignedIn } = useGoogleAuthContext();
  const finance = useFinance(isSignedIn);

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
