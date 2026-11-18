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
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [600, 1800];

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

async function request<T>(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown): Promise<{ result: T }> {
  // POST (append/create/batchUpdate) não é idempotente: repetir após timeout/5xx pode duplicar linhas.
  // Só o 429 garante que o pedido não foi processado.
  const idempotent = method !== 'POST';

  for (let attempt = 0; ; attempt++) {
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
      if (idempotent && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
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

    const retryable = res.status === 429 || (idempotent && RETRYABLE_STATUS.has(res.status));
    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    const payload = await res.json().catch(() => ({}));
    if (res.status === 401) markSessionExpired();
    throw new SheetsApiError(
      res.status,
      payload?.error?.message || res.statusText || `Erro ${res.status}`,
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
