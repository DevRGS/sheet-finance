import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardStats } from '@/components/finance/DashboardStats';
import { MonthlyChart } from '@/components/finance/MonthlyChart';
import { CategoryChart } from '@/components/finance/CategoryChart';
import { BalanceChart } from '@/components/finance/BalanceChart';
import { RecentTransactions } from '@/components/finance/RecentTransactions';
import { GoalsCard } from '@/components/finance/GoalsCard';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Cloud, AlertTriangle } from 'lucide-react';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Link } from 'react-router-dom';

const Index = () => {
  const [formOpen, setFormOpen] = useState(false);
  const { isConnected, transactions } = useFinanceContext();

  return (
    <AppLayout>
      <AppHeader title="Dashboard" onNewTransaction={() => setFormOpen(true)} />
      
      <main className="flex-1 space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-6">
        {/* Connection Alert */}
        {!isConnected && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-600">Modo offline</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm sm:text-base">
                Conecte ao Google Sheets para sincronizar seus dados.
              </span>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto sm:ml-4">
                <Link to="/configuracoes" className="gap-2">
                  <Cloud className="h-4 w-4" />
                  Configurar
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <DashboardStats />

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MonthlyChart />
          </div>
          <div className="lg:col-span-1">
            <CategoryChart />
          </div>
        </div>

        <BalanceChart />

        <GoalsCard />

        {transactions.length > 0 && <RecentTransactions />}
      </main>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
};

export default Index;
