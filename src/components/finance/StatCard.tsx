import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'income' | 'expense' | 'balance';
}

export function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    income: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    expense: 'bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20',
    balance: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
  };

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    income: 'bg-emerald-500/20 text-emerald-600',
    expense: 'bg-rose-500/20 text-rose-600',
    balance: 'bg-primary/20 text-primary',
  };

  return (
    <Card className={cn('transition-all duration-300 hover:shadow-lg', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}% vs mês anterior
              </p>
            )}
          </div>
          <div className={cn('rounded-xl p-3', iconStyles[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
