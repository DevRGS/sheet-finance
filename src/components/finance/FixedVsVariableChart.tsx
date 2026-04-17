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

type Row = { label: string; fixo: number; variavel: number };

export function FixedVsVariableChart() {
  const { dashboardPeriod, dashboardView, transactions, bills, recurringTransactions } = useFinanceContext();

  const data = useMemo<Row[]>(() => {
    const { start, end } = dashboardPeriod;

    if (dashboardView !== 'realizado') {
      // Para previsto, o conceito de “variável” depende de heurística (média histórica).
      // Mantemos simples: fixo = recorrências + contas por vencimento; variável = 0.
      let fixo = 0;

      // Recorrências (despesa) no período (aprox por mês)
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
            fixo += rt.valor;
          });
      });

      bills
        .filter((b) => b.tipo === 'pagar' && b.data_vencimento && b.data_vencimento >= start && b.data_vencimento <= end)
        .forEach((b) => { fixo += b.valor; });

      return [{ label: 'Previsto', fixo, variavel: 0 }];
    }

    // Realizado
    const periodExpenses = transactions.filter((t) => t.tipo === 'Despesa' && t.data >= start && t.data <= end);
    const fixoTx = periodExpenses.filter((t) => !!t.recorrente_id).reduce((s, t) => s + t.valor, 0);
    const totalTx = periodExpenses.reduce((s, t) => s + t.valor, 0);

    const fixoBills = bills
      .filter((b) => b.pago && b.tipo === 'pagar' && b.data_pagamento && b.data_pagamento >= start && b.data_pagamento <= end)
      .reduce((s, b) => s + b.valor, 0);

    const fixo = fixoTx + fixoBills;
    const variavel = Math.max(0, totalTx - fixoTx); // bills tratados como fixo por simplicidade

    return [{ label: 'Realizado', fixo, variavel }];
  }, [dashboardPeriod, dashboardView, transactions, bills, recurringTransactions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Fixo vs variável</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
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
              <Bar dataKey="fixo" name="Fixo" stackId="a" fill="hsl(270 95% 75%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="variavel" name="Variável" stackId="a" fill="hsl(30 90% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

