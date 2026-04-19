import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type PrivacyConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void | Promise<void>;
};

export function PrivacyConsentDialog({ open, onOpenChange, onAccept }: PrivacyConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);

  const handleContinue = async () => {
    if (!accepted) return;
    try {
      await Promise.resolve(onAccept());
      setAccepted(false);
      onOpenChange(false);
    } catch {
      // Mantém o diálogo aberto para nova tentativa
    }
  };

  const handleCancel = () => {
    setAccepted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Antes de conectar o Google</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground pt-2">
              <p>
                Os seus dados financeiros são guardados na <strong>sua</strong> conta Google (Google Sheets), não num
                servidor do autor desta aplicação.
              </p>
              <p>
                Ao conectar, o FluxioFinance pede permissão para aceder apenas ao necessário às planilhas que utilizar
                com o app. Pode revogar o acesso nas definições de segurança da conta Google quando quiser.
              </p>
              <p>
                Nenhuma solução é isenta de risco: recomendamos manter o dispositivo e o navegador atualizados e
                utilizar apenas o site oficial do projeto.
              </p>
              <p>
                Mais detalhes:{' '}
                <Link to="/privacidade" className="text-primary underline underline-offset-2" onClick={() => onOpenChange(false)}>
                  Política de privacidade
                </Link>
                {' · '}
                <Link to="/dados" className="text-primary underline underline-offset-2" onClick={() => onOpenChange(false)}>
                  Como usamos os seus dados
                </Link>
                .
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id="privacy-accept"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="privacy-accept" className="text-sm font-normal leading-snug cursor-pointer">
            Li e compreendo que os dados ficam na minha conta Google e que autorizo o acesso descrito para usar o
            FluxioFinance.
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleContinue} disabled={!accepted}>
            Aceitar e conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
