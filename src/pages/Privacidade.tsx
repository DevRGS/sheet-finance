import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Privacidade() {
  return (
    <AppLayout>
      <AppHeader title="Política de privacidade" />
      <main className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">FluxioFinance</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
            <p>
              Esta política descreve como a aplicação FluxioFinance trata informações quando utiliza o serviço. O
              responsável pelo tratamento dos dados que introduz na sua conta Google é, em primeiro lugar, a Google,
              segundo as regras da própria Google. O FluxioFinance é uma aplicação que corre no seu navegador e liga-se
              à sua conta apenas quando autoriza.
            </p>

            <h3 className="text-foreground text-base font-semibold">Dados e localização</h3>
            <p>
              Os seus registos financeiros são armazenados numa planilha Google Sheets na sua área do Google Drive. O
              operador deste projeto <strong>não</strong> recebe uma cópia desses dados num servidor próprio: a
              comunicação é entre o seu navegador e os serviços Google, com o token de acesso mantido em memória durante
              a sessão (não persistimos o token de acesso em armazenamento local).
            </p>

            <h3 className="text-foreground text-base font-semibold">Finalidade</h3>
            <p>
              Os dados são tratados apenas para lhe permitir utilizar as funcionalidades do FluxioFinance (registo de
              transações, categorias, metas, etc.) na planilha que escolher ou criar. Não vendemos dados nem os utilizamos
              para publicidade.
            </p>

            <h3 className="text-foreground text-base font-semibold">Minimização</h3>
            <p>
              Pedimos permissões Google estritas ao necessário (acesso a planilhas e a ficheiros que utilizar com a app).
              Pode revogar o acesso da aplicação nas definições da sua conta Google a qualquer momento.
            </p>

            <h3 className="text-foreground text-base font-semibold">Segurança</h3>
            <p>
              Não garantimos segurança absoluta: o risco depende do seu dispositivo, extensões do navegador e da
              integridade da página que visita. Utilize sempre o endereço oficial do projeto e mantenha o sistema
              atualizado.
            </p>

            <h3 className="text-foreground text-base font-semibold">Os seus direitos (LGPD)</h3>
            <p>
              Consoante a lei aplicável, pode solicitar esclarecimentos, correção ou eliminação de dados pessoais que
              trate diretamente conosco (por exemplo, se nos contactar por email). Quanto aos dados na Google, utilize
              as ferramentas e políticas fornecidas pela Google.
            </p>

          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
