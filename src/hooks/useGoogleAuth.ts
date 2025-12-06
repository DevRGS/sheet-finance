import { useState, useEffect, useCallback } from 'react';
import {
  initializeGoogleAPI,
  loginWithGoogle,
  getValidToken,
  saveAuthData,
  getAuthData,
  clearAuthData,
  isAuthenticated,
  type GoogleAuthData,
} from '@/services/googleApiService';

interface GoogleAuthState {
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  authData: GoogleAuthData | null;
}

export function useGoogleAuth() {
  const [authState, setAuthState] = useState<GoogleAuthState>({
    isSignedIn: false,
    isLoading: true,
    error: null,
    authData: null,
  });

  // Initialize Google API on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeGoogleAPI();
        
        // Check if user is already authenticated
        const authData = getAuthData();
        const authenticated = isAuthenticated();

        setAuthState({
          isSignedIn: authenticated,
          isLoading: false,
          error: null,
          authData: authenticated ? authData : null,
        });
      } catch (error) {
        console.error('Error initializing Google API:', error);
        setAuthState({
          isSignedIn: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Erro ao inicializar Google API',
          authData: null,
        });
      }
    };

    init();
  }, []);

  // Listen for storage changes (when auth data is updated in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_auth_data') {
        const authData = getAuthData();
        const authenticated = isAuthenticated();
        
        setAuthState(prev => ({
          ...prev,
          isSignedIn: authenticated,
          authData: authenticated ? authData : null,
        }));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const signIn = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Ensure Google API is initialized
      await initializeGoogleAPI();

      // Login with Google
      const authData = await loginWithGoogle();

      // Save to localStorage
      saveAuthData(authData);

      setAuthState({
        isSignedIn: true,
        isLoading: false,
        error: null,
        authData: authData,
      });

      return authData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearAuthData();
      setAuthState({
        isSignedIn: false,
        isLoading: false,
        error: null,
        authData: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer logout';
      setAuthState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    try {
      return await getValidToken();
    } catch (error) {
      // If token is invalid, try to re-authenticate
      const authData = await signIn();
      return authData.accessToken;
    }
  }, [signIn]);

  return {
    ...authState,
    signIn,
    signOut,
    getAccessToken,
  };
}
