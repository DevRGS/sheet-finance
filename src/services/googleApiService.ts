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
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

// Initialize Google Identity Services
export async function initializeGoogleAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }

    // Wait for Google Identity Services to load
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(checkGoogle);
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkGoogle);
      if (!window.google?.accounts) {
        reject(new Error('Google Identity Services não carregou'));
      }
    }, 10000);
  });
}

// Login with Google using Google Identity Services
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
          // Get user info using the access token
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              'Authorization': `Bearer ${response.access_token}`,
            },
          });

          const userInfo = await userInfoResponse.json();

          // Calculate expiration time (default 1 hour)
          const expiresIn = response.expires_in || 3600;
          const expireAt = Date.now() + (expiresIn * 1000);

          const authData: GoogleAuthData = {
            email: userInfo.email || '',
            idToken: response.access_token, // Using access_token as idToken
            accessToken: response.access_token,
            expireAt: expireAt,
          };

          resolve(authData);
        } catch (error) {
          // If we can't get user info, still return the token
          const expiresIn = response.expires_in || 3600;
          const expireAt = Date.now() + (expiresIn * 1000);

          const authData: GoogleAuthData = {
            email: '',
            idToken: response.access_token,
            accessToken: response.access_token,
            expireAt: expireAt,
          };

          resolve(authData);
        }
      },
    });

    // Request access token (this will show the popup)
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// Get valid token, re-authenticate if expired
export async function getValidToken(): Promise<string> {
  const stored = localStorage.getItem('google_auth_data');
  
  if (!stored) {
    // No token stored, but don't throw - let the caller handle it
    // This allows the UI to prompt for login instead of auto-login
    throw new Error('Não autenticado. Faça login primeiro.');
  }

  try {
    const authData: GoogleAuthData = JSON.parse(stored);
    
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes
    
    if (authData.expireAt > now + buffer) {
      return authData.accessToken;
    }

    // Token expired, need to re-authenticate
    // This will show the popup automatically
    await initializeGoogleAPI();
    const newAuthData = await loginWithGoogle();
    saveAuthData(newAuthData);
    return newAuthData.accessToken;
  } catch (error) {
    // If it's already an error about not being authenticated, re-throw it
    if (error instanceof Error && error.message.includes('Não autenticado')) {
      throw error;
    }
    
    // Invalid stored data or other error, need to re-authenticate
    await initializeGoogleAPI();
    const newAuthData = await loginWithGoogle();
    saveAuthData(newAuthData);
    return newAuthData.accessToken;
  }
}

// Save auth data to localStorage
export function saveAuthData(authData: GoogleAuthData): void {
  localStorage.setItem('google_auth_data', JSON.stringify(authData));
}

// Get auth data from localStorage
export function getAuthData(): GoogleAuthData | null {
  const stored = localStorage.getItem('google_auth_data');
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as GoogleAuthData;
  } catch {
    return null;
  }
}

// Clear auth data
export function clearAuthData(): void {
  localStorage.removeItem('google_auth_data');
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const authData = getAuthData();
  if (!authData) {
    return false;
  }

  // Check if token is still valid (with 5 minute buffer)
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes
  return authData.expireAt > now + buffer;
}

