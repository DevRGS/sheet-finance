import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);
}

function monthKey(date: string) {
  return date.substring(0, 7);
}

export function CategoryTrendsChart() {
  const { transactions, categories, dashboardPeriod, dashboardView, bills, recurringTransactions } = useFinanceContext();

  const { series, keys } = useMemo(() => {
    const { start, end } = dashboardPeriod;
    const startMonth = start.substring(0, 7);
    const endMonth = end.substring(0, 7);

    const addMonths = (ym: string, n: number) => {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1 + n, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const months: string[] = [];
    let cur = startMonth;
    while (cur <= endMonth && months.length < 36) {
      months.push(cur);
      cur = addMonths(cur, 1);
    }

    const byCatByMonth: Record<string, Record<string, number>> = {};
    const add = (cat: string, ym: string, value: number) => {
      byCatByMonth[cat] = byCatByMonth[cat] || {};
      byCatByMonth[cat][ym] = (byCatByMonth[cat][ym] || 0) + value;
    };

    if (dashboardView === 'realizado') {
      transactions
        .filter((t) => t.tipo === 'Despesa' && t.data >= start && t.data <= end)
        .forEach((t) => add(t.categoria || 'Outros', monthKey(t.data), t.valor));

      bills
        .filter((b) => b.pago && b.tipo === 'pagar' && b.data_pagamento && b.data_pagamento >= start && b.data_pagamento <= end)
        .forEach((b) => add(b.categoria || 'Outros', monthKey(b.data_pagamento!), b.valor));
    } else {
      // Previsto: recorrências (despesa) + contas por vencimento
      months.forEach((ym) => {
        recurringTransactions
          .filter((rt) => rt.ativo && rt.tipo === 'Despesa')
          .forEach((rt) => {
            const rtStartMonth = rt.data_inicio.substring(0, 7);
            if (ym < rtStartMonth) return;
            const interval = rt.recorrencia === 'mensal' ? 1 :
              rt.recorrencia === 'bimestral' ? 2 :
              rt.recorrencia === 'trimestral' ? 3 :
              rt.recorrencia === 'semestral' ? 6 : 12;
            const [sy, sm] = rtStartMonth.split('-').map(Number);
            const [my, mm] = ym.split('-').map(Number);
            const diff = (my - sy) * 12 + (mm - sm);
            if (diff < 0 || diff % interval !== 0) return;
            if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && diff >= rt.meses_duracao) return;
            add(rt.categoria || 'Outros', ym, rt.valor);
          });
      });

      bills
        .filter((b) => b.tipo === 'pagar' && b.data_vencimento && b.data_vencimento >= start && b.data_vencimento <= end)
        .forEach((b) => add(b.categoria || 'Outros', monthKey(b.data_vencimento!), b.valor));
    }

    // pick Top 5 categories by total in range
    const totals = Object.entries(byCatByMonth).map(([cat, mm]) => ({
      cat,
      total: Object.values(mm).reduce((s, v) => s + v, 0),
    }));
    totals.sort((a, b) => b.total - a.total);
    const keys = totals.slice(0, 5).map((t) => t.cat);

    const series = months.map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const row: Record<string, number | string> = { month: label };
      keys.forEach((k) => {
        row[k] = byCatByMonth[k]?.[ym] || 0;
      });
      return row;
    });

    return { series, keys };
  }, [transactions, bills, recurringTransactions, dashboardPeriod, dashboardView]);

  const palette = [
    'hsl(255 91% 76%)',
    'hsl(150 60% 45%)',
    'hsl(30 90% 55%)',
    'hsl(0 72% 50%)',
    'hsl(210 90% 55%)',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Tendência (Top categorias)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
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
              {keys.map((k, idx) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

