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
  ReferenceLine,
} from 'recharts';

type WaterfallRow = {
  label: string;
  base: number;
  delta: number;
  kind: 'start' | 'income' | 'expense' | 'transfer' | 'end';
  value: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);
}

export function BalanceWaterfallChart() {
  const { dashboardPeriod, transactions, bills, recurringTransactions, dashboardView } = useFinanceContext();

  const data = useMemo<WaterfallRow[]>(() => {
    const { start, end } = dashboardPeriod;

    // Iniciado no começo do período (aprox): saldo de todas as transações anteriores
    // Nota: como o app não tem “saldo inicial global” persistido, usamos o acumulado histórico como baseline.
    const prevTx = transactions.filter((t) => t.data < start);
    const prevBillsPaid = bills.filter((b) => b.pago && b.data_pagamento && b.data_pagamento < start);

    const startBalance =
      prevTx.reduce((acc, t) => {
        if (t.tipo === 'Receita') return acc + t.valor;
        if (t.tipo === 'Despesa') return acc - t.valor;
        return acc; // Transferência não altera o total
      }, 0) +
      prevBillsPaid.reduce((acc, b) => (b.tipo === 'receber' ? acc + b.valor : acc - b.valor), 0);

    let incomes = 0;
    let expenses = 0;
    let transfers = 0;

    if (dashboardView === 'realizado') {
      const periodTx = transactions.filter((t) => t.data >= start && t.data <= end);
      periodTx.forEach((t) => {
        if (t.tipo === 'Receita') incomes += t.valor;
        else if (t.tipo === 'Despesa') expenses += t.valor;
        else if (t.tipo === 'Transferência') transfers += t.valor;
      });

      bills
        .filter((b) => b.pago && b.data_pagamento && b.data_pagamento >= start && b.data_pagamento <= end)
        .forEach((b) => {
          if (b.tipo === 'receber') incomes += b.valor;
          else expenses += b.valor;
        });
    } else {
      // Previsto: recorrências + contas por vencimento dentro do período
      const startMonth = start.substring(0, 7);
      const endMonth = end.substring(0, 7);

      const addMonths = (ym: string, n: number) => {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + n, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      // Somar recorrências por mês (simplificado): incluir se houver ocorrência no mês
      const months: string[] = [];
      let cur = startMonth;
      while (cur <= endMonth && months.length < 36) {
        months.push(cur);
        cur = addMonths(cur, 1);
      }

      months.forEach((month) => {
        recurringTransactions
          .filter((rt) => rt.ativo)
          .forEach((rt) => {
            // regra simples: se começa <= mês e respeita periodicidade via generateForecastTransactions já existe,
            // mas aqui evitamos depender dela (waterfall por período curto).
            const occ = rt.data_inicio.substring(0, 7);
            if (month < occ) return;
            // fallback: considerar mensal como default
            const interval = rt.recorrencia === 'mensal' ? 1 :
              rt.recorrencia === 'bimestral' ? 2 :
              rt.recorrencia === 'trimestral' ? 3 :
              rt.recorrencia === 'semestral' ? 6 : 12;
            const [sy, sm] = occ.split('-').map(Number);
            const [my, mm] = month.split('-').map(Number);
            const diff = (my - sy) * 12 + (mm - sm);
            if (diff < 0 || diff % interval !== 0) return;
            if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && diff >= rt.meses_duracao) return;

            if (rt.tipo === 'Receita') incomes += rt.valor;
            else expenses += rt.valor;
          });
      });

      bills
        .filter((b) => {
          const d = b.data_vencimento || b.data_pagamento;
          return !!d && d >= start && d <= end;
        })
        .forEach((b) => {
          if (b.tipo === 'receber') incomes += b.valor;
          else expenses += b.valor;
        });
    }

    let running = startBalance;
    const rows: WaterfallRow[] = [];

    const push = (label: string, delta: number, kind: WaterfallRow['kind']) => {
      rows.push({ label, base: running, delta, kind, value: running + delta });
      running = running + delta;
    };

    rows.push({ label: 'Início', base: 0, delta: startBalance, kind: 'start', value: startBalance });
    running = startBalance;
    push('Receitas', incomes, 'income');
    push('Despesas', -expenses, 'expense');
    // Transferência não altera saldo total, mas mostra volume (delta 0)
    push('Transferências', 0, 'transfer');
    rows.push({ label: 'Fim', base: 0, delta: running, kind: 'end', value: running });

    return rows;
  }, [dashboardPeriod, transactions, bills, recurringTransactions, dashboardView]);

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.base + d.delta)), ...data.map((d) => Math.abs(d.base)));
  const yDomain = [-maxAbs * 1.2, maxAbs * 1.2] as [number, number];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Ponte do Saldo (Waterfall)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis
                domain={yDomain}
                tickFormatter={formatCurrency}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === 'delta') return [formatCurrency(v), 'Variação'];
                  if (name === 'value') return [formatCurrency(v), 'Saldo'];
                  return [formatCurrency(v), name];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              {/* Invisible base bar to offset (stacked waterfall) */}
              <Bar dataKey="base" stackId="w" fill="transparent" />
              <Bar
                dataKey="delta"
                stackId="w"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

