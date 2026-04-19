/** Logs de diagnóstico apenas em desenvolvimento — evita vazar detalhes de API em produção. */
export function devError(context: string, err?: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, err);
  }
}

/** Pass-through para console.error apenas em DEV (mensagens genéricas). */
export function devConsoleError(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
}

/** Pass-through para console.warn apenas em DEV. */
export function devConsoleWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}
