import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Badge } from '@/components/ui/badge';

const Categorias = () => {
  const { categories, categoryData } = useFinanceContext();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCategoryTotal = (categoryName: string) => {
    const data = categoryData.find((c) => c.categoria === categoryName);
    return data?.valor || 0;
  };

  return (
    <AppLayout>
      <AppHeader title="Categorias" />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Categorias de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => {
                const total = getCategoryTotal(category.nome);
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: category.cor }}
                      />
                      <div>
                        <p className="font-medium">{category.nome}</p>
                        {total > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(total)}
                          </p>
                        )}
                      </div>
                    </div>
                    {total > 0 && (
                      <Badge variant="secondary">
                        {categoryData.length > 0
                          ? `${((total / categoryData.reduce((sum, c) => sum + c.valor, 0)) * 100).toFixed(0)}%`
                          : '0%'}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-8 text-center">
          <p className="text-muted-foreground">
            Em breve: Criação e edição de categorias personalizadas
          </p>
        </div>
      </main>
    </AppLayout>
  );
};

export default Categorias;
