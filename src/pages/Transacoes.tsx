import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { TransactionList } from '@/components/finance/TransactionList';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/contexts/FinanceContext';

const Transacoes = () => {
  const [formOpen, setFormOpen] = useState(false);
  const { categories } = useFinanceContext();

  return (
    <AppLayout>
      <AppHeader title="Transações" onNewTransaction={() => setFormOpen(true)} />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar transações..."
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.nome.toLowerCase()}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Transaction List */}
        <TransactionList showTitle={false} />
      </main>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
};

export default Transacoes;
