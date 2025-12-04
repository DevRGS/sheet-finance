import { Transaction, Category, MonthlyData, CategoryData, BalanceData, GoalTransaction, ForecastTransaction } from '@/types/finance';

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

export const getMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
  const monthlyMap = new Map<string, { receitas: number; despesas: number }>();

  transactions.forEach((t) => {
    const month = t.data.substring(0, 7);
    const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };

    if (t.tipo === 'Receita') {
      current.receitas += t.valor;
    } else {
      current.despesas += t.valor;
    }

    monthlyMap.set(month, current);
  });

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receitas: data.receitas,
      despesas: data.despesas,
      saldo: data.receitas - data.despesas,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const getCategoryData = (transactions: Transaction[], categories: Category[]): CategoryData[] => {
  const categoryMap = new Map<string, number>();

  transactions
    .filter((t) => t.tipo === 'Despesa')
    .forEach((t) => {
      const current = categoryMap.get(t.categoria) || 0;
      categoryMap.set(t.categoria, current + t.valor);
    });

  return Array.from(categoryMap.entries()).map(([categoria, valor]) => ({
    categoria,
    valor,
    cor: categories.find((c) => c.nome === categoria)?.cor || '#6b7280',
  }));
};

export const getBalanceData = (
  transactions: Transaction[],
  goalTransactions: GoalTransaction[],
  year?: number,
  forecastTransactions?: ForecastTransaction[]
): BalanceData[] => {
  const selectedYear = year || new Date().getFullYear();
  const today = new Date();
  const currentYear = today.getFullYear();
  const isFutureYear = selectedYear > currentYear;
  const isCurrentYear = selectedYear === currentYear;

  // Helper function to parse date string safely (avoid timezone issues)
  const parseDateString = (dateString: string): { year: number; month: number; day: number } => {
    // Date string is in format "YYYY-MM-DD"
    const parts = dateString.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  };

  // Helper function to create date object without timezone issues
  const createDateFromString = (dateString: string): Date => {
    const { year, month, day } = parseDateString(dateString);
    // Use local time to avoid timezone conversion issues
    return new Date(year, month - 1, day);
  };

  // Filter transactions by year - use string parsing to avoid timezone issues
  const filteredTransactions = transactions.filter((t) => {
    const { year } = parseDateString(t.data);
    return year === selectedYear;
  });

  // Filter goal transactions by year
  const filteredGoalTransactions = goalTransactions.filter((gt) => {
    const { year } = parseDateString(gt.data);
    return year === selectedYear && gt.tipo === 'deposito';
  });

  // Filter forecast transactions by year
  const filteredForecastTransactions: ForecastTransaction[] = [];
  if (forecastTransactions && (isFutureYear || isCurrentYear)) {
    filteredForecastTransactions.push(...forecastTransactions.filter((ft) => {
      const { year } = parseDateString(ft.data);
      if (year === selectedYear) {
        if (isCurrentYear) {
          const forecastDate = createDateFromString(ft.data);
          return forecastDate >= today;
        }
        return true;
      }
      return false;
    }));
  }

  // Calculate initial accumulated balance from previous year
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
          if (t.tipo === 'Receita') {
            monthEntradas += t.valor;
          } else {
            monthSaidas += t.valor;
          }
        }
      });
      
      prevAccumulated += (monthEntradas - monthSaidas);
    }
    
    initialAccumulated = prevAccumulated;
  }

  // Initialize monthly data map - ONLY for selected year
  const monthlyMap = new Map<string, {
    entradas: number;
    saidas: number;
    investimentos: number;
    investimentos_metas: number;
  }>();

  // Initialize all 12 months for selected year ONLY
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
    monthlyMap.set(monthKey, {
      entradas: 0,
      saidas: 0,
      investimentos: 0,
      investimentos_metas: 0,
    });
  }

  // Process regular transactions - ONLY for selected year
  filteredTransactions.forEach((t) => {
    const monthKey = t.data.substring(0, 7); // YYYY-MM
    // STRICT: Only process if monthKey starts with selectedYear
    if (!monthKey.startsWith(`${selectedYear}-`)) {
      return;
    }
    const current = monthlyMap.get(monthKey);
    if (!current) return;

    if (t.tipo === 'Receita') {
      current.entradas += t.valor;
    } else {
      current.saidas += t.valor;
      if (t.categoria === 'Investimentos') {
        current.investimentos += t.valor;
      }
    }
    monthlyMap.set(monthKey, current);
  });

  // Process goal transactions - ONLY for selected year
  filteredGoalTransactions.forEach((gt) => {
    const monthKey = gt.data.substring(0, 7);
    if (!monthKey.startsWith(`${selectedYear}-`)) {
      return;
    }
    const current = monthlyMap.get(monthKey);
    if (!current) return;
    current.investimentos_metas += gt.valor;
    monthlyMap.set(monthKey, current);
  });

  // Process forecast transactions - ONLY for selected year
  filteredForecastTransactions.forEach((ft) => {
    const monthKey = ft.data.substring(0, 7);
    if (!monthKey.startsWith(`${selectedYear}-`)) {
      return;
    }
    const current = monthlyMap.get(monthKey);
    if (!current) return;

    if (ft.tipo === 'Receita') {
      current.entradas += ft.valor;
    } else {
      current.saidas += ft.valor;
      if (ft.categoria === 'Investimentos') {
        current.investimentos += ft.valor;
      }
    }
    monthlyMap.set(monthKey, current);
  });

  // Build final array with EXACTLY 12 months for selected year, in order
  const finalBalanceData: BalanceData[] = [];
  let accumulated = initialAccumulated;
  
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
    
    // STRICT: Verify monthKey belongs to selected year
    const monthKeyYear = parseInt(monthKey.substring(0, 4));
    if (monthKeyYear !== selectedYear) {
      console.error(`[getBalanceData] Invalid monthKey: ${monthKey} for year ${selectedYear}`);
      continue;
    }
    
    const monthData = monthlyMap.get(monthKey);
    
    // Create month label using local date to avoid timezone issues
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
      });
    }
  }

  // STRICT: Final verification - ensure all months belong to selected year
  const verified = finalBalanceData.filter(item => {
    const itemYear = parseInt(item.monthKey.substring(0, 4));
    return itemYear === selectedYear;
  });

  if (verified.length !== 12) {
    console.warn(`[getBalanceData] Expected 12 months for year ${selectedYear}, got ${verified.length}`);
    console.warn(`[getBalanceData] MonthKeys:`, finalBalanceData.map(d => d.monthKey));
  }

  // Return exactly 12 months - should always be 12 since we build it explicitly
  return verified.length === 12 ? verified : finalBalanceData;
};
