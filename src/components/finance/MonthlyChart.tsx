import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function MonthlyChart() {
  const { monthlyData } = useFinanceContext();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  // Filtrar para mostrar apenas mês atual e mês anterior
  const chartData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    // Calcular mês anterior
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = currentYear - 1;
    }
    
    // Criar monthKeys no formato YYYY-MM
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const previousMonthKey = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
    
    // Buscar dados do monthlyData - precisamos reconstruir o monthKey a partir do month string
    const findDataByMonthKey = (monthKey: string) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const monthLabel = monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      return monthlyData.find(d => d.month === monthLabel) || {
        month: monthLabel,
        receitas: 0,
        despesas: 0,
        saldo: 0,
      };
    };
    
    const previousData = findDataByMonthKey(previousMonthKey);
    const currentData = findDataByMonthKey(currentMonthKey);
    
    return [previousData, currentData];
  }, [monthlyData]);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Receitas vs Despesas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar
                dataKey="receitas"
                name="Receitas"
                fill="hsl(150 60% 45%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="despesas"
                name="Despesas"
                fill="hsl(0 72% 50%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
