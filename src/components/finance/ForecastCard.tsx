import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { ForecastTransaction } from '@/types/finance';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ForecastCard() {
  const { forecastTransactions } = useFinanceContext();
  const [monthsAhead, setMonthsAhead] = useState<number>(6);

  // Helper to parse date string safely
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const filteredForecasts = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + monthsAhead);

    return forecastTransactions.filter((ft) => {
      const forecastDate = parseDateString(ft.data);
      return forecastDate <= endDate;
    });
  }, [forecastTransactions, monthsAhead]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ForecastTransaction[]>();
    
    filteredForecasts.forEach((ft) => {
      const monthKey = ft.data.substring(0, 7); // YYYY-MM
      const existing = groups.get(monthKey) || [];
      groups.set(monthKey, [...existing, ft]);
    });

    return Array.from(groups.entries())
      .map(([monthKey, transactions]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1);
        return {
          monthKey,
          month: format(monthDate, 'MMMM yyyy', { locale: ptBR }),
          transactions: transactions.sort((a, b) => {
            const dateA = parseDateString(a.data);
            const dateB = parseDateString(b.data);
            return dateA.getTime() - dateB.getTime();
          }),
          totalReceitas: transactions
            .filter((t) => t.tipo === 'Receita')
            .reduce((sum, t) => sum + t.valor, 0),
          totalDespesas: transactions
            .filter((t) => t.tipo === 'Despesa')
            .reduce((sum, t) => sum + t.valor, 0),
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredForecasts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totals = useMemo(() => {
    return filteredForecasts.reduce(
      (acc, ft) => {
        if (ft.tipo === 'Receita') {
          acc.receitas += ft.valor;
        } else {
          acc.despesas += ft.valor;
        }
        return acc;
      },
      { receitas: 0, despesas: 0 }
    );
  }, [filteredForecasts]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">Previsão de Receitas e Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="months-select" className="text-sm whitespace-nowrap">
              Período:
            </Label>
            <Select
              value={monthsAhead.toString()}
              onValueChange={(value) => setMonthsAhead(parseInt(value))}
            >
              <SelectTrigger id="months-select" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Receitas Previstas</p>
            <p className="text-lg sm:text-2xl font-semibold text-emerald-600 break-words">
              {formatCurrency(totals.receitas)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Despesas Previstas</p>
            <p className="text-lg sm:text-2xl font-semibold text-rose-600 break-words">
              {formatCurrency(totals.despesas)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Saldo Previsto</p>
            <p className={cn(
              'text-lg sm:text-2xl font-semibold break-words',
              totals.receitas - totals.despesas >= 0 ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {formatCurrency(totals.receitas - totals.despesas)}
            </p>
          </div>
        </div>

        {/* Forecast Table */}
        {groupedByMonth.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhuma previsão disponível. Cadastre transações recorrentes para ver previsões.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByMonth.map((group) => (
              <div key={group.monthKey} className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                  <h3 className="font-semibold capitalize text-sm sm:text-base">{group.month}</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                    <span className="text-emerald-600">
                      Receitas: {formatCurrency(group.totalReceitas)}
                    </span>
                    <span className="text-rose-600">
                      Despesas: {formatCurrency(group.totalDespesas)}
                    </span>
                    <span className={cn(
                      'font-semibold',
                      group.totalReceitas - group.totalDespesas >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    )}>
                      Saldo: {formatCurrency(group.totalReceitas - group.totalDespesas)}
                    </span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(parseDateString(transaction.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{transaction.descricao}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{transaction.categoria}</Badge>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-semibold',
                          transaction.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          {transaction.tipo === 'Receita' ? '+' : '-'}
                          {formatCurrency(transaction.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

