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
    const currentMonth = today.getMonth() + 1; // 1-12 (getMonth retorna 0-11, então +1)
    
    // Calcular mês anterior
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = currentYear - 1;
    }
    
    // Criar monthKeys no formato YYYY-MM (mesmo formato usado no getMonthlyData)
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const previousMonthKey = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
    
    // Função para criar o monthLabel exatamente como no getMonthlyData
    // Usar exatamente a mesma lógica: new Date(month + '-01')
    const createMonthLabel = (monthKey: string): string => {
      // Parsear manualmente para evitar problemas de timezone
      const [year, month] = monthKey.split('-').map(Number);
      // Criar data localmente (year, month - 1, day) para evitar timezone
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    };
    
    // Buscar dados do monthlyData comparando diretamente os labels
    const findDataByMonthKey = (monthKey: string) => {
      const monthLabel = createMonthLabel(monthKey);
      
      // Buscar no monthlyData comparando diretamente o month string
      const found = monthlyData.find(d => d.month === monthLabel);
      
      if (found) {
        return found;
      }
      
      // Se não encontrou, criar dados vazios
      return {
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
