import { useState, useEffect, useCallback } from 'react';
import {
  initializeGoogleAPI,
  loginWithGoogle,
  getValidToken,
  saveAuthData,
  getAuthData,
  clearAuthData,
  isAuthenticated,
  subscribeToAuthChanges,
  applyAuthBroadcastMessage,
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

  // Sem restaurar token de storage — credenciais só em memória (perdidas ao recarregar).
  useEffect(() => {
    const init = async () => {
      try {
        await initializeGoogleAPI();
        setAuthState({
          isSignedIn: false,
          isLoading: false,
          error: null,
          authData: null,
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error initializing Google API:', error);
        }
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

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((msg) => {
      applyAuthBroadcastMessage(msg);
      if (msg?.type === 'signed_out') {
        setAuthState((prev) => ({ ...prev, isSignedIn: false, authData: null }));
        return;
      }
      if (msg?.type === 'signed_in' || msg?.type === 'updated') {
        const authenticated = isAuthenticated();
        setAuthState((prev) => ({
          ...prev,
          isSignedIn: authenticated,
          authData: authenticated ? getAuthData() : null,
        }));
      }
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
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
      setAuthState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearAuthData();
      setAuthState({ isSignedIn: false, isLoading: false, error: null, authData: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer logout';
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    try {
      return await getValidToken();
    } catch {
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
