import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, TooltipProps } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

const FALLBACK_COLORS = [
  'hsl(255 91% 76%)',
  'hsl(270 95% 75%)',
  'hsl(234 89% 73%)',
  'hsl(258 89% 66%)',
  'hsl(240 3% 46%)',
  'hsl(150 60% 45%)',
  'hsl(30 90% 55%)',
  'hsl(0 72% 50%)',
];

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const categoria: string = entry.name as string;
  const valor: number = entry.value as number;
  const cor: string = (entry.payload as { cor?: string }).cor || entry.fill || '#6b7280';

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div
      className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm"
      style={{ borderColor: 'hsl(var(--border))' }}
    >
      <div className="flex items-center gap-2 font-medium mb-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: cor }}
        />
        {categoria}
      </div>
      <p className="text-muted-foreground">{formatCurrency(valor)}</p>
    </div>
  );
}

export function CategoryChart() {
  const { categoryData } = useFinanceContext();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const total = categoryData.reduce((sum, item) => sum + item.valor, 0);

  const isEmpty = categoryData.length === 0 || total === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {isEmpty ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <PieChartIcon className="h-12 w-12 opacity-20" />
            <p className="text-sm">Nenhuma despesa registrada</p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="valor"
                  nameKey="categoria"
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.cor || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => {
                    const item = categoryData.find((d) => d.categoria === value);
                    const percentage = item && total > 0
                      ? ((item.valor / total) * 100).toFixed(1)
                      : '0.0';
                    return `${value} (${percentage}%)`;
                  }}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
