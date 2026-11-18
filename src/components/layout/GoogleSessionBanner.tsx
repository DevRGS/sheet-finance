import { Loader2, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useGoogleAuthContext } from '@/contexts/GoogleAuthContext';
import { GoogleAuthError } from '@/services/googleApiService';

/**
 * Faixa global quando o token do Google (~1h) venceu: reconecta com 1 clique,
 * sem seletor de conta. Em Configurações o cartão de conexão já mostra o mesmo.
 */
export function GoogleSessionBanner() {
  const { needsReconnect, rememberedEmail, reconnect, isLoading } = useGoogleAuthContext();
  const { pathname } = useLocation();

  if (!needsReconnect || pathname.startsWith('/configuracoes')) return null;

  const handleReconnect = async () => {
    try {
      await reconnect();
      toast.success('Conexão com o Google renovada.');
    } catch (error) {
      if (error instanceof GoogleAuthError && error.code === 'popup_closed') return;
      toast.error(error instanceof Error ? error.message : 'Não foi possível reconectar.');
    }
  };

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between md:px-6"
    >
      <span className="text-amber-800 dark:text-amber-300">
        A sessão do Google expirou{rememberedEmail ? ` (${rememberedEmail})` : ''}. Os seus dados continuam visíveis;
        reconecte para voltar a sincronizar.
      </span>
      <Button size="sm" onClick={handleReconnect} disabled={isLoading} className="h-8 shrink-0 gap-2">
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Reconectar
      </Button>
    </div>
  );
}
