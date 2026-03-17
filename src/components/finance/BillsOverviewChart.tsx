import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
  Cell,
  TooltipProps,
} from 'recharts';

interface BillCategory {
  name: string;
  valor: number;
  quantidade: number;
  fill: string;
}

interface BillTotals {
  pagarVencidas:    { valor: number; quantidade: number };
  pagarPrevistas:   { valor: number; quantidade: number };
  receberVencidas:  { valor: number; quantidade: number };
  receberPrevistas: { valor: number; quantidade: number };
}

const CATEGORIES: { key: keyof BillTotals; name: string; fill: string }[] = [
  { key: 'pagarVencidas',    name: 'A Pagar Vencidas',     fill: 'hsl(0 72% 50%)' },
  { key: 'pagarPrevistas',   name: 'A Pagar Previstas',    fill: 'hsl(38 92% 50%)' },
  { key: 'receberVencidas',  name: 'A Receber Vencidas',   fill: 'hsl(217 91% 60%)' },
  { key: 'receberPrevistas', name: 'A Receber Previstas',  fill: 'hsl(150 60% 45%)' },
];

function formatCurrencyFull(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatCurrencyCompact(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(v);
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload as BillCategory;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-semibold" style={{ color: entry.fill }}>
        {entry.name}
      </p>
      <p className="text-foreground font-medium">{formatCurrencyFull(entry.valor)}</p>
      <p className="text-muted-foreground">
        {entry.quantidade} conta{entry.quantidade !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function BillsOverviewChart() {
  const { bills } = useFinanceContext();

  const chartData: BillCategory[] = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);

    const totals: BillTotals = {
      pagarVencidas:    { valor: 0, quantidade: 0 },
      pagarPrevistas:   { valor: 0, quantidade: 0 },
      receberVencidas:  { valor: 0, quantidade: 0 },
      receberPrevistas: { valor: 0, quantidade: 0 },
    };

    bills
      .filter((b) => !b.pago)
      .forEach((b) => {
        const overdue = b.data_vencimento != null && b.data_vencimento < today;
        if (b.tipo === 'pagar') {
          const key: keyof BillTotals = overdue ? 'pagarVencidas' : 'pagarPrevistas';
          totals[key].valor += b.valor;
          totals[key].quantidade++;
        } else {
          const key: keyof BillTotals = overdue ? 'receberVencidas' : 'receberPrevistas';
          totals[key].valor += b.valor;
          totals[key].quantidade++;
        }
      });

    return CATEGORIES
      .map((cat) => ({
        name: cat.name,
        fill: cat.fill,
        valor: totals[cat.key].valor,
        quantidade: totals[cat.key].quantidade,
      }))
      .filter((d) => d.valor > 0);
  }, [bills]);

  const isEmpty = chartData.length === 0;
  const chartHeight = Math.max(chartData.length * 56, 56);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Contas Pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2 text-muted-foreground">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            <p className="text-sm">Nenhuma conta pendente</p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrencyCompact}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
