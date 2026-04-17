import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function DailySpendingHeatmap() {
  const { dashboardPeriod, transactions, bills, dashboardView, recurringTransactions } = useFinanceContext();

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonthKey);

    transactions.forEach((t) => months.add(t.data.substring(0, 7)));
    bills.forEach((b) => {
      if (b.data_pagamento) months.add(b.data_pagamento.substring(0, 7));
      if (b.data_vencimento) months.add(b.data_vencimento.substring(0, 7));
    });
    recurringTransactions.forEach((rt) => months.add(rt.data_inicio.substring(0, 7)));

    return Array.from(months).sort((a, b) => (a < b ? 1 : -1)).slice(0, 24);
  }, [transactions, bills, recurringTransactions, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const { monthLabel, weeks, maxAbsNet, totalExpense } = useMemo(() => {
    const start = new Date(`${selectedMonth}-01T00:00:00`);
    const monthStart = startOfMonth(start);
    const monthEnd = endOfMonth(start);

    // Build maps YYYY-MM-DD -> values
    const expenseMap: Record<string, number> = {};
    const incomeMap: Record<string, number> = {};
    const addExpense = (date: string, value: number) => {
      expenseMap[date] = (expenseMap[date] || 0) + value;
    };
    const addIncome = (date: string, value: number) => {
      incomeMap[date] = (incomeMap[date] || 0) + value;
    };

    if (dashboardView === 'realizado') {
      transactions
        .filter((t) => t.data >= fmtDate(monthStart) && t.data <= fmtDate(monthEnd))
        .forEach((t) => {
          if (t.tipo === 'Despesa') addExpense(t.data, t.valor);
          else if (t.tipo === 'Receita') addIncome(t.data, t.valor);
        });

      bills
        .filter((b) => b.pago && b.data_pagamento && b.data_pagamento >= fmtDate(monthStart) && b.data_pagamento <= fmtDate(monthEnd))
        .forEach((b) => {
          if (b.tipo === 'pagar') addExpense(b.data_pagamento!, b.valor);
          else if (b.tipo === 'receber') addIncome(b.data_pagamento!, b.valor);
        });
    } else {
      // Previsto: recorrências + contas por vencimento dentro do mês
      const monthKey = fmtDate(monthStart).substring(0, 7);
      const monthDays = monthEnd.getDate();

      // Recorrências: joga no dia de início (ajustado ao mês)
      recurringTransactions
        .filter((rt) => rt.ativo)
        .forEach((rt) => {
          const rtStartMonth = rt.data_inicio.substring(0, 7);
          if (monthKey < rtStartMonth) return;
          const interval = rt.recorrencia === 'mensal' ? 1 :
            rt.recorrencia === 'bimestral' ? 2 :
            rt.recorrencia === 'trimestral' ? 3 :
            rt.recorrencia === 'semestral' ? 6 : 12;
          const [sy, sm] = rtStartMonth.split('-').map(Number);
          const [my, mm] = monthKey.split('-').map(Number);
          const diff = (my - sy) * 12 + (mm - sm);
          if (diff < 0 || diff % interval !== 0) return;
          if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && diff >= rt.meses_duracao) return;

          const day = Math.min(parseInt(rt.data_inicio.split('-')[2], 10), monthDays);
          const date = `${monthKey}-${String(day).padStart(2, '0')}`;
          if (rt.tipo === 'Despesa') addExpense(date, rt.valor);
          else if (rt.tipo === 'Receita') addIncome(date, rt.valor);
        });

      bills
        .filter((b) => b.data_vencimento && b.data_vencimento >= fmtDate(monthStart) && b.data_vencimento <= fmtDate(monthEnd))
        .forEach((b) => {
          if (b.tipo === 'pagar') addExpense(b.data_vencimento!, b.valor);
          else if (b.tipo === 'receber') addIncome(b.data_vencimento!, b.valor);
        });
    }

    const totalExpense = Object.values(expenseMap).reduce((s, v) => s + v, 0);
    const maxExpense = Math.max(0, ...Object.values(expenseMap));

    const label = monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Build a 6-week grid starting Monday
    const weeks: Array<Array<{ date: Date; expense: number; income: number; inMonth: boolean }>> = [];
    const firstDay = new Date(monthStart);
    const dayOfWeek = firstDay.getDay(); // 0 Sun..6 Sat
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    firstDay.setDate(firstDay.getDate() - daysToMon);

    for (let w = 0; w < 6; w++) {
      const week: Array<{ date: Date; expense: number; income: number; inMonth: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(firstDay);
        cur.setDate(firstDay.getDate() + w * 7 + d);
        const key = fmtDate(cur);
        const inMonth = cur.getMonth() === monthStart.getMonth();
        week.push({ date: cur, expense: expenseMap[key] || 0, income: incomeMap[key] || 0, inMonth });
      }
      weeks.push(week);
    }

    const maxAbsNet = Math.max(
      0,
      ...weeks.flat().map((c) => Math.abs((c.income || 0) - (c.expense || 0)))
    );

    return { monthLabel: label, weeks, maxAbsNet, totalExpense };
  }, [selectedMonth, dashboardView, transactions, bills, recurringTransactions]);

  const intensity = (income: number, expense: number) => {
    if (income <= 0 && expense <= 0) return 'bg-muted/30';

    const net = income - expense;
    if (net === 0) return 'bg-muted/30';

    const denom = maxAbsNet || 1;
    const r = Math.min(Math.abs(net) / denom, 1);

    if (net > 0) {
      if (r < 0.25) return 'bg-emerald-500/20';
      if (r < 0.5) return 'bg-emerald-500/35';
      if (r < 0.75) return 'bg-emerald-500/55';
      return 'bg-emerald-500/75';
    }

    if (r < 0.25) return 'bg-rose-500/20';
    if (r < 0.5) return 'bg-rose-500/35';
    if (r < 0.75) return 'bg-rose-500/55';
    return 'bg-rose-500/75';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Heatmap de gastos (dia a dia)</CardTitle>
          <div className="w-[180px]">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => {
                  const [y, mm] = m.split('-').map(Number);
                  const label = new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                  return (
                    <SelectItem key={m} value={m}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
          <p className="text-sm font-medium">
            Total despesas: {totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell) => {
                const day = cell.date.getDate();
                const dateLabel = cell.date.toLocaleDateString('pt-BR');
                const incomeLabel = cell.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const expenseLabel = cell.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                return (
                  <Tooltip key={cell.date.toISOString()}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'h-9 rounded-md border border-border flex items-center justify-center cursor-default',
                          cell.inMonth ? 'text-foreground' : 'text-muted-foreground/50 opacity-60',
                          intensity(cell.income, cell.expense)
                        )}
                      >
                        {day}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-sm">
                      <div className="font-medium">{dateLabel}</div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Receitas</span>
                          <span className="font-medium text-emerald-600">{incomeLabel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Despesas</span>
                          <span className="font-medium text-rose-600">{expenseLabel}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Despesa</span>
          <div className="flex items-center gap-1">
            {['bg-rose-500/75', 'bg-rose-500/55', 'bg-rose-500/35', 'bg-rose-500/20', 'bg-muted/30', 'bg-emerald-500/20', 'bg-emerald-500/35', 'bg-emerald-500/55', 'bg-emerald-500/75'].map((c) => (
              <span key={c} className={cn('h-3 w-3 rounded-sm border border-border', c)} />
            ))}
          </div>
          <span>Receita</span>
        </div>
      </CardContent>
    </Card>
  );
}

