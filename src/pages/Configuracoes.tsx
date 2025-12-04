import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Database, RefreshCw, Cloud, AlertTriangle, Eye, EyeOff, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { useGoogleSheetsConfig } from '@/hooks/useGoogleSheetsConfig';
import { toast } from 'sonner';

const Configuracoes = () => {
  const { isConnected, isInitializing, connectToSheets, loadData } = useFinanceContext();
  const { config, saveConfig, isValid, isLoading: configLoading } = useGoogleSheetsConfig();
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    serviceAccountEmail: '',
    sheetsId: '',
    privateKey: '',
  });

  // Load config into form when it's available
  useEffect(() => {
    if (config && !configLoading) {
      setFormData({
        serviceAccountEmail: config.serviceAccountEmail || '',
        sheetsId: config.sheetsId || '',
        privateKey: config.privateKey || '',
      });
    }
  }, [config, configLoading]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCredentials = async () => {
    const trimmedEmail = formData.serviceAccountEmail.trim();
    const trimmedSheetsId = formData.sheetsId.trim();
    const trimmedPrivateKey = formData.privateKey.trim();

    if (!trimmedEmail || !trimmedSheetsId || !trimmedPrivateKey) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate private key format
    if (!trimmedPrivateKey.includes('BEGIN PRIVATE KEY') || !trimmedPrivateKey.includes('END PRIVATE KEY')) {
      toast.error('A chave privada parece estar incompleta. Certifique-se de copiar a chave completa do arquivo JSON (incluindo BEGIN e END).');
      return;
    }

    // Validate email format
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      toast.error('O email da Service Account parece estar inválido.');
      return;
    }

    // Validate sheets ID (should be reasonably long)
    if (trimmedSheetsId.length < 10) {
      toast.error('O ID da planilha parece estar inválido. Verifique se copiou o ID completo da URL.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = saveConfig({
        serviceAccountEmail: trimmedEmail,
        sheetsId: trimmedSheetsId,
        privateKey: trimmedPrivateKey,
        isConnected: false,
      });

      if (saved) {
        toast.success('Credenciais salvas com sucesso!');
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
                <Button 
                  onClick={handleConnect} 
                  disabled={isInitializing || !isValid} 
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
              Configure suas credenciais do Google Cloud para conectar com o Google Sheets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceAccountEmail">
                  Email da Service Account <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="serviceAccountEmail"
                  type="email"
                  placeholder="exemplo@projeto.iam.gserviceaccount.com"
                  value={formData.serviceAccountEmail}
                  onChange={(e) => handleInputChange('serviceAccountEmail', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Copie o valor do campo <code className="px-1 py-0.5 bg-muted rounded">client_email</code> do arquivo JSON
                </p>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="privateKey">
                  Chave Privada (Private Key) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="privateKey"
                    rows={8}
                    placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                    value={formData.privateKey}
                    onChange={(e) => handleInputChange('privateKey', e.target.value)}
                    className="font-mono text-xs pr-10"
                  />
                  {formData.privateKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 h-8 w-8 p-0"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      title={showPrivateKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showPrivateKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Copie o valor completo do campo <code className="px-1 py-0.5 bg-muted rounded">private_key</code> do arquivo JSON (incluindo BEGIN e END)
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
                Salvar Credenciais
              </Button>
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
                  <p>Email: {config.serviceAccountEmail ? '✓ Preenchido' : '✗ Não preenchido'}</p>
                  <p>ID Planilha: {config.sheetsId ? '✓ Preenchido' : '✗ Não preenchido'}</p>
                  <p>Chave Privada: {config.privateKey ? '✓ Preenchida' : '✗ Não preenchida'}</p>
                </div>
              )}
            </div>

            {isValid ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertTitle>Credenciais Configuradas</AlertTitle>
                <AlertDescription>
                  Suas credenciais estão salvas e válidas. Clique em "Conectar" para estabelecer a conexão.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Credenciais Não Configuradas</AlertTitle>
                <AlertDescription>
                  Preencha todos os campos e clique em "Salvar Credenciais" antes de conectar.
                </AlertDescription>
              </Alert>
            )}

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
