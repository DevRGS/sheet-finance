import { useEffect } from 'react';
import { toast } from 'sonner';
import { subscribeToQuotaWaits } from '@/services/google/sheetsRestClient';

const TOAST_ID = 'sheets-quota-wait';

function message(resumeAt: number): string {
  const seconds = Math.max(1, Math.ceil((resumeAt - Date.now()) / 1000));
  return `Limite de requisições do Google Sheets: continuando automaticamente em ~${seconds}s. Não feche a página.`;
}

/**
 * Mostra um aviso enquanto pedidos ao Google Sheets aguardam a quota por minuto
 * (60 leituras/60 escritas por usuário). Nada se perde: a fila retoma sozinha.
 */
export function SheetsQuotaNotice() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let resumeAt = 0;

    const stopTicker = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const unsubscribe = subscribeToQuotaWaits((state) => {
      if (!state.waiting) {
        stopTicker();
        toast.dismiss(TOAST_ID);
        return;
      }
      resumeAt = state.resumeAt;
      toast.loading(message(resumeAt), { id: TOAST_ID, duration: Infinity });
      if (!timer) {
        timer = setInterval(() => toast.loading(message(resumeAt), { id: TOAST_ID, duration: Infinity }), 1000);
      }
    });

    return () => {
      stopTicker();
      unsubscribe();
      toast.dismiss(TOAST_ID);
    };
  }, []);

  return null;
}
