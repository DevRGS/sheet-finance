import type { GoogleAuthData } from '@/types/googleAuth';

/**
 * Sessão OAuth guardada no localStorage deste navegador para sobreviver a recarregamentos.
 *
 * O access token do Google vale ~1h e não há refresh token (app 100% estática, sem backend).
 * Quando o token vence, mantemos apenas o email: ele serve de `login_hint` para reconectar
 * com 1 clique, sem seletor de conta. "Desconectar" apaga tudo.
 */
const SESSION_KEY = 'fluxio_google_session_v1';

const LEGACY_SESSION_KEY = 'google_auth_data';
const LEGACY_EMAIL_KEY = 'google_user_email';

function isAuthData(value: unknown): value is GoogleAuthData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === 'string' && typeof v.accessToken === 'string' && typeof v.expireAt === 'number';
}

function readStoredSession(): GoogleAuthData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(data: GoogleAuthData | null): void {
  try {
    if (data) localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* modo privado / quota — a sessão continua válida em memória */
  }
}

let session: GoogleAuthData | null = readStoredSession();

export function getAuthSession(): GoogleAuthData | null {
  return session;
}

export function setAuthSession(data: GoogleAuthData): void {
  session = data;
  writeStoredSession(data);
}

export function clearAuthSession(): void {
  session = null;
  writeStoredSession(null);
}

/** Descarta o token (vencido ou revogado) mas mantém o email para reconexão rápida. */
export function expireAuthSession(): boolean {
  if (!session || (!session.accessToken && session.expireAt === 0)) return false;
  session = { ...session, accessToken: '', expireAt: 0 };
  writeStoredSession(session);
  return true;
}

/**
 * Remove resíduos de versões antigas que guardavam token com outras chaves.
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
