import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Database, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { toast } from 'sonner';

const Configuracoes = () => {
  const { isConnected, isInitializing, connectToSheets, loadData } = useFinanceContext();
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleConnect = async () => {
    setConnectionResult(null);
    const result = await connectToSheets();
    setConnectionResult(result);
    
    if (result.success) {
      toast.success('Conexão estabelecida com sucesso!');
    } else {
      toast.error(result.message || 'Erro ao conectar');
    }
  };

  const handleRefresh = async () => {
    await loadData();
    toast.success('Dados atualizados!');
  };

  return (
    <AppLayout>
      <AppHeader title="Configurações" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Status da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-600">Conectado</p>
                      <p className="text-sm text-muted-foreground">
                        Google Sheets configurado e sincronizado
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Não conectado</p>
                      <p className="text-sm text-muted-foreground">
                        Clique em conectar para sincronizar com Google Sheets
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                {isConnected && (
                  <Button variant="outline" onClick={handleRefresh} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar Dados
                  </Button>
                )}
                <Button onClick={handleConnect} disabled={isInitializing} className="gap-2">
                  {isInitializing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  {isConnected ? 'Reconectar' : 'Conectar'}
                </Button>
              </div>
            </div>

            {connectionResult && (
              <Alert
                className="mt-4"
                variant={connectionResult.success ? 'default' : 'destructive'}
              >
                {connectionResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {connectionResult.success ? 'Conexão bem sucedida!' : 'Erro na conexão'}
                </AlertTitle>
                <AlertDescription>{connectionResult.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Credentials Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sobre as Credenciais
            </CardTitle>
            <CardDescription>
              As credenciais do Google Sheets já estão configuradas de forma segura no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="font-medium">Credenciais Configuradas:</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Email da Service Account
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ID da Planilha
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Chave Privada
                </li>
              </ul>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                <p>
                  Certifique-se de que a planilha foi compartilhada com o email da Service Account
                  com permissão de <strong>Editor</strong>.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades Sincronizadas</CardTitle>
            <CardDescription>
              Dados que serão salvos e carregados do Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">Transações</p>
                <p className="text-sm text-muted-foreground">Aba: transacoes</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">Categorias</p>
                <p className="text-sm text-muted-foreground">Aba: categorias</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">Metas</p>
                <p className="text-sm text-muted-foreground">Aba: metas</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">Configurações</p>
                <p className="text-sm text-muted-foreground">Aba: config</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Como obter as credenciais?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">1. Criar projeto no Google Cloud</p>
              <p>Acesse console.cloud.google.com e crie um novo projeto.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">2. Habilitar API do Google Sheets</p>
              <p>No painel de APIs, busque e habilite "Google Sheets API".</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">3. Criar conta de serviço</p>
              <p>Em "Credenciais", crie uma nova conta de serviço e baixe o arquivo JSON.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">4. Compartilhar planilha</p>
              <p>Compartilhe sua planilha do Google Sheets com o email da conta de serviço (como Editor).</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default Configuracoes;
