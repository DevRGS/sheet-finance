/* eslint-disable @typescript-eslint/no-explicit-any */
import { getValidToken, markSessionExpired } from '@/services/googleApiService';

/**
 * Cliente mínimo da Google Sheets API v4 sobre `fetch`.
 *
 * Substitui o gapi.client: sem script api.js nem discovery doc (centenas de KB carregados a cada visita),
 * sem iframes de proxy e compatível com a CSP de produção (connect-src https://sheets.googleapis.com).
 * Mantém a forma das respostas/erros do gapi (`{ result }`, `error.status`, `error.result.error`).
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const REQUEST_TIMEOUT_MS = 30_000;
const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 2;

// ── Quota da Sheets API ──────────────────────────────────────────────────────
// Limites do Google (por minuto): 60 leituras e 60 escritas por usuário por projeto
// (300 por projeto). https://developers.google.com/workspace/sheets/api/limits
// Ficamos um pouco abaixo para sobrar margem a outros separadores abertos.
const QUOTA_WINDOW_MS = 60_000;
const QUOTA_LIMIT: Record<QuotaKind, number> = { read: 55, write: 55 };
// Backoff recomendado pelo Google para 429: min(2^n s + até 1 s aleatório, máximo).
const MAX_BACKOFF_MS = 32_000;
const MAX_QUOTA_RETRIES = 6; // 1+2+4+8+16+32 s ≈ cobre a renovação de 1 minuto
/** Esperas abaixo disto não são mostradas na UI. */
const NOTICE_THRESHOLD_MS = 1_000;

export type QuotaKind = 'read' | 'write';

export class SheetsApiError extends Error {
  status: number;
  result: { error: { code: number; message: string; status?: string } };

  constructor(status: number, message: string, googleStatus?: string) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
    this.result = { error: { code: status, message, status: googleStatus } };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const backoffMs = (attempt: number) => Math.min(2 ** attempt * 1000 + Math.random() * 1000, MAX_BACKOFF_MS);

/** Horários dos pedidos do último minuto (janela deslizante) e pausas impostas por 429. */
const quotaHistory: Record<QuotaKind, number[]> = { read: [], write: [] };
const quotaPausedUntil: Record<QuotaKind, number> = { read: 0, write: 0 };

export interface QuotaWaitState {
  /** Há pedidos parados à espera da quota. */
  waiting: boolean;
  /** Estimativa (epoch ms) de quando a fila volta a andar. */
  resumeAt: number;
}

const quotaListeners = new Set<(state: QuotaWaitState) => void>();
let quotaWaiters = 0;
let quotaResumeAt = 0;

function emitQuotaState(): void {
  const state: QuotaWaitState = { waiting: quotaWaiters > 0, resumeAt: quotaResumeAt };
  quotaListeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      /* ignore */
    }
  });
}

/** Avisa a UI quando pedidos estão a aguardar a quota do Google Sheets. */
export function subscribeToQuotaWaits(listener: (state: QuotaWaitState) => void): () => void {
  quotaListeners.add(listener);
  return () => {
    quotaListeners.delete(listener);
  };
}

/** Pausa todos os pedidos da categoria (após 429): evita insistir enquanto o Google recusa. */
function pauseQuota(kind: QuotaKind, ms: number): void {
  quotaPausedUntil[kind] = Math.max(quotaPausedUntil[kind], Date.now() + ms);
}

/** Aguarda vaga na quota da categoria e regista o pedido na janela. */
async function acquireQuota(kind: QuotaKind): Promise<void> {
  let noticed = false;
  try {
    for (;;) {
      const now = Date.now();
      const history = quotaHistory[kind];
      while (history.length > 0 && history[0] <= now - QUOTA_WINDOW_MS) history.shift();

      const windowWait = history.length >= QUOTA_LIMIT[kind] ? history[0] + QUOTA_WINDOW_MS - now : 0;
      const wait = Math.max(windowWait, quotaPausedUntil[kind] - now);
      if (wait <= 0) {
        history.push(now);
        return;
      }

      if (wait >= NOTICE_THRESHOLD_MS) {
        if (!noticed) {
          noticed = true;
          quotaWaiters += 1;
        }
        quotaResumeAt = Math.max(quotaResumeAt, now + wait);
        emitQuotaState();
      }
      await sleep(wait + 25);
    }
  } finally {
    if (noticed) {
      quotaWaiters -= 1;
      if (quotaWaiters === 0) quotaResumeAt = 0;
      emitQuotaState();
    }
  }
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS * 2);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.min(date - Date.now(), MAX_BACKOFF_MS * 2));
}

async function request<T>(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown): Promise<{ result: T }> {
  const kind: QuotaKind = method === 'GET' ? 'read' : 'write';
  // POST (append/create/batchUpdate) não é idempotente: repetir após timeout/5xx pode duplicar linhas.
  // Só o 429 garante que o pedido não foi processado.
  const idempotent = method !== 'POST';
  let transientRetries = 0;
  let quotaRetries = 0;

  for (;;) {
    await acquireQuota(kind);
    const token = await getValidToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (idempotent && transientRetries < MAX_TRANSIENT_RETRIES) {
        await sleep(backoffMs(transientRetries++));
        continue;
      }
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      throw new SheetsApiError(
        0,
        aborted
          ? 'Tempo esgotado ao comunicar com o Google Sheets. Verifique a conexão e tente novamente.'
          : 'Falha de rede ao comunicar com o Google Sheets. Verifique a conexão e tente novamente.',
      );
    }
    clearTimeout(timer);

    if (res.ok) {
      const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
      return { result: data as T };
    }

    if (res.status === 429 && quotaRetries < MAX_QUOTA_RETRIES) {
      // Quota esgotada (por exemplo, outro separador aberto): pausa a categoria inteira e tenta de novo.
      pauseQuota(kind, parseRetryAfterMs(res.headers.get('Retry-After')) ?? backoffMs(quotaRetries));
      quotaRetries += 1;
      continue;
    }

    if (idempotent && TRANSIENT_STATUS.has(res.status) && transientRetries < MAX_TRANSIENT_RETRIES) {
      await sleep(backoffMs(transientRetries++));
      continue;
    }

    const payload = await res.json().catch(() => ({}));
    if (res.status === 401) markSessionExpired();
    throw new SheetsApiError(
      res.status,
      res.status === 429
        ? 'Limite de requisições do Google Sheets atingido. Aguarde um minuto e tente novamente.'
        : payload?.error?.message || res.statusText || `Erro ${res.status}`,
      payload?.error?.status,
    );
  }
}

const id = (spreadsheetId: string) => encodeURIComponent(spreadsheetId);
const rangePath = (range: string) => encodeURIComponent(range);

type ValueInputOption = 'RAW' | 'USER_ENTERED';

export const sheetsApi = {
  spreadsheets: {
    get: <T = any>(p: { spreadsheetId: string; fields?: string }) =>
      request<T>(
        'GET',
        `${SHEETS_BASE}/${id(p.spreadsheetId)}${p.fields ? `?fields=${encodeURIComponent(p.fields)}` : ''}`,
      ),

    create: <T = any>(p: { resource: unknown }) => request<T>('POST', SHEETS_BASE, p.resource),

    batchUpdate: <T = any>(p: { spreadsheetId: string; resource: unknown }) =>
      request<T>('POST', `${SHEETS_BASE}/${id(p.spreadsheetId)}:batchUpdate`, p.resource),

    values: {
      get: <T = any>(p: { spreadsheetId: string; range: string }) =>
        request<T>('GET', `${SHEETS_BASE}/${id(p.spreadsheetId)}/values/${rangePath(p.range)}`),

      append: <T = any>(p: {
        spreadsheetId: string;
        range: string;
        valueInputOption: ValueInputOption;
        insertDataOption?: 'INSERT_ROWS' | 'OVERWRITE';
        resource: unknown;
      }) => {
        const qs = new URLSearchParams({ valueInputOption: p.valueInputOption });
        if (p.insertDataOption) qs.set('insertDataOption', p.insertDataOption);
        return request<T>(
          'POST',
          `${SHEETS_BASE}/${id(p.spreadsheetId)}/values/${rangePath(p.range)}:append?${qs.toString()}`,
          p.resource,
        );
      },

      update: <T = any>(p: { spreadsheetId: string; range: string; valueInputOption: ValueInputOption; resource: unknown }) =>
        request<T>(
          'PUT',
          `${SHEETS_BASE}/${id(p.spreadsheetId)}/values/${rangePath(p.range)}?valueInputOption=${p.valueInputOption}`,
          p.resource,
        ),

      batchUpdate: <T = any>(p: { spreadsheetId: string; resource: unknown }) =>
        request<T>('POST', `${SHEETS_BASE}/${id(p.spreadsheetId)}/values:batchUpdate`, p.resource),
    },
  },
};
