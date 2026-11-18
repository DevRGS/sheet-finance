import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  initializeGoogleAPI,
  loginWithGoogle,
  getValidToken,
  clearAuthData,
  getAuthData,
  isTokenFresh,
  markSessionExpired,
  subscribeToSessionChanges,
  EXPIRY_BUFFER_MS,
  GoogleAuthError,
  type GoogleAuthData,
} from '@/services/googleApiService';

/**
 * - `signed_in`: token válido (restaurado do localStorage ao recarregar — sem clique).
 * - `expired`: o token de ~1h venceu; o email é lembrado e "Reconectar" leva 1 clique, sem seletor de conta.
 * - `signed_out`: nunca conectou neste navegador ou clicou em "Desconectar".
 */
export type GoogleAuthStatus = 'signed_out' | 'signed_in' | 'expired';

export function useGoogleAuth() {
  const session = useSyncExternalStore(subscribeToSessionChanges, getAuthData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-carrega o GIS em segundo plano; a sessão restaurada não depende dele.
  useEffect(() => {
    initializeGoogleAPI().catch((err) => {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o login do Google');
    });
  }, []);

  // Quando o token vencer, passa a "expirada" para a UI oferecer "Reconectar".
  useEffect(() => {
    if (!isTokenFresh(session)) {
      if (session?.accessToken) markSessionExpired();
      return;
    }
    const msUntilStale = session!.expireAt - EXPIRY_BUFFER_MS - Date.now();
    const timer = setTimeout(markSessionExpired, Math.max(0, msUntilStale));

    // Timers atrasam com o computador em suspensão: revalida ao voltar ao separador.
    const recheck = () => {
      if (document.visibilityState === 'visible' && !isTokenFresh(getAuthData())) markSessionExpired();
    };
    document.addEventListener('visibilitychange', recheck);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [session]);

  const status: GoogleAuthStatus = !session ? 'signed_out' : isTokenFresh(session) ? 'signed_in' : 'expired';

  const signIn = useCallback(async (options?: { selectAccount?: boolean }): Promise<GoogleAuthData> => {
    setIsLoading(true);
    setError(null);
    try {
      return await loginWithGoogle(options);
    } catch (err) {
      // Fechar a janela é uma escolha do usuário, não um erro a destacar.
      if (!(err instanceof GoogleAuthError && err.code === 'popup_closed')) {
        setError(err instanceof Error ? err.message : 'Erro ao fazer login');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Reconecta a conta lembrada (sem seletor de conta). */
  const reconnect = useCallback(() => signIn({ selectAccount: false }), [signIn]);

  /** Mostra o seletor de conta do Google. */
  const switchAccount = useCallback(() => signIn({ selectAccount: true }), [signIn]);

  const signOut = useCallback(async () => {
    clearAuthData();
    setError(null);
  }, []);

  return {
    status,
    isSignedIn: status === 'signed_in',
    needsReconnect: status === 'expired',
    isLoading,
    error,
    /** Sessão atual (pode estar expirada — ver `status`). */
    authData: session,
    rememberedEmail: session?.email || null,
    signIn,
    reconnect,
    switchAccount,
    signOut,
    getAccessToken: getValidToken,
  };
}
