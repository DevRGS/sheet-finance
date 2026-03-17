import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { StatCard } from './StatCard';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { DashboardPreset } from '@/hooks/useFinance';

const PERIOD_LABELS: Record<DashboardPreset, { receitas: string; despesas: string; saldo: string }> = {
  today:  { receitas: 'Receitas de Hoje',    despesas: 'Despesas de Hoje',    saldo: 'Saldo de Hoje'    },
  week:   { receitas: 'Receitas da Semana',  despesas: 'Despesas da Semana',  saldo: 'Saldo da Semana'  },
  month:  { receitas: 'Receitas do Mês',     despesas: 'Despesas do Mês',     saldo: 'Saldo do Mês'     },
  year:   { receitas: 'Receitas do Ano',     despesas: 'Despesas do Ano',     saldo: 'Saldo do Ano'     },
  custom: { receitas: 'Receitas do Período', despesas: 'Despesas do Período', saldo: 'Saldo do Período' },
};

export function DashboardStats() {
  const { stats, dashboardPeriod } = useFinanceContext();
  const labels = PERIOD_LABELS[dashboardPeriod.preset];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        title={labels.receitas}
        value={formatCurrency(stats.receitasMes)}
        icon={<TrendingUp className="h-5 w-5" />}
        variant="income"
      />
      <StatCard
        title={labels.despesas}
        value={formatCurrency(stats.despesasMes)}
        icon={<TrendingDown className="h-5 w-5" />}
        variant="expense"
      />
      <StatCard
        title={labels.saldo}
        value={formatCurrency(stats.saldoMes)}
        icon={<Wallet className="h-5 w-5" />}
        variant="balance"
      />
    </div>
  );
}
