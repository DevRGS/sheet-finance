import {
  Transaction,
  Category,
  MonthlyData,
  CategoryData,
  BalanceData,
  GoalTransaction,
  ForecastTransaction,
  Bill,
  RecurringTransaction,
} from '@/types/finance';

export const defaultCategories: Category[] = [
  { id: '1', nome: 'Alimentação', cor: '#a78bfa' },
  { id: '2', nome: 'Moradia', cor: '#c084fc' },
  { id: '3', nome: 'Transporte', cor: '#818cf8' },
  { id: '4', nome: 'Educação', cor: '#8b5cf6' },
  { id: '5', nome: 'Saúde', cor: '#737373' },
  { id: '6', nome: 'Lazer', cor: '#a855f7' },
  { id: '7', nome: 'Investimentos', cor: '#22c55e' },
  { id: '8', nome: 'Outros', cor: '#6b7280' },
];

// ─── Recurring transaction helpers ───────────────────────────────────────────

const RECURRENCE_MONTHS: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Advance a (year, month) pair by `n` months. */
function addMonthsTo(year: number, month: number, n: number): { year: number; month: number } {
  month += n;
  year += Math.floor((month - 1) / 12);
  month = ((month - 1) % 12) + 1;
  return { year, month };
}

/** Returns true if the recurring transaction has a scheduled occurrence in yearMonth (YYYY-MM). */
export function recurringOccursInMonth(rt: RecurringTransaction, yearMonth: string): boolean {
  if (!rt.ativo) return false;

  const [ty, tm] = yearMonth.split('-').map(Number);
  const [sy, sm] = rt.data_inicio.substring(0, 7).split('-').map(Number);

  // Not started yet
  if (ty < sy || (ty === sy && tm < sm)) return false;

  const diff = (ty - sy) * 12 + (tm - sm);
  const interval = RECURRENCE_MONTHS[rt.recorrencia];
  if (!interval || diff % interval !== 0) return false;

  // Ended after N months
  if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && diff >= rt.meses_duracao) return false;

  return true;
}

/**
 * Iterates over every occurrence of a recurring transaction from data_inicio
 * up to (and including) maxYearMonth, calling `callback` for each.
 */
function forEachOccurrence(
  rt: RecurringTransaction,
  maxYearMonth: string,
  callback: (yearMonth: string, occurrenceIndex: number) => void
) {
  if (!rt.ativo) return;

  const [sy, sm] = rt.data_inicio.substring(0, 7).split('-').map(Number);
  const interval = RECURRENCE_MONTHS[rt.recorrencia] || 1;

  let { year: y, month: m } = { year: sy, month: sm };
  let idx = 0;
  const SAFETY = 1200; // max 100 years of monthly recurrence

  while (idx < SAFETY) {
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (monthKey > maxYearMonth) break;

    if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && idx >= rt.meses_duracao) break;

    callback(monthKey, idx);

    ({ year: y, month: m } = addMonthsTo(y, m, interval));
    idx++;
  }
}

/** Today as YYYY-MM. */
function todayYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Iterates over every occurrence of a recurring transaction whose calculated
 * date falls within [start, end] (YYYY-MM-DD), calling `callback` for each.
 */
function forEachOccurrenceInDateRange(
  rt: RecurringTransaction,
  start: string,
  end: string,
  callback: (occurrenceDate: string, occurrenceIndex: number) => void
) {
  if (!rt.ativo) return;

  const startMonth = start.substring(0, 7);
  const endMonth = end.substring(0, 7);

  const [sy, sm] = rt.data_inicio.substring(0, 7).split('-').map(Number);
  const rtDay = parseInt(rt.data_inicio.split('-')[2], 10);
  const interval = RECURRENCE_MONTHS[rt.recorrencia] || 1;

  let { year: y, month: m } = { year: sy, month: sm };
  let idx = 0;
  const SAFETY = 1200;

  while (idx < SAFETY) {
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (monthKey > endMonth) break;
    if (rt.fim_tipo === 'after_months' && rt.meses_duracao != null && idx >= rt.meses_duracao) break;

    if (monthKey >= startMonth) {
      const daysInMonth = new Date(y, m, 0).getDate();
      const actualDay = Math.min(rtDay, daysInMonth);
      const occDate = `${y}-${String(m).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
      if (occDate >= start && occDate <= end) {
        callback(occDate, idx);
      }
    }

    ({ year: y, month: m } = addMonthsTo(y, m, interval));
    idx++;
  }
}

/**
 * Returns all occurrence dates (YYYY-MM-DD) for a recurring transaction
 * from its start date up to (and including) `upToDate`.
 */
export function getRecurringOccurrences(
  rt: RecurringTransaction,
  upToDate: string // YYYY-MM-DD
): string[] {
  const dates: string[] = [];
  forEachOccurrenceInDateRange(rt, rt.data_inicio, upToDate, (occDate) => {
    dates.push(occDate);
  });
  return dates;
}

/** Sum recurring transaction values whose occurrence falls within [start, end]. */
export function getRecurringTotalsInRange(
  recurringTransactions: RecurringTransaction[],
  start: string,
  end: string
): { receitas: number; despesas: number } {
  let receitas = 0;
  let despesas = 0;
  recurringTransactions.forEach((rt) => {
    forEachOccurrenceInDateRange(rt, start, end, () => {
      if (rt.tipo === 'Receita') receitas += rt.valor;
      else despesas += rt.valor;
    });
  });
  return { receitas, despesas };
}

// ─── getMonthlyData ───────────────────────────────────────────────────────────

export const getMonthlyData = (
  transactions: Transaction[],
  bills: Bill[] = [],
  recurringTransactions: RecurringTransaction[] = [],
  dateRange?: { start: string; end: string }
): MonthlyData[] => {
  const monthlyMap = new Map<string, { receitas: number; despesas: number }>();

  const txList = dateRange
    ? transactions.filter((t) => t.data >= dateRange.start && t.data <= dateRange.end)
    : transactions;

  txList.forEach((t) => {
    const month = t.data.substring(0, 7);
    const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
    if (t.tipo === 'Receita') current.receitas += t.valor;
    else current.despesas += t.valor;
    monthlyMap.set(month, current);
  });

  const billList = dateRange
    ? bills.filter((bill) => {
        const d =
          bill.pago && bill.data_pagamento
            ? bill.data_pagamento
            : bill.data_vencimento || new Date().toISOString().substring(0, 10);
        return d >= dateRange.start && d <= dateRange.end;
      })
    : bills;

  billList.forEach((bill) => {
    if (bill.tipo === 'pagar') {
      const dateToUse =
        bill.pago && bill.data_pagamento
          ? bill.data_pagamento
          : bill.data_vencimento || new Date().toISOString().substring(0, 10);
      const month = dateToUse.substring(0, 7);
      const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
      current.despesas += bill.valor;
      monthlyMap.set(month, current);
    } else if (bill.tipo === 'receber') {
      if (bill.pago && bill.data_pagamento) {
        const month = bill.data_pagamento.substring(0, 7);
        const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
        current.receitas += bill.valor;
        monthlyMap.set(month, current);
      }
    }
  });

  if (dateRange) {
    recurringTransactions.forEach((rt) => {
      forEachOccurrenceInDateRange(rt, dateRange.start, dateRange.end, (occDate) => {
        const monthKey = occDate.substring(0, 7);
        const current = monthlyMap.get(monthKey) || { receitas: 0, despesas: 0 };
        if (rt.tipo === 'Receita') current.receitas += rt.valor;
        else current.despesas += rt.valor;
        monthlyMap.set(monthKey, current);
      });
    });
  } else {
    const maxMonth = todayYearMonth();
    recurringTransactions.forEach((rt) => {
      forEachOccurrence(rt, maxMonth, (monthKey) => {
        const current = monthlyMap.get(monthKey) || { receitas: 0, despesas: 0 };
        if (rt.tipo === 'Receita') current.receitas += rt.valor;
        else current.despesas += rt.valor;
        monthlyMap.set(monthKey, current);
      });
    });
  }

  // Sort by YYYY-MM key for correct chronological order
  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const [year, monthNum] = month.split('-').map(Number);
      const date = new Date(year, monthNum - 1, 1);
      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.receitas - data.despesas,
      };
    });
};

// ─── getCategoryData ──────────────────────────────────────────────────────────

export const getCategoryData = (
  transactions: Transaction[],
  categories: Category[],
  bills: Bill[] = [],
  recurringTransactions: RecurringTransaction[] = [],
  dateRange?: { start: string; end: string }
): CategoryData[] => {
  const categoryMap = new Map<string, number>();

  const txList = dateRange
    ? transactions.filter((t) => t.data >= dateRange.start && t.data <= dateRange.end)
    : transactions;

  txList
    .filter((t) => t.tipo === 'Despesa')
    .forEach((t) => {
      categoryMap.set(t.categoria, (categoryMap.get(t.categoria) || 0) + t.valor);
    });

  const billList = dateRange
    ? bills.filter((bill) => {
        const d =
          bill.pago && bill.data_pagamento
            ? bill.data_pagamento
            : bill.data_vencimento || new Date().toISOString().substring(0, 10);
        return d >= dateRange.start && d <= dateRange.end;
      })
    : bills;

  billList
    .filter((bill) => bill.tipo === 'pagar')
    .forEach((bill) => {
      categoryMap.set(bill.categoria, (categoryMap.get(bill.categoria) || 0) + bill.valor);
    });

  if (dateRange) {
    recurringTransactions
      .filter((rt) => rt.tipo === 'Despesa')
      .forEach((rt) => {
        forEachOccurrenceInDateRange(rt, dateRange.start, dateRange.end, () => {
          categoryMap.set(rt.categoria, (categoryMap.get(rt.categoria) || 0) + rt.valor);
        });
      });
  } else {
    const maxMonth = todayYearMonth();
    recurringTransactions
      .filter((rt) => rt.tipo === 'Despesa')
      .forEach((rt) => {
        forEachOccurrence(rt, maxMonth, () => {
          categoryMap.set(rt.categoria, (categoryMap.get(rt.categoria) || 0) + rt.valor);
        });
      });
  }

  return Array.from(categoryMap.entries()).map(([categoria, valor]) => ({
    categoria,
    valor,
    cor: categories.find((c) => c.nome === categoria)?.cor || '#6b7280',
  }));
};

// ─── getBalanceData ───────────────────────────────────────────────────────────

export const getBalanceData = (
  transactions: Transaction[],
  goalTransactions: GoalTransaction[],
  year?: number,
  forecastTransactions?: ForecastTransaction[],
  bills: Bill[] = []
): BalanceData[] => {
  const selectedYear = year || new Date().getFullYear();
  const today = new Date();
  const currentYear = today.getFullYear();
  const isFutureYear = selectedYear > currentYear;
  const isCurrentYear = selectedYear === currentYear;

  const parseDateString = (dateString: string): { year: number; month: number; day: number } => {
    const parts = dateString.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  };

  const createDateFromString = (dateString: string): Date => {
    const { year, month, day } = parseDateString(dateString);
    return new Date(year, month - 1, day);
  };

  const filteredTransactions = transactions.filter((t) => {
    const { year } = parseDateString(t.data);
    return year === selectedYear;
  });

  const filteredGoalTransactions = goalTransactions.filter((gt) => {
    const { year } = parseDateString(gt.data);
    return year === selectedYear && gt.tipo === 'deposito';
  });

  const filteredForecastTransactions: ForecastTransaction[] = [];
  if (forecastTransactions && (isFutureYear || isCurrentYear)) {
    filteredForecastTransactions.push(
      ...forecastTransactions.filter((ft) => {
        const { year } = parseDateString(ft.data);
        if (year === selectedYear) {
          if (isCurrentYear) {
            const forecastDate = createDateFromString(ft.data);
            return forecastDate >= today;
          }
          return true;
        }
        return false;
      })
    );
  }

  let initialAccumulated = 0;
  if (selectedYear > 1) {
    const previousYear = selectedYear - 1;
    const prevYearTransactions = transactions.filter((t) => {
      const { year } = parseDateString(t.data);
      return year === previousYear;
    });

    let prevAccumulated = 0;
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${previousYear}-${String(month).padStart(2, '0')}`;
      let monthEntradas = 0;
      let monthSaidas = 0;

      prevYearTransactions.forEach((t) => {
        const tMonthKey = t.data.substring(0, 7);
        if (tMonthKey === monthKey) {
          if (t.tipo === 'Receita') monthEntradas += t.valor;
          else monthSaidas += t.valor;
        }
      });

      prevAccumulated += monthEntradas - monthSaidas;
    }

    initialAccumulated = prevAccumulated;
  }

  const monthlyMap = new Map<
    string,
    {
      entradas: number;
      saidas: number;
      investimentos: number;
      investimentos_metas: number;
      receita_prevista: number;
    }
  >();

  for (let month = 1; month <= 12; month++) {
    const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
    monthlyMap.set(monthKey, {
      entradas: 0,
      saidas: 0,
      investimentos: 0,
      investimentos_metas: 0,
      receita_prevista: 0,
    });
  }

  filteredTransactions.forEach((t) => {
    const monthKey = t.data.substring(0, 7);
    if (!monthKey.startsWith(`${selectedYear}-`)) return;
    const current = monthlyMap.get(monthKey);
    if (!current) return;

    if (t.tipo === 'Receita') {
      current.entradas += t.valor;
    } else {
      current.saidas += t.valor;
      if (t.categoria === 'Investimentos') current.investimentos += t.valor;
    }
    monthlyMap.set(monthKey, current);
  });

  filteredGoalTransactions.forEach((gt) => {
    const monthKey = gt.data.substring(0, 7);
    if (!monthKey.startsWith(`${selectedYear}-`)) return;
    const current = monthlyMap.get(monthKey);
    if (!current) return;
    current.investimentos_metas += gt.valor;
    monthlyMap.set(monthKey, current);
  });

  filteredForecastTransactions.forEach((ft) => {
    const monthKey = ft.data.substring(0, 7);
    if (!monthKey.startsWith(`${selectedYear}-`)) return;
    const current = monthlyMap.get(monthKey);
    if (!current) return;

    if (ft.tipo === 'Receita') {
      current.entradas += ft.valor;
    } else {
      current.saidas += ft.valor;
      if (ft.categoria === 'Investimentos') current.investimentos += ft.valor;
    }
    monthlyMap.set(monthKey, current);
  });

  bills.forEach((bill) => {
    if (bill.tipo === 'pagar') {
      const dateToUse =
        bill.pago && bill.data_pagamento
          ? bill.data_pagamento
          : bill.data_vencimento || new Date().toISOString().substring(0, 10);

      const { year: billYear } = parseDateString(dateToUse);
      if (billYear !== selectedYear) return;

      const monthKey = dateToUse.substring(0, 7);
      if (!monthKey.startsWith(`${selectedYear}-`)) return;

      const current = monthlyMap.get(monthKey);
      if (!current) return;
      current.saidas += bill.valor;
      monthlyMap.set(monthKey, current);
    } else if (bill.tipo === 'receber') {
      if (bill.pago && bill.data_pagamento) {
        const { year: billYear } = parseDateString(bill.data_pagamento);
        if (billYear !== selectedYear) return;

        const monthKey = bill.data_pagamento.substring(0, 7);
        if (!monthKey.startsWith(`${selectedYear}-`)) return;

        const current = monthlyMap.get(monthKey);
        if (!current) return;
        current.entradas += bill.valor;
        monthlyMap.set(monthKey, current);
      } else {
        const dateToUse =
          bill.data_vencimento || new Date().toISOString().substring(0, 10);
        const { year: billYear } = parseDateString(dateToUse);
        if (billYear !== selectedYear) return;

        const monthKey = dateToUse.substring(0, 7);
        if (!monthKey.startsWith(`${selectedYear}-`)) return;

        const current = monthlyMap.get(monthKey);
        if (!current) return;
        current.receita_prevista += bill.valor;
        monthlyMap.set(monthKey, current);
      }
    }
  });

  const finalBalanceData: BalanceData[] = [];
  let accumulated = initialAccumulated;

  for (let month = 1; month <= 12; month++) {
    const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
    const monthKeyYear = parseInt(monthKey.substring(0, 4));
    if (monthKeyYear !== selectedYear) continue;

    const monthData = monthlyMap.get(monthKey);
    const monthDate = new Date(selectedYear, month - 1, 1);
    const monthLabel = monthDate.toLocaleDateString('pt-BR', {
      month: 'short',
      year: '2-digit',
    });

    if (monthData) {
      const saldo = monthData.entradas - monthData.saidas;
      accumulated += saldo;

      finalBalanceData.push({
        month: monthLabel,
        monthKey,
        entradas: monthData.entradas,
        saidas: monthData.saidas,
        investimentos: monthData.investimentos,
        investimentos_metas: monthData.investimentos_metas,
        saldo,
        saldo_acumulado: accumulated,
        receita_prevista: monthData.receita_prevista || 0,
      });
    } else {
      finalBalanceData.push({
        month: monthLabel,
        monthKey,
        entradas: 0,
        saidas: 0,
        investimentos: 0,
        investimentos_metas: 0,
        saldo: 0,
        saldo_acumulado: accumulated,
        receita_prevista: 0,
      });
    }
  }

  const verified = finalBalanceData.filter(
    (item) => parseInt(item.monthKey.substring(0, 4)) === selectedYear
  );

  return verified.length === 12 ? verified : finalBalanceData;
};
