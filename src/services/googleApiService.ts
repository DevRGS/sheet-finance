/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GoogleAuthData } from '@/types/googleAuth';
import {
  clearAuthSession,
  getAuthSession,
  purgeLegacyAuthStorage,
  setAuthSession,
} from '@/services/google/googleAuthSession';

declare global {
  interface Window {
    google: any;
  }
}

export type { GoogleAuthData };

const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '818883045223-qn1jk1r9bg4mn847ntso5fdo9sda3bg5.apps.googleusercontent.com';

/**
 * Sheets + Drive restrito + identidade (openid/userinfo) para obter o email sem 401 em oauth2/v2/userinfo.
 * Sem userinfo.email/openid o token não autoriza GET https://www.googleapis.com/oauth2/v2/userinfo.
 */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const AUTH_CHANNEL = 'financeflow_auth';

export type AuthBroadcastMessage =
  | { type: 'signed_in'; authData: GoogleAuthData }
  | { type: 'signed_out' }
  | { type: 'updated'; authData: GoogleAuthData };

function broadcast(message: AuthBroadcastMessage) {
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore if BroadcastChannel is not available
  }
}

/** Aplica mensagem de outro separador — atualiza apenas memória (não persistência). */
export function applyAuthBroadcastMessage(msg: AuthBroadcastMessage): void {
  if (msg.type === 'signed_out') {
    clearAuthSession();
    return;
  }
  if (msg.type === 'signed_in' || msg.type === 'updated') {
    setAuthSession(msg.authData);
  }
}

// Initialize Google Identity Services
export async function initializeGoogleAPI(): Promise<void> {
  purgeLegacyAuthStorage();

  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }

    const checkGoogle = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(checkGoogle);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkGoogle);
      if (!window.google?.accounts) {
        reject(new Error('Google Identity Services não carregou'));
      }
    }, 10000);
  });
}

// Login with Google using Google Identity Services (shows account picker)
export function loginWithGoogle(): Promise<GoogleAuthData> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services não inicializado. Chame initializeGoogleAPI() primeiro.'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: GOOGLE_OAUTH_SCOPES,
      callback: async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          });
          const userInfo = await userInfoResponse.json();

          const expiresIn = response.expires_in || 3600;
          const expireAt = Date.now() + expiresIn * 1000;

          const email =
            userInfoResponse.ok && typeof userInfo.email === 'string' ? userInfo.email : '';

          const authData: GoogleAuthData = {
            email,
            accessToken: response.access_token,
            expireAt,
          };

          resolve(authData);
        } catch {
          const expiresIn = response.expires_in || 3600;
          const expireAt = Date.now() + expiresIn * 1000;

          resolve({
            email: '',
            accessToken: response.access_token,
            expireAt,
          });
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

// Silent token refresh — usa apenas email já conhecido na sessão em memória (mesmo separador).
export function silentTokenRefresh(loginHint: string): Promise<GoogleAuthData> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services não inicializado'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Tempo esgotado para autenticação silenciosa'));
    }, 10000);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: GOOGLE_OAUTH_SCOPES,
      callback: async (response: any) => {
        clearTimeout(timeout);

        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        const expiresIn = response.expires_in || 3600;
        const expireAt = Date.now() + expiresIn * 1000;

        try {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          });
          const userInfo = await userInfoRes.json();

          const email =
            userInfoRes.ok && typeof userInfo.email === 'string'
              ? userInfo.email
              : loginHint;

          resolve({
            email,
            accessToken: response.access_token,
            expireAt,
          });
        } catch {
          resolve({
            email: loginHint,
            accessToken: response.access_token,
            expireAt,
          });
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: '', login_hint: loginHint });
  });
}

// Get valid token from in-memory session; silent refresh só com email já em sessão.
export async function getValidToken(): Promise<string> {
  const authData = getAuthSession();
  const now = Date.now();
  const buffer = 5 * 60 * 1000;

  if (authData && authData.expireAt > now + buffer) {
    return authData.accessToken;
  }

  if (authData?.email) {
    try {
      await initializeGoogleAPI();
      const newAuthData = await silentTokenRefresh(authData.email);
      saveAuthData(newAuthData);
      return newAuthData.accessToken;
    } catch {
      // Silent refresh failed
    }
  }

  throw new Error('Sessão expirada. Faça login com Google para continuar.');
}

/** Grava apenas em memória e notifica outros separadores (sem persistir token). */
export function saveAuthData(authData: GoogleAuthData): void {
  setAuthSession(authData);
  broadcast({ type: 'updated', authData });
}

export function getAuthData(): GoogleAuthData | null {
  return getAuthSession();
}

export function clearAuthData(): void {
  clearAuthSession();
  purgeLegacyAuthStorage();
  broadcast({ type: 'signed_out' });
}

export function isAuthenticated(): boolean {
  const authData = getAuthSession();
  if (!authData) return false;
  const now = Date.now();
  const buffer = 5 * 60 * 1000;
  return authData.expireAt > now + buffer;
}

export function subscribeToAuthChanges(onMessage: (msg: AuthBroadcastMessage) => void): () => void {
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (ev) => onMessage(ev.data as AuthBroadcastMessage);
    return () => channel.close();
  } catch {
    return () => {};
  }
}
