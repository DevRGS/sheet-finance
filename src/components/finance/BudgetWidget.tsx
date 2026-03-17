import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function BudgetWidget() {
  const { budgets, transactions, categories, dashboardPeriod } = useFinanceContext();

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const activeBudgets = useMemo(() => {
    return budgets.filter((b) => b.mes === '' || b.mes === currentMonth);
  }, [budgets, currentMonth]);

  const spendingByCategory = useMemo(() => {
    const { start, end } = dashboardPeriod;
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.tipo === 'Despesa' && t.data >= start && t.data <= end)
      .forEach((t) => {
        map[t.categoria] = (map[t.categoria] || 0) + t.valor;
      });
    return map;
  }, [transactions, dashboardPeriod]);

  const rows = useMemo(() => {
    return activeBudgets.map((b) => {
      const cat = categories.find((c) => c.nome === b.categoria);
      const spent = spendingByCategory[b.categoria] || 0;
      const pct = b.valor_limite > 0 ? Math.min((spent / b.valor_limite) * 100, 100) : 0;
      const over = spent > b.valor_limite;
      return { budget: b, cat, spent, pct, over };
    });
  }, [activeBudgets, spendingByCategory, categories]);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Orçamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ budget, cat, spent, pct, over }) => (
          <div key={budget.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                {cat && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.cor }}
                  />
                )}
                {budget.categoria}
              </span>
              <span className={cn('flex items-center gap-1 text-xs', over ? 'text-destructive' : 'text-muted-foreground')}>
                {over ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : pct >= 80 ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
                {formatCurrency(spent)} / {formatCurrency(budget.valor_limite)}
              </span>
            </div>
            <Progress
              value={pct}
              className={cn(
                'h-2',
                over ? '[&>div]:bg-destructive' : pct >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
              )}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
