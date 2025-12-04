import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardStats } from '@/components/finance/DashboardStats';
import { MonthlyChart } from '@/components/finance/MonthlyChart';
import { CategoryChart } from '@/components/finance/CategoryChart';
import { BalanceChart } from '@/components/finance/BalanceChart';
import { RecentTransactions } from '@/components/finance/RecentTransactions';
import { TransactionForm } from '@/components/finance/TransactionForm';

const Index = () => {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <AppLayout>
      <AppHeader title="Dashboard" onNewTransaction={() => setFormOpen(true)} />
      
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <DashboardStats />

        <div className="grid gap-6 lg:grid-cols-3">
          <MonthlyChart />
          <CategoryChart />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <BalanceChart />
          <RecentTransactions />
        </div>
      </main>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
};

export default Index;
