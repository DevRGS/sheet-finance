import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dados() {
  return (
    <AppLayout>
      <AppHeader title="Como os seus dados são usados" />
      <main className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Transparência</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
            <p>
              O FluxioFinance foi desenhado para que os seus dados financeiros permaneçam sob o seu controlo, na sua
              conta Google.
            </p>

            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Onde ficam os dados:</strong> nas células da planilha Google Sheets
                que associa à aplicação (criada pelo app ou indicada por si).
              </li>
              <li>
                <strong className="text-foreground">O que o navegador guarda:</strong> preferências locais não sensíveis
                (tema, ID da planilha escolhida, regras de importação, consentimento de privacidade). O token OAuth não
                é gravado em disco nesta versão.
              </li>
              <li>
                <strong className="text-foreground">O que o autor do projeto vê:</strong> não há envio automático dos seus
                lançamentos para um backend do desenvolvedor. O código é executado no seu browser; em cenários de alojamento
                estático (ex.: GitHub Pages), o servidor apenas distribui ficheiros públicos.
              </li>
              <li>
                <strong className="text-foreground">Google:</strong> ao usar login Google, aplicam-se as políticas e
                mecanismos de segurança da Google. Pode rever e revogar aplicações ligadas na sua conta Google.
              </li>
            </ul>

            <p>
              Se tiver dúvidas sobre o tratamento de dados pessoais, consulte também a{' '}
              <Link to="/privacidade" className="text-primary underline underline-offset-2">
                Política de privacidade
              </Link>{' '}
              e, se necessário, um profissional qualificado em proteção de dados.
            </p>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
