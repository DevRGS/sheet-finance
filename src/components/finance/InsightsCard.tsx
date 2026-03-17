import { useMemo } from 'react';
import { Lightbulb, TrendingDown, TrendingUp, AlertCircle, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  icon: React.ReactNode;
  title: string;
  description: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const TYPE_STYLES = {
  danger:  { badge: 'bg-destructive/10 text-destructive border-destructive/20', icon: 'text-destructive' },
  warning: { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: 'text-amber-500' },
  info:    { badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: 'text-blue-500' },
  success: { badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'text-emerald-500' },
};

const LABEL = { danger: 'Atenção', warning: 'Alerta', info: 'Info', success: 'Ótimo' };

export function InsightsCard() {
  const { transactions, bills, goals, budgets, categories } = useFinanceContext();

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentMonth = todayStr.substring(0, 7);
    const prevMonth = (() => {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    // ── Bills due in next 7 days ─────────────────────────────────────────────
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);
    const in7DaysStr = `${in7Days.getFullYear()}-${String(in7Days.getMonth() + 1).padStart(2, '0')}-${String(in7Days.getDate()).padStart(2, '0')}`;

    const billsDueSoon = bills.filter(
      (b) => !b.pago && b.tipo === 'pagar' && b.data_vencimento && b.data_vencimento >= todayStr && b.data_vencimento <= in7DaysStr
    );
    if (billsDueSoon.length > 0) {
      const total = billsDueSoon.reduce((s, b) => s + b.valor, 0);
      list.push({
        id: 'bills-due-soon',
        type: 'warning',
        icon: <Clock className="h-4 w-4" />,
        title: `${billsDueSoon.length} conta(s) vencem em 7 dias`,
        description: `Total de ${formatCurrency(total)} a pagar nos próximos 7 dias.`,
      });
    }

    // ── Overdue bills ────────────────────────────────────────────────────────
    const overdueBills = bills.filter(
      (b) => !b.pago && b.tipo === 'pagar' && b.data_vencimento && b.data_vencimento < todayStr
    );
    if (overdueBills.length > 0) {
      const total = overdueBills.reduce((s, b) => s + b.valor, 0);
      list.push({
        id: 'bills-overdue',
        type: 'danger',
        icon: <AlertCircle className="h-4 w-4" />,
        title: `${overdueBills.length} conta(s) vencida(s)`,
        description: `${formatCurrency(total)} em contas vencidas não pagas.`,
      });
    }

    // ── Month-over-month spending comparison ─────────────────────────────────
    const spendCurrent = transactions
      .filter((t) => t.tipo === 'Despesa' && t.data.startsWith(currentMonth))
      .reduce((s, t) => s + t.valor, 0);
    const spendPrev = transactions
      .filter((t) => t.tipo === 'Despesa' && t.data.startsWith(prevMonth))
      .reduce((s, t) => s + t.valor, 0);

    if (spendPrev > 0 && spendCurrent > 0) {
      const diff = ((spendCurrent - spendPrev) / spendPrev) * 100;
      if (diff > 20) {
        list.push({
          id: 'spending-increase',
          type: 'warning',
          icon: <TrendingUp className="h-4 w-4" />,
          title: `Gastos ${diff.toFixed(0)}% maiores que mês passado`,
          description: `Você gastou ${formatCurrency(spendCurrent)} este mês vs ${formatCurrency(spendPrev)} no mês anterior.`,
        });
      } else if (diff < -10) {
        list.push({
          id: 'spending-decrease',
          type: 'success',
          icon: <TrendingDown className="h-4 w-4" />,
          title: `Gastos ${Math.abs(diff).toFixed(0)}% menores que mês passado`,
          description: `Ótimo! Você economizou ${formatCurrency(spendPrev - spendCurrent)} comparado ao mês anterior.`,
        });
      }
    }

    // ── Savings rate ─────────────────────────────────────────────────────────
    const incCurrent = transactions
      .filter((t) => t.tipo === 'Receita' && t.data.startsWith(currentMonth))
      .reduce((s, t) => s + t.valor, 0);
    if (incCurrent > 0 && spendCurrent > 0) {
      const savingsRate = ((incCurrent - spendCurrent) / incCurrent) * 100;
      if (savingsRate >= 20) {
        list.push({
          id: 'savings-rate-good',
          type: 'success',
          icon: <TrendingUp className="h-4 w-4" />,
          title: `Taxa de poupança: ${savingsRate.toFixed(0)}%`,
          description: `Você está poupando ${formatCurrency(incCurrent - spendCurrent)} este mês. Continue assim!`,
        });
      } else if (savingsRate < 0) {
        list.push({
          id: 'savings-rate-bad',
          type: 'danger',
          icon: <AlertCircle className="h-4 w-4" />,
          title: 'Gastos maiores que receitas',
          description: `Você está gastando ${formatCurrency(spendCurrent - incCurrent)} a mais do que recebe este mês.`,
        });
      }
    }

    // ── Budget overspending ──────────────────────────────────────────────────
    const activeBudgets = budgets.filter((b) => b.mes === '' || b.mes === currentMonth);
    const spendByCat: Record<string, number> = {};
    transactions
      .filter((t) => t.tipo === 'Despesa' && t.data.startsWith(currentMonth))
      .forEach((t) => { spendByCat[t.categoria] = (spendByCat[t.categoria] || 0) + t.valor; });

    const overBudgets = activeBudgets.filter((b) => (spendByCat[b.categoria] || 0) > b.valor_limite);
    if (overBudgets.length > 0) {
      const names = overBudgets.map((b) => b.categoria).join(', ');
      list.push({
        id: 'budget-exceeded',
        type: 'danger',
        icon: <AlertCircle className="h-4 w-4" />,
        title: `Orçamento excedido: ${names}`,
        description: `Você ultrapassou o limite definido para ${overBudgets.length} categoria(s) este mês.`,
      });
    }

    // ── Goals near deadline ──────────────────────────────────────────────────
    const nearDeadlineGoals = goals.filter((g) => {
      if (!g.prazo) return false;
      const prazoDate = new Date(g.prazo);
      const daysLeft = (prazoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30 && g.valor_atual < g.valor_alvo;
    });
    nearDeadlineGoals.forEach((g) => {
      const remaining = g.valor_alvo - g.valor_atual;
      list.push({
        id: `goal-${g.id}`,
        type: 'info',
        icon: <Target className="h-4 w-4" />,
        title: `Meta "${g.nome}" vence em 30 dias`,
        description: `Faltam ${formatCurrency(remaining)} para atingir sua meta.`,
      });
    });

    // ── Top spending category ────────────────────────────────────────────────
    if (Object.keys(spendByCat).length > 0) {
      const topCat = Object.entries(spendByCat).sort((a, b) => b[1] - a[1])[0];
      const catObj = categories.find((c) => c.nome === topCat[0]);
      if (catObj && incCurrent > 0 && topCat[1] / incCurrent > 0.4) {
        list.push({
          id: 'top-category',
          type: 'info',
          icon: <AlertCircle className="h-4 w-4" />,
          title: `${topCat[0]} representa mais de 40% dos gastos`,
          description: `${formatCurrency(topCat[1])} gastos em ${topCat[0]} — ${((topCat[1] / incCurrent) * 100).toFixed(0)}% da sua receita.`,
        });
      }
    }

    return list.slice(0, 5);
  }, [transactions, bills, goals, budgets, categories]);

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => {
          const styles = TYPE_STYLES[insight.type];
          return (
            <div
              key={insight.id}
              className={cn('flex gap-3 rounded-lg border p-3', styles.badge)}
            >
              <span className={cn('mt-0.5 shrink-0', styles.icon)}>{insight.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">{insight.title}</p>
                  <Badge variant="outline" className={cn('shrink-0 text-xs', styles.badge)}>
                    {LABEL[insight.type]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs opacity-80">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
