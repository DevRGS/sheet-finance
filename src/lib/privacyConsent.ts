/**
 * Consentimento para conectar ao Google — valor não sensível (apenas aceite da versão do texto).
 * Não armazena dados financeiros.
 */
const STORAGE_KEY = 'fluxio_privacy_consent_v1';

export const PRIVACY_CONSENT_VERSION = '1';

export function hasGoogleConnectConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === PRIVACY_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function setGoogleConnectConsent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, PRIVACY_CONSENT_VERSION);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGoogleConnectConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
