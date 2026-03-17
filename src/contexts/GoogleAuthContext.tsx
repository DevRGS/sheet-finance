import { createContext, useContext, ReactNode } from 'react';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

type GoogleAuthContextType = ReturnType<typeof useGoogleAuth>;

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const auth = useGoogleAuth();
  return <GoogleAuthContext.Provider value={auth}>{children}</GoogleAuthContext.Provider>;
}

export function useGoogleAuthContext(): GoogleAuthContextType {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuthContext must be used within a GoogleAuthProvider');
  }
  return context;
}
