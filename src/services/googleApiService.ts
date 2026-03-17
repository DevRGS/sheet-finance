declare global {
  interface Window {
    google: any;
  }
}

export interface GoogleAuthData {
  email: string;
  idToken: string;
  accessToken: string;
  expireAt: number;
}

const CLIENT_ID = '992015110192-5gu30mqmin256cpvdl9tdb4e6p8vonvr.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly';
const AUTH_DATA_KEY = 'google_auth_data';
const STORED_EMAIL_KEY = 'google_user_email';

// Initialize Google Identity Services
export async function initializeGoogleAPI(): Promise<void> {
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
      scope: SCOPES,
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

          const authData: GoogleAuthData = {
            email: userInfo.email || '',
            idToken: response.access_token,
            accessToken: response.access_token,
            expireAt,
          };

          resolve(authData);
        } catch {
          const expiresIn = response.expires_in || 3600;
          const expireAt = Date.now() + expiresIn * 1000;

          resolve({
            email: '',
            idToken: response.access_token,
            accessToken: response.access_token,
            expireAt,
          });
        }
      },
    });

    // Use 'select_account' to show account picker without forcing full re-consent
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

// Try to get a new token silently (no popup).
// Works when the user's Google session is still active and consent was previously granted.
export function silentTokenRefresh(loginHint: string): Promise<GoogleAuthData> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services não inicializado'));
      return;
    }

    // Give up after 10 seconds — silent auth should be fast
    const timeout = setTimeout(() => {
      reject(new Error('Tempo esgotado para autenticação silenciosa'));
    }, 10000);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
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

          resolve({
            email: userInfo.email || loginHint,
            idToken: response.access_token,
            accessToken: response.access_token,
            expireAt,
          });
        } catch {
          resolve({
            email: loginHint,
            idToken: response.access_token,
            accessToken: response.access_token,
            expireAt,
          });
        }
      },
    });

    // Empty prompt = no UI; fails if session is not active or consent missing
    tokenClient.requestAccessToken({ prompt: '', login_hint: loginHint });
  });
}

// Get valid token from cache.
// If expired, tries silent refresh using stored email.
// Throws if not authenticated — does NOT open popups.
export async function getValidToken(): Promise<string> {
  const stored = localStorage.getItem(AUTH_DATA_KEY);

  if (stored) {
    try {
      const authData: GoogleAuthData = JSON.parse(stored);
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5-minute safety buffer

      if (authData.expireAt > now + buffer) {
        return authData.accessToken;
      }
    } catch {
      // Corrupted data, fall through
    }
  }

  // Token missing or expired — attempt silent refresh before giving up
  const email = getStoredEmail();
  if (email) {
    try {
      await initializeGoogleAPI();
      const newAuthData = await silentTokenRefresh(email);
      saveAuthData(newAuthData);
      return newAuthData.accessToken;
    } catch {
      // Silent refresh failed (Google session expired); user must log in manually
    }
  }

  throw new Error('Sessão expirada. Faça login com Google para continuar.');
}

// Save auth data to localStorage (also persists email for silent refresh)
export function saveAuthData(authData: GoogleAuthData): void {
  localStorage.setItem(AUTH_DATA_KEY, JSON.stringify(authData));
  if (authData.email) {
    localStorage.setItem(STORED_EMAIL_KEY, authData.email);
  }
}

// Get auth data from localStorage
export function getAuthData(): GoogleAuthData | null {
  const stored = localStorage.getItem(AUTH_DATA_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as GoogleAuthData;
  } catch {
    return null;
  }
}

// Get the email stored for silent refresh hints
export function getStoredEmail(): string | null {
  return localStorage.getItem(STORED_EMAIL_KEY);
}

// Clear auth token (keeps email so silent refresh can be attempted next time)
export function clearAuthData(): void {
  localStorage.removeItem(AUTH_DATA_KEY);
  // Intentionally keep STORED_EMAIL_KEY so silent refresh can be attempted on next visit
}

// Check if the current stored token is still valid
export function isAuthenticated(): boolean {
  const authData = getAuthData();
  if (!authData) return false;
  const now = Date.now();
  const buffer = 5 * 60 * 1000;
  return authData.expireAt > now + buffer;
}
