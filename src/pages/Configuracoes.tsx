import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, XCircle, Database, Key, Mail } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { toast } from 'sonner';

const configSchema = z.object({
  serviceAccountEmail: z.string().email('Email inválido'),
  sheetsId: z.string().min(1, 'ID da planilha é obrigatório'),
  privateKey: z.string().min(1, 'Chave privada é obrigatória'),
});

type ConfigFormData = z.infer<typeof configSchema>;

const Configuracoes = () => {
  const { config, connectToSheets, isLoading } = useFinanceContext();
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      serviceAccountEmail: config.serviceAccountEmail || '',
      sheetsId: config.sheetsId || '',
      privateKey: config.privateKey || '',
    },
  });

  const onSubmit = async (data: ConfigFormData) => {
    setTestResult(null);
    try {
      await connectToSheets({
        serviceAccountEmail: data.serviceAccountEmail,
        sheetsId: data.sheetsId,
        privateKey: data.privateKey,
      });
      setTestResult('success');
      toast.success('Conexão estabelecida com sucesso!');
    } catch {
      setTestResult('error');
      toast.error('Erro ao conectar. Verifique as credenciais.');
    }
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
            <div className="flex items-center gap-3">
              {config.isConnected ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-600">Conectado</p>
                    <p className="text-sm text-muted-foreground">
                      Google Sheets configurado e funcionando
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Não conectado</p>
                    <p className="text-sm text-muted-foreground">
                      Configure as credenciais abaixo para conectar
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Credenciais do Google Sheets
            </CardTitle>
            <CardDescription>
              Configure as credenciais da sua conta de serviço do Google Cloud para sincronizar
              seus dados com o Google Sheets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="serviceAccountEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email da Service Account
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="exemplo@projeto.iam.gserviceaccount.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        O email da conta de serviço criada no Google Cloud Console
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sheetsId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID da Planilha (Sheets ID)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        O ID encontrado na URL da sua planilha do Google Sheets
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="privateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave Privada (Private Key)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                          className="min-h-[150px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A chave privada do arquivo JSON baixado ao criar a conta de serviço
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {testResult && (
                  <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
                    {testResult === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {testResult === 'success' ? 'Conexão bem sucedida!' : 'Erro na conexão'}
                    </AlertTitle>
                    <AlertDescription>
                      {testResult === 'success'
                        ? 'As credenciais foram validadas e a planilha está pronta para uso.'
                        : 'Verifique se as credenciais estão corretas e se a planilha foi compartilhada com o email da Service Account.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => form.reset()}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Testar e Salvar
                  </Button>
                </div>
              </form>
            </Form>
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
              <p>Compartilhe sua planilha do Google Sheets com o email da conta de serviço.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default Configuracoes;
