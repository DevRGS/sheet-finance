/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GoogleAuthData } from '@/types/googleAuth';
import {
  clearAuthSession,
  expireAuthSession,
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

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Sheets + Drive restrito + identidade (openid/userinfo) para obter o email sem 401 em oauth2/v2/userinfo.
 * Sem userinfo.email/openid o token não autoriza GET https://www.googleapis.com/oauth2/v2/userinfo.
 */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  SHEETS_SCOPE,
  DRIVE_FILE_SCOPE,
].join(' ');

/** Margem antes do vencimento real a partir da qual o token já é tratado como expirado. */
export const EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const GIS_LOAD_TIMEOUT_MS = 15_000;
/** Login interativo: o usuário pode demorar na tela do Google (o fecho da janela é detetado à parte). */
const INTERACTIVE_TIMEOUT_MS = 3 * 60 * 1000;
/** Renovação sem UI: a janela abre e fecha sozinha em ~1-2 s quando o consentimento já existe. */
const SILENT_TIMEOUT_MS = 20_000;
const USERINFO_TIMEOUT_MS = 8_000;

export type GoogleAuthErrorCode =
  | 'popup_closed'
  | 'popup_blocked'
  | 'access_denied'
  | 'missing_scopes'
  | 'timeout'
  | 'expired'
  | 'not_loaded'
  | 'unknown';

export class GoogleAuthError extends Error {
  code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

// ── Notificação de mudanças de sessão (mesmo separador + outros separadores) ──

const AUTH_CHANNEL = 'financeflow_auth';

type AuthBroadcastMessage =
  | { type: 'signed_out' }
  | { type: 'updated'; authData: GoogleAuthData };

const sessionListeners = new Set<() => void>();

function notifySessionChange(): void {
  sessionListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

let authChannel: BroadcastChannel | null = null;
try {
  authChannel = new BroadcastChannel(AUTH_CHANNEL);
  authChannel.onmessage = (ev: MessageEvent<AuthBroadcastMessage>) => {
    const msg = ev.data;
    if (msg?.type === 'signed_out') {
      clearAuthSession();
    } else if (msg?.type === 'updated' && msg.authData) {
      setAuthSession(msg.authData);
    } else {
      return;
    }
    notifySessionChange();
  };
} catch {
  authChannel = null; // BroadcastChannel indisponível
}

function broadcast(message: AuthBroadcastMessage): void {
  try {
    authChannel?.postMessage(message);
  } catch {
    /* ignore */
  }
}

/** Subscreve alterações da sessão (login, renovação, expiração, logout). Compatível com useSyncExternalStore. */
export function subscribeToSessionChanges(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

// ── Estado da sessão ───────────────────────────────────────────────────────

export function isTokenFresh(data: GoogleAuthData | null | undefined): boolean {
  return !!data?.accessToken && data.expireAt - EXPIRY_BUFFER_MS > Date.now();
}

export function getAuthData(): GoogleAuthData | null {
  return getAuthSession();
}

export function isAuthenticated(): boolean {
  return isTokenFresh(getAuthSession());
}

/** Grava a sessão (localStorage), avisa outros separadores e a UI. */
export function saveAuthData(authData: GoogleAuthData): void {
  setAuthSession(authData);
  broadcast({ type: 'updated', authData });
  notifySessionChange();
}

/** Logout local: apaga token e email deste navegador. */
export function clearAuthData(): void {
  clearAuthSession();
  purgeLegacyAuthStorage();
  broadcast({ type: 'signed_out' });
  notifySessionChange();
}

/** Token vencido ou revogado (401): mantém o email para "Reconectar" com 1 clique. */
export function markSessionExpired(): void {
  if (expireAuthSession()) notifySessionChange();
}

// ── Google Identity Services ───────────────────────────────────────────────

function isGisReady(): boolean {
  return !!window.google?.accounts?.oauth2;
}

let gisReadyPromise: Promise<void> | null = null;

/** Aguarda o script do Google Identity Services (carregado de forma assíncrona no index.html). */
export function initializeGoogleAPI(): Promise<void> {
  purgeLegacyAuthStorage();
  if (isGisReady()) return Promise.resolve();
  if (!gisReadyPromise) {
    gisReadyPromise = new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const check = setInterval(() => {
        if (isGisReady()) {
          clearInterval(check);
          resolve();
        } else if (Date.now() - startedAt > GIS_LOAD_TIMEOUT_MS) {
          clearInterval(check);
          gisReadyPromise = null;
          reject(
            new GoogleAuthError(
              'not_loaded',
              'Não foi possível carregar o login do Google. Verifique a conexão ou se um bloqueador de anúncios está a impedir accounts.google.com, e recarregue a página.',
            ),
          );
        }
      }, 100);
    });
  }
  return gisReadyPromise;
}

function popupError(err: any): GoogleAuthError {
  switch (err?.type) {
    case 'popup_failed_to_open':
      return new GoogleAuthError(
        'popup_blocked',
        'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.',
      );
    case 'popup_closed':
      return new GoogleAuthError('popup_closed', 'A janela de login foi fechada antes de concluir.');
    default:
      return new GoogleAuthError('unknown', err?.message || 'Erro inesperado no login do Google.');
  }
}

function oauthError(resp: any): GoogleAuthError {
  if (resp?.error === 'access_denied') {
    return new GoogleAuthError('access_denied', 'Acesso negado na tela do Google. Autorize o FluxioFinance para continuar.');
  }
  return new GoogleAuthError('unknown', `Erro do Google: ${resp?.error_description || resp?.error || 'desconhecido'}`);
}

interface TokenRequest {
  prompt: '' | 'select_account';
  loginHint?: string;
  timeoutMs: number;
}

/**
 * Abre o fluxo de token do GIS. Deve ser chamado de forma síncrona a partir de um clique
 * quando possível — navegadores bloqueiam pop-ups sem gesto do usuário.
 */
function openTokenFlow({ prompt, loginHint, timeoutMs }: TokenRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new GoogleAuthError('timeout', 'O Google demorou demais para responder. Tente novamente.'))),
      timeoutMs,
    );

    try {
      const config: Record<string, unknown> = {
        client_id: CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        prompt,
        callback: (resp: any) => finish(() => (resp?.error ? reject(oauthError(resp)) : resolve(resp))),
        error_callback: (err: any) => finish(() => reject(popupError(err))),
      };
      if (loginHint) config.login_hint = loginHint;
      window.google.accounts.oauth2.initTokenClient(config).requestAccessToken();
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new GoogleAuthError('unknown', String(error))));
    }
  });
}

async function fetchUserEmail(accessToken: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USERINFO_TIMEOUT_MS);
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return '';
    const info = await res.json();
    return typeof info?.email === 'string' ? info.email : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function toAuthData(resp: any, loginHint?: string): Promise<GoogleAuthData> {
  if (!resp?.access_token) {
    throw new GoogleAuthError('unknown', 'O Google não devolveu um token de acesso.');
  }

  // Com o consentimento granular, o usuário pode desmarcar Sheets/Drive — sem eles nada funciona.
  const oauth2 = window.google?.accounts?.oauth2;
  if (oauth2?.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(resp, SHEETS_SCOPE, DRIVE_FILE_SCOPE)) {
    throw new GoogleAuthError(
      'missing_scopes',
      'Faltam permissões: na tela do Google, marque as opções de acesso ao Google Sheets e ao Google Drive e tente novamente.',
    );
  }

  const expiresIn = Number(resp.expires_in) || 3600;
  const expireAt = Date.now() + expiresIn * 1000;
  const email = (await fetchUserEmail(resp.access_token)) || loginHint || getAuthSession()?.email || '';

  const authData: GoogleAuthData = { email, accessToken: resp.access_token, expireAt };
  saveAuthData(authData);
  return authData;
}

let inflightTokenRequest: Promise<GoogleAuthData> | null = null;

/** Pedido de token único: chamadas simultâneas (ex.: 8 leituras em paralelo) partilham a mesma janela. */
function requestToken(request: TokenRequest): Promise<GoogleAuthData> {
  if (inflightTokenRequest) return inflightTokenRequest;

  // Se o GIS já carregou, abre a janela no mesmo "tick" do clique (evita bloqueio de pop-up).
  const flow = isGisReady() ? openTokenFlow(request) : initializeGoogleAPI().then(() => openTokenFlow(request));

  inflightTokenRequest = flow
    .then((resp) => toAuthData(resp, request.loginHint))
    .finally(() => {
      inflightTokenRequest = null;
    });
  return inflightTokenRequest;
}

/**
 * Login interativo.
 * - Com sessão anterior (email conhecido) e sem `selectAccount`: reconexão rápida, sem seletor de conta;
 *   a janela do Google abre e fecha sozinha quando a autorização já foi dada.
 * - Sem sessão anterior ou com `selectAccount`: mostra o seletor de conta.
 */
export function loginWithGoogle(options: { selectAccount?: boolean } = {}): Promise<GoogleAuthData> {
  const rememberedEmail = getAuthSession()?.email;
  if (!options.selectAccount && rememberedEmail) {
    return requestToken({ prompt: '', loginHint: rememberedEmail, timeoutMs: INTERACTIVE_TIMEOUT_MS });
  }
  return requestToken({ prompt: 'select_account', timeoutMs: INTERACTIVE_TIMEOUT_MS });
}

/** O navegador só deixa abrir pop-ups logo após um clique/tecla do usuário. */
function hasRecentUserGesture(): boolean {
  const activation = (navigator as any).userActivation;
  return activation ? !!activation.isActive : true;
}

/**
 * Token válido para chamar as APIs.
 * Se venceu e houver gesto recente do usuário (ex.: clicou em "Salvar"), renova sem UI.
 * Caso contrário marca a sessão como expirada — a UI mostra "Reconectar".
 */
export async function getValidToken(): Promise<string> {
  const current = getAuthSession();
  if (isTokenFresh(current)) return current!.accessToken;

  if (current && (inflightTokenRequest || hasRecentUserGesture())) {
    try {
      const renewed = await requestToken({
        prompt: '',
        loginHint: current.email || undefined,
        timeoutMs: SILENT_TIMEOUT_MS,
      });
      return renewed.accessToken;
    } catch {
      /* cai para "sessão expirada" */
    }
  }

  if (current) markSessionExpired();
  throw new GoogleAuthError(
    'expired',
    current
      ? 'Sessão do Google expirada. Clique em "Reconectar" para continuar.'
      : 'Não autenticado. Conecte sua conta Google em Configurações.',
  );
}
