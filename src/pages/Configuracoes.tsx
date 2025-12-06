import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Database, RefreshCw, Cloud, AlertTriangle, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { useGoogleSheetsConfig } from '@/hooks/useGoogleSheetsConfig';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { toast } from 'sonner';

const Configuracoes = () => {
  const { isConnected, isInitializing, connectToSheets, loadData } = useFinanceContext();
  const { config, saveConfig, isValid, isLoading: configLoading } = useGoogleSheetsConfig();
  const { isSignedIn, isLoading: authLoading, signIn, signOut, error: authError, authData } = useGoogleAuth();
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    sheetsId: '',
  });

  // Load config into form when it's available
  useEffect(() => {
    if (config && !configLoading) {
      setFormData({
        sheetsId: config.sheetsId || '',
      });
    }
  }, [config, configLoading]);

  const handleSignIn = async () => {
    try {
      const authData = await signIn();
      toast.success(`Conectado com Google com sucesso! (${authData.email})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao conectar com Google';
      toast.error(errorMessage);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Desconectado com sucesso!');
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCredentials = async () => {
    const trimmedSheetsId = formData.sheetsId.trim();

    if (!trimmedSheetsId) {
      toast.error('Preencha o ID da Planilha');
      return;
    }

    // Validate sheets ID (should be reasonably long)
    if (trimmedSheetsId.length < 10) {
      toast.error('O ID da planilha parece estar inválido. Verifique se copiou o ID completo da URL.');
      return;
    }

    setIsSaving(true);
    try {
      const currentConfig = config || { isConnected: false };
      const saved = saveConfig({
        ...currentConfig,
        sheetsId: trimmedSheetsId,
        isConnected: false,
      });

      if (saved) {
        toast.success('ID da Planilha salvo com sucesso!');
        // Force a small delay to ensure state updates
        setTimeout(() => {
          console.log('Config saved, isValid should update');
        }, 100);
      } else {
        toast.error('Erro ao salvar credenciais');
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Erro ao salvar credenciais');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    // Double check config before connecting
    if (!config || !isValid) {
      console.log('Config state:', { config, isValid, formData });
      toast.error('Configure e salve as credenciais antes de conectar');
      return;
    }

    setConnectionResult(null);
    // Reset auto-connect attempts when manually connecting
    localStorage.removeItem('auto_connect_attempts');
    const result = await connectToSheets(true);
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
                <Button 
                  onClick={handleConnect} 
                  disabled={isInitializing || !isValid || !isSignedIn} 
                  className="gap-2"
                >
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

        {/* Credentials Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Credenciais do Google Sheets
            </CardTitle>
            <CardDescription>
              Configure o ID da planilha e conecte sua conta Google para sincronizar dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sheetsId">
                  ID da Planilha <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sheetsId"
                  type="text"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={formData.sheetsId}
                  onChange={(e) => handleInputChange('sheetsId', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O ID está na URL da planilha: docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit
                </p>
              </div>

              <Button
                onClick={handleSaveCredentials}
                disabled={isSaving}
                className="w-full gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar ID da Planilha
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Autorização OAuth 2.0</span>
                </div>
              </div>

              {isSignedIn && authData ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertTitle>Conectado</AlertTitle>
                  <AlertDescription>
                    Conectado como: <strong>{authData.email}</strong>. Você pode desconectar se necessário.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Autorização Necessária</AlertTitle>
                  <AlertDescription>
                    Você precisa conectar sua conta Google para usar o Google Sheets.
                  </AlertDescription>
                </Alert>
              )}

              {authError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                {isSignedIn ? (
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="flex-1 gap-2"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    onClick={handleSignIn}
                    className="flex-1 gap-2"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="h-4 w-4" />
                    )}
                    Conectar com Google
                  </Button>
                )}
              </div>
            </div>

            {/* Status das credenciais */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status das Credenciais:</span>
                {isValid ? (
                  <span className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Válidas
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    Inválidas ou não salvas
                  </span>
                )}
              </div>
              {config && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>ID Planilha: {config.sheetsId ? '✓ Preenchido' : '✗ Não preenchido'}</p>
                  <p>Google Auth: {isSignedIn ? '✓ Conectado' : '✗ Não conectado'}</p>
                </div>
              )}
            </div>

            {isValid && isSignedIn ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertTitle>Pronto para Conectar</AlertTitle>
                <AlertDescription>
                  Suas credenciais estão salvas e você está autenticado. Clique em "Conectar" para estabelecer a conexão com o Google Sheets.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuração Incompleta</AlertTitle>
                <AlertDescription>
                  {!isValid && !isSignedIn 
                    ? 'Preencha o ID da Planilha e faça login com Google antes de conectar.'
                    : !isValid 
                    ? 'Preencha o ID da Planilha e clique em "Salvar ID da Planilha" antes de conectar.'
                    : 'Faça login com Google antes de conectar.'}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                <p>
                  Certifique-se de que a planilha foi compartilhada com a conta Google que você conectou
                  com permissão de <strong>Editor</strong>. Configure a variável de ambiente VITE_GOOGLE_CLIENT_ID
                  com o Client ID do seu projeto Google Cloud.
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
              <p className="font-medium text-foreground">3. Criar credenciais OAuth 2.0</p>
              <p>Em "Credenciais", crie credenciais OAuth 2.0 (tipo "Aplicativo da Web"). Não é necessário configurar URI de redirecionamento para client-side.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">4. Configurar Client ID</p>
              <p>Configure a variável de ambiente VITE_GOOGLE_CLIENT_ID com o Client ID do seu projeto Google Cloud.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">5. Compartilhar planilha</p>
              <p>Compartilhe sua planilha do Google Sheets com a conta Google que você conectou (como Editor).</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default Configuracoes;
