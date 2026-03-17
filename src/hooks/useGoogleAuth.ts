import { useState, useEffect, useCallback } from 'react';
import {
  initializeGoogleAPI,
  loginWithGoogle,
  silentTokenRefresh,
  getValidToken,
  saveAuthData,
  getAuthData,
  getStoredEmail,
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

  // Initialize: restore session or attempt silent refresh
  useEffect(() => {
    const init = async () => {
      try {
        await initializeGoogleAPI();

        // Case 1: valid token already in storage
        if (isAuthenticated()) {
          const authData = getAuthData();
          setAuthState({
            isSignedIn: true,
            isLoading: false,
            error: null,
            authData,
          });
          return;
        }

        // Case 2: token expired but email stored — try silent refresh
        const storedEmail = getStoredEmail();
        if (storedEmail) {
          try {
            const newAuthData = await silentTokenRefresh(storedEmail);
            saveAuthData(newAuthData);
            setAuthState({
              isSignedIn: true,
              isLoading: false,
              error: null,
              authData: newAuthData,
            });
            return;
          } catch {
            // Silent refresh failed; user's Google session has ended
            // Fall through to "not signed in" state
          }
        }

        // Case 3: not authenticated, needs manual login
        setAuthState({
          isSignedIn: false,
          isLoading: false,
          error: null,
          authData: null,
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

  // Listen for storage changes (sync state when auth changes in another tab)
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
      await initializeGoogleAPI();
      const authData = await loginWithGoogle();
      saveAuthData(authData);
      setAuthState({
        isSignedIn: true,
        isLoading: false,
        error: null,
        authData,
      });
      return authData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearAuthData();
      setAuthState({ isSignedIn: false, isLoading: false, error: null, authData: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer logout';
      setAuthState(prev => ({ ...prev, error: errorMessage }));
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    try {
      return await getValidToken();
    } catch {
      // Token unavailable — trigger full login
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
