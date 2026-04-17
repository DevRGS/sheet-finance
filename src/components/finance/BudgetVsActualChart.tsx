import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);
}

type Row = { categoria: string; limite: number; gasto: number };

export function BudgetVsActualChart() {
  const { budgets, categories, transactions, dashboardPeriod } = useFinanceContext();

  const data = useMemo<Row[]>(() => {
    const { start, end } = dashboardPeriod;
    const monthKey = start.substring(0, 7);
    const active = budgets.filter((b) => b.mes === '' || b.mes === monthKey);

    const spent: Record<string, number> = {};
    transactions
      .filter((t) => t.tipo === 'Despesa' && t.data >= start && t.data <= end)
      .forEach((t) => {
        spent[t.categoria] = (spent[t.categoria] || 0) + t.valor;
      });

    return active
      .map((b) => ({ categoria: b.categoria, limite: b.valor_limite, gasto: spent[b.categoria] || 0 }))
      .sort((a, b) => (b.gasto / (b.limite || 1)) - (a.gasto / (a.limite || 1)));
  }, [budgets, transactions, dashboardPeriod]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Orçamento vs realizado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis type="category" dataKey="categoria" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={110} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="limite" name="Limite" fill="hsl(240 3% 46% / 0.35)" radius={[4, 4, 4, 4]} />
              <Bar dataKey="gasto" name="Gasto" fill="hsl(0 72% 50%)" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

