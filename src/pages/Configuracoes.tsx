import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Database, Cloud,
  AlertTriangle, Plus, FileSpreadsheet, Sun, Moon,
  ArrowRightLeft, Tags, Target, Landmark, PiggyBank, Settings2,
  Layers, Info,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { useGoogleSheetsConfig } from '@/hooks/useGoogleSheetsConfig';
import { useGoogleAuthContext } from '@/contexts/GoogleAuthContext';
import { listSpreadsheets, createSpreadsheet, SpreadsheetItem } from '@/services/googleSheetsGapi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FINANCE_FLOW_NAME = 'FinanceFlow';
const AUTO_CONNECT_KEY = 'auto_connect_attempts';

// ─────────────────────────────────────────────────────────────────────────────
// Appearance card
// ─────────────────────────────────────────────────────────────────────────────

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5" />
          Aparência
        </CardTitle>
        <CardDescription>
          Escolha o tema visual da aplicação. A preferência é salva automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:bg-accent',
              theme === 'light'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Sun className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className={cn('text-sm font-semibold', theme === 'light' && 'text-primary')}>
                Claro
              </p>
              <p className="text-xs text-muted-foreground">Fundo branco</p>
            </div>
            {theme === 'light' && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:bg-accent',
              theme === 'dark'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-900/40 text-violet-400">
              <Moon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className={cn('text-sm font-semibold', theme === 'dark' && 'text-primary')}>
                Escuro
              </p>
              <p className="text-xs text-muted-foreground">Fundo escuro</p>
            </div>
            {theme === 'dark' && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const SYNCED_SHEETS = [
  { icon: ArrowRightLeft, label: 'Transações',       tab: 'transacoes',       desc: 'Receitas e despesas' },
  { icon: Tags,           label: 'Categorias',       tab: 'categorias',       desc: 'Organização por tipo' },
  { icon: Target,         label: 'Metas',            tab: 'metas',            desc: 'Objetivos financeiros' },
  { icon: Landmark,       label: 'Contas',           tab: 'contas_bancarias', desc: 'Contas bancárias' },
  { icon: PiggyBank,      label: 'Orçamentos',       tab: 'orcamentos',       desc: 'Limites por categoria' },
  { icon: FileSpreadsheet,label: 'Recorrências',     tab: 'recorrencias',     desc: 'Lançamentos automáticos' },
  { icon: Settings2,      label: 'Contas a pagar',   tab: 'contas_pagar',     desc: 'Bills e recebíveis' },
  { icon: Layers,         label: 'Configurações',    tab: 'config',           desc: 'Parâmetros gerais' },
];

const Configuracoes = () => {
  const { isConnected, isInitializing, connectionError, retryConnection } = useFinanceContext();
  const { config, saveConfig, isValid } = useGoogleSheetsConfig();
  const { isSignedIn, isLoading: authLoading, signIn, signOut, error: authError, authData } =
    useGoogleAuthContext();

  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetItem[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  const handleLoadSpreadsheets = useCallback(async () => {
    setIsLoadingSheets(true);
    setSheetsError(null);
    try {
      const sheets = await listSpreadsheets();
      setSpreadsheets(sheets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao listar planilhas';
      setSheetsError(message);
    } finally {
      setIsLoadingSheets(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      handleLoadSpreadsheets();
    } else {
      setSpreadsheets([]);
      setSheetsError(null);
    }
  }, [isSignedIn, handleLoadSpreadsheets]);

  const handleSelectSpreadsheet = (id: string) => {
    const currentConfig = config || { isConnected: false };
    const saved = saveConfig({ ...currentConfig, sheetsId: id, isConnected: false });
    if (saved) {
      localStorage.removeItem(AUTO_CONNECT_KEY);
      toast.success('Planilha selecionada! Inicializando e carregando dados...');
    }
  };

  const handleCreateSpreadsheet = async () => {
    setIsCreating(true);
    try {
      const spreadsheetId = await createSpreadsheet(FINANCE_FLOW_NAME);
      await handleLoadSpreadsheets();
      const currentConfig = config || { isConnected: false };
      saveConfig({ ...currentConfig, sheetsId: spreadsheetId, isConnected: false });
      localStorage.removeItem(AUTO_CONNECT_KEY);
      toast.success(`Planilha "${FINANCE_FLOW_NAME}" criada! Inicializando estrutura...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar planilha';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await signIn();
      toast.success(`Conectado como ${result.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao conectar com Google');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Desconectado com sucesso!');
    } catch {
      toast.error('Erro ao desconectar');
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Configurações" />

      <main className="flex-1 space-y-6 p-4 md:p-6 max-w-3xl mx-auto w-full">

        {/* ── Aparência ─────────────────────────────────────────────────────── */}
        <AppearanceCard />

        {/* ── Conexão Google Sheets ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Conexão com Google Sheets
            </CardTitle>
            <CardDescription>
              Todos os seus dados são salvos diretamente no Google Drive — sem banco de dados externo.
              Conecte sua conta e escolha (ou crie) a planilha que o FinanceFlow vai usar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Auth section */}
            <div className="space-y-3">
              {isSignedIn && authData ? (
                <Alert className="border-emerald-500/40 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertTitle className="text-emerald-700 dark:text-emerald-400">Conta conectada</AlertTitle>
                  <AlertDescription>
                    Autenticado como <strong>{authData.email}</strong>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Autorização necessária</AlertTitle>
                  <AlertDescription>
                    Conecte sua conta Google para listar e selecionar uma planilha.
                  </AlertDescription>
                </Alert>
              )}

              {authError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro de autenticação</AlertTitle>
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              {isSignedIn ? (
                <Button onClick={handleSignOut} variant="outline" className="w-full gap-2" disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Desconectar conta Google
                </Button>
              ) : (
                <Button onClick={handleSignIn} className="w-full gap-2" disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  Conectar com Google
                </Button>
              )}
            </div>

            {/* Spreadsheet picker */}
            {isSignedIn && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Planilhas no Drive</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Selecione a planilha de destino</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadSpreadsheets}
                      disabled={isLoadingSheets}
                      className="gap-1 h-8 text-xs"
                    >
                      <RefreshCw className={cn('h-3 w-3', isLoadingSheets && 'animate-spin')} />
                      Atualizar
                    </Button>
                  </div>

                  {isLoadingSheets ? (
                    <div className="flex items-center justify-center rounded-lg border p-6 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm">Carregando planilhas…</span>
                    </div>
                  ) : sheetsError ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Erro ao carregar planilhas</AlertTitle>
                      <AlertDescription>{sheetsError}</AlertDescription>
                    </Alert>
                  ) : spreadsheets.length > 0 ? (
                    <div className="space-y-1 max-h-56 overflow-y-auto rounded-lg border p-1">
                      {spreadsheets.map((sheet) => {
                        const isSelected = config?.sheetsId === sheet.id;
                        return (
                          <button
                            key={sheet.id}
                            type="button"
                            onClick={() => handleSelectSpreadsheet(sheet.id)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent',
                              isSelected && 'bg-primary/10 border border-primary/30'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isSelected ? (
                                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : (
                                <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className={cn('text-sm truncate', isSelected && 'font-medium text-primary')}>
                                {sheet.name}
                              </span>
                            </div>
                            {isSelected && (
                              <Badge variant="default" className="ml-2 text-xs flex-shrink-0">Selecionada</Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-muted-foreground">
                      <FileSpreadsheet className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma planilha encontrada no Drive</p>
                      <p className="text-xs mt-1 opacity-70">Crie uma nova abaixo</p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleCreateSpreadsheet}
                    disabled={isCreating || isLoadingSheets}
                    className="w-full gap-2"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Criar nova planilha "{FINANCE_FLOW_NAME}"
                  </Button>
                </div>
              </>
            )}

            {/* Connection status */}
            {isInitializing ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Inicializando planilha…</AlertTitle>
                <AlertDescription>
                  Verificando estrutura e criando as abas necessárias. Isso pode levar alguns segundos.
                </AlertDescription>
              </Alert>
            ) : isConnected ? (
              <Alert className="border-emerald-500/50 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">Sincronizado com sucesso</AlertTitle>
                <AlertDescription>
                  Dados carregados da planilha selecionada. Todas as alterações são salvas automaticamente.
                </AlertDescription>
              </Alert>
            ) : connectionError ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Falha na conexão</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{connectionError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { retryConnection(); }}
                    className="mt-2 gap-2 border-destructive/50 hover:bg-destructive/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : isValid && isSignedIn ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Conectando automaticamente…</AlertTitle>
                <AlertDescription>
                  Estabelecendo conexão com a planilha selecionada.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuração incompleta</AlertTitle>
                <AlertDescription>
                  {!isSignedIn
                    ? 'Conecte sua conta Google para continuar.'
                    : 'Selecione uma planilha existente ou crie uma nova acima.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* ── Dados sincronizados ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Dados sincronizados
            </CardTitle>
            <CardDescription>
              Cada item abaixo corresponde a uma aba da planilha no Google Drive. A estrutura é criada automaticamente na primeira conexão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SYNCED_SHEETS.map(({ icon: Icon, label, tab, desc }) => (
                <div
                  key={tab}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Guia de configuração ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Como configurar? — Guia passo a passo
            </CardTitle>
            <CardDescription>
              Em poucos cliques você conecta o FinanceFlow ao seu Google Drive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-6">
              <li className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  01
                </div>
                <div className="space-y-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">Conecte sua conta Google</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Clique em <strong>Conectar com Google</strong> acima e faça login com a conta que você usa no Google Drive.
                  </p>
                </div>
              </li>

              <li className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  02
                </div>
                <div className="space-y-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">Escolha uma planilha</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Selecione uma planilha da lista (ou crie uma nova). A estrutura de abas é criada automaticamente na primeira conexão.
                  </p>
                </div>
              </li>

              <li className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  03
                </div>
                <div className="space-y-2 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">Crie sua primeira conta e transação</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Com a planilha conectada, cadastre uma conta (banco/carteira/cartão) e registre suas primeiras entradas e saídas.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={`${import.meta.env.BASE_URL}contas`}>Ir para Contas</a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={`${import.meta.env.BASE_URL}transacoes`}>Ir para Transações</a>
                    </Button>
                  </div>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

      </main>
    </AppLayout>
  );
};

export default Configuracoes;
