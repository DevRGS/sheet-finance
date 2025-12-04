import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TransactionList } from './TransactionList';

export function RecentTransactions() {
  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Últimas Transações</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/transacoes" className="gap-1">
            Ver todas
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <TransactionList limit={5} showTitle={false} />
      </CardContent>
    </Card>
  );
}
