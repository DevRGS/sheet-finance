import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import { StatCard } from './StatCard';
import { useFinanceContext } from '@/contexts/FinanceContext';

export function DashboardStats() {
  const { stats } = useFinanceContext();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Receitas do Mês"
        value={formatCurrency(stats.receitasMes)}
        icon={<TrendingUp className="h-5 w-5" />}
        variant="income"
        trend={{ value: 12, isPositive: true }}
      />
      <StatCard
        title="Despesas do Mês"
        value={formatCurrency(stats.despesasMes)}
        icon={<TrendingDown className="h-5 w-5" />}
        variant="expense"
        trend={{ value: 5, isPositive: false }}
      />
      <StatCard
        title="Saldo do Mês"
        value={formatCurrency(stats.saldoMes)}
        icon={<Wallet className="h-5 w-5" />}
        variant="balance"
      />
      <StatCard
        title="Saldo Total"
        value={formatCurrency(stats.saldo)}
        icon={<PiggyBank className="h-5 w-5" />}
        variant="default"
      />
    </div>
  );
}
