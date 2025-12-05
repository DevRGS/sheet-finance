import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { getBalanceData } from '@/data/mockData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';

export function BalanceChart() {
  const { transactions, goalTransactions, forecastTransactions, bills } = useFinanceContext();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [compareYear, setCompareYear] = useState<number | null>(null);

  // Helper function to parse date string safely (avoid timezone issues)
  const parseDateString = (dateString: string): number => {
    // Date string is in format "YYYY-MM-DD", extract year directly
    return parseInt(dateString.substring(0, 4), 10);
  };

  // Get available years from transactions and forecasts
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    
    transactions.forEach((t) => {
      const year = parseDateString(t.data);
      years.add(year);
    });
    
    goalTransactions.forEach((gt) => {
      const year = parseDateString(gt.data);
      years.add(year);
    });

    forecastTransactions.forEach((ft) => {
      const year = parseDateString(ft.data);
      if (year >= currentYear) {
        years.add(year);
      }
    });

    // Adicionar anos das contas pagas
    bills.forEach((bill) => {
      if (bill.pago && bill.data_pagamento) {
        const year = parseDateString(bill.data_pagamento);
        years.add(year);
      }
    });

    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, goalTransactions, forecastTransactions, bills]);

  // Calculate balance data for selected year - SIMPLIFIED
  const balanceData = useMemo(() => {
    const data = getBalanceData(transactions, goalTransactions, selectedYear, forecastTransactions, bills);
    
    // STRICT: Filter to ensure all data belongs to selected year
    const filtered = data.filter(item => {
      const itemYear = parseInt(item.monthKey.substring(0, 4));
      const isValid = itemYear === selectedYear;
      if (!isValid) {
        console.warn(`[BalanceChart] Filtered out item with monthKey: ${item.monthKey} (year: ${itemYear}, selected: ${selectedYear})`);
      }
      return isValid;
    });
    
    // Build array with exactly 12 months in order (January to December)
    const result: typeof data = [];
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
      const existing = filtered.find(item => item.monthKey === monthKey);
      if (existing) {
        result.push(existing);
      } else {
        // Create empty month
        const monthDate = new Date(selectedYear, month - 1, 1);
        const monthLabel = monthDate.toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        });
        
        // Calculate accumulated balance for empty month
        const previousMonth = result[result.length - 1];
        const accumulated = previousMonth ? previousMonth.saldo_acumulado : 0;
        
        result.push({
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
    
    if (result.length !== 12) {
      console.error(`[BalanceChart] Expected 12 months for year ${selectedYear}, got ${result.length}`);
      console.error(`[BalanceChart] MonthKeys:`, result.map(d => d.monthKey));
    }
    
    return result;
  }, [transactions, goalTransactions, selectedYear, forecastTransactions, bills]);

  // Calculate balance data for comparison year
  const compareData = useMemo(() => {
    if (!compareYear) return null;
    const data = getBalanceData(transactions, goalTransactions, compareYear, forecastTransactions, bills);
    return data.filter(item => {
      const itemYear = parseInt(item.monthKey.substring(0, 4));
      return itemYear === compareYear;
    });
  }, [transactions, goalTransactions, compareYear, forecastTransactions, bills]);

  // Combine data for comparison - SIMPLIFIED
  const chartData = useMemo(() => {
    // STRICT: Build array with exactly 12 months for selected year (January to December)
    const result: Array<typeof balanceData[0] & {
      entradas_compare?: number | null;
      saidas_compare?: number | null;
      investimentos_compare?: number | null;
      investimentos_metas_compare?: number | null;
      saldo_compare?: number | null;
      saldo_acumulado_compare?: number | null;
    }> = [];

    // Build complete data array for selected year - explicitly from January to December
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
      
      // STRICT: Verify monthKey belongs to selected year
      const monthKeyYear = parseInt(monthKey.substring(0, 4));
      if (monthKeyYear !== selectedYear) {
        console.error(`[BalanceChart chartData] Invalid monthKey: ${monthKey} for year ${selectedYear}`);
        continue;
      }
      
      // Find existing data for this month
      const existing = balanceData.find(item => {
        const itemYear = parseInt(item.monthKey.substring(0, 4));
        return itemYear === selectedYear && item.monthKey === monthKey;
      });
      
      if (existing) {
        // Verify existing item belongs to selected year
        const existingYear = parseInt(existing.monthKey.substring(0, 4));
        if (existingYear !== selectedYear) {
          console.warn(`[BalanceChart chartData] Existing item has wrong year: ${existing.monthKey} (expected ${selectedYear})`);
        }
        
        const item: typeof result[0] = {
          ...existing,
          entradas_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.entradas ?? null : null,
          saidas_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.saidas ?? null : null,
          investimentos_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.investimentos ?? null : null,
          investimentos_metas_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.investimentos_metas ?? null : null,
          saldo_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.saldo ?? null : null,
          saldo_acumulado_compare: compareYear && compareData ? 
            compareData.find(c => {
              const cYear = parseInt(c.monthKey.substring(0, 4));
              const cMonthNum = parseInt(c.monthKey.substring(5, 7));
              return cYear === compareYear && cMonthNum === month;
            })?.saldo_acumulado ?? null : null,
        };
        result.push(item);
      } else {
        // Create empty month if missing
        const monthDate = new Date(selectedYear, month - 1, 1);
        const monthLabel = monthDate.toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        });
        
        const previousMonth = result[result.length - 1];
        const accumulated = previousMonth ? previousMonth.saldo_acumulado : 0;
        
        result.push({
          month: monthLabel,
          monthKey,
          entradas: 0,
          saidas: 0,
          investimentos: 0,
          investimentos_metas: 0,
          saldo: 0,
          saldo_acumulado: accumulated,
          receita_prevista: 0,
          entradas_compare: null,
          saidas_compare: null,
          investimentos_compare: null,
          investimentos_metas_compare: null,
          saldo_compare: null,
          saldo_acumulado_compare: null,
        });
      }
    }

    // Final verification
    const invalidMonths = result.filter(item => {
      const itemYear = parseInt(item.monthKey.substring(0, 4));
      return itemYear !== selectedYear;
    });
    
    if (invalidMonths.length > 0) {
      console.error(`[BalanceChart chartData] Found ${invalidMonths.length} invalid months for year ${selectedYear}:`, invalidMonths.map(m => m.monthKey));
    }
    
    if (result.length !== 12) {
      console.error(`[BalanceChart chartData] Expected 12 months for year ${selectedYear}, got ${result.length}`);
      console.error(`[BalanceChart chartData] MonthKeys:`, result.map(d => d.monthKey));
    }

    return result;
  }, [balanceData, compareData, compareYear, selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const total = balanceData.reduce(
      (acc, item) => ({
        entradas: acc.entradas + item.entradas,
        saidas: acc.saidas + item.saidas,
        investimentos: acc.investimentos + item.investimentos,
        investimentos_metas: acc.investimentos_metas + item.investimentos_metas,
      }),
      { entradas: 0, saidas: 0, investimentos: 0, investimentos_metas: 0 }
    );
    return {
      ...total,
      saldo: total.entradas - total.saidas,
      saldo_final: balanceData[balanceData.length - 1]?.saldo_acumulado || 0,
    };
  }, [balanceData]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-semibold">Balanço Anual</CardTitle>
            {selectedYear > new Date().getFullYear() && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Visualizando previsões para {selectedYear}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="year-select" className="text-sm whitespace-nowrap">
                Ano:
              </Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year-select" className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="compare-select" className="text-sm whitespace-nowrap">
                Comparar com:
              </Label>
              <Select
                value={compareYear?.toString() || 'none'}
                onValueChange={(value) =>
                  setCompareYear(value === 'none' ? null : parseInt(value))
                }
              >
                <SelectTrigger id="compare-select" className="w-[120px]">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {availableYears
                    .filter((year) => year !== selectedYear)
                    .map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border bg-muted/30 p-2 sm:p-3">
            <p className="text-xs text-muted-foreground">Total Entradas</p>
            <p className="text-sm sm:text-lg font-semibold text-emerald-600 break-words">
              {formatCurrencyFull(totals.entradas)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Total Saídas</p>
            <p className="text-lg font-semibold text-rose-600">
              {formatCurrencyFull(totals.saidas)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Investimentos</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrencyFull(totals.investimentos)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Invest. Metas</p>
            <p className="text-lg font-semibold text-purple-600">
              {formatCurrencyFull(totals.investimentos_metas)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-lg font-semibold">
              {formatCurrencyFull(totals.saldo)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Saldo Final</p>
            <p className="text-lg font-semibold">
              {formatCurrencyFull(totals.saldo_final)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[300px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (value === null || value === undefined) return null;
                  return [formatCurrencyFull(value), name];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              
              {/* Selected Year Bars */}
              <Bar
                dataKey="entradas"
                name={`Entradas ${selectedYear}`}
                fill="hsl(150 60% 45%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="saidas"
                name={`Saídas ${selectedYear}`}
                fill="hsl(0 72% 50%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="investimentos"
                name={`Investimentos ${selectedYear}`}
                fill="hsl(217 91% 60%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="investimentos_metas"
                name={`Invest. Metas ${selectedYear}`}
                fill="hsl(258 89% 66%)"
                radius={[4, 4, 0, 0]}
              />
              
              {/* Comparison Year Bars (if selected) */}
              {compareYear && (
                <>
                  <Bar
                    dataKey="entradas_compare"
                    name={`Entradas ${compareYear}`}
                    fill="hsl(150 60% 45% / 0.5)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="saidas_compare"
                    name={`Saídas ${compareYear}`}
                    fill="hsl(0 72% 50% / 0.5)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="investimentos_compare"
                    name={`Investimentos ${compareYear}`}
                    fill="hsl(217 91% 60% / 0.5)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="investimentos_metas_compare"
                    name={`Invest. Metas ${compareYear}`}
                    fill="hsl(258 89% 66% / 0.5)"
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}
              
              {/* Saldo Accumulated Line */}
              <Line
                type="monotone"
                dataKey="saldo_acumulado"
                name={`Saldo Acumulado ${selectedYear}`}
                stroke="hsl(258 89% 66%)"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              
              {/* Comparison Saldo Accumulated Line (if selected) */}
              {compareYear && (
                <Line
                  type="monotone"
                  dataKey="saldo_acumulado_compare"
                  name={`Saldo Acumulado ${compareYear}`}
                  stroke="hsl(258 89% 66% / 0.5)"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                />
              )}
              
              {/* Receita Prevista Line */}
              <Line
                type="monotone"
                dataKey="receita_prevista"
                name="Total de Receita Prevista"
                stroke="hsl(150 60% 45% / 0.6)"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
