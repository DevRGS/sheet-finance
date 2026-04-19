import type { GoogleAuthData } from '@/types/googleAuth';

/** Sessão OAuth apenas em RAM — perdida ao fechar o separador / recarregar. */
let session: GoogleAuthData | null = null;

const LEGACY_SESSION_KEY = 'google_auth_data';
const LEGACY_EMAIL_KEY = 'google_user_email';

export function getAuthSession(): GoogleAuthData | null {
  return session;
}

export function setAuthSession(data: GoogleAuthData): void {
  session = data;
}

export function clearAuthSession(): void {
  session = null;
}

/**
 * Remove resíduos de versões antigas que guardavam token em sessionStorage/localStorage.
 */
export function purgeLegacyAuthStorage(): void {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
