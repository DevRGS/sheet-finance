import { useState } from 'react';
import { Search, Filter, X, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
import { TransactionList } from '@/components/finance/TransactionList';
import { TransactionForm } from '@/components/finance/TransactionForm';
import { RecurringTransactionsList } from '@/components/finance/RecurringTransactionsList';
import { ForecastCard } from '@/components/finance/ForecastCard';
import { BillsList } from '@/components/finance/BillsList';
import { BillForm } from '@/components/finance/BillForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { cn } from '@/lib/utils';

const Transacoes = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [billFormOpen, setBillFormOpen] = useState(false);
  const { categories, filters, setFilters, filteredTransactions } = useFinanceContext();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const hasActiveFilters = 
    filters.search || 
    filters.tipo !== 'all' || 
    filters.categoria !== 'all' ||
    filters.periodo.inicio ||
    filters.periodo.fim;

  const clearFilters = () => {
    setFilters({
      search: '',
      tipo: 'all',
      categoria: 'all',
      periodo: { inicio: null, fim: null },
    });
  };

  return (
    <AppLayout>
      <AppHeader title="Transações" onNewTransaction={() => setFormOpen(true)} />

      <main className="flex-1 space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-6">
        <Tabs defaultValue="transactions" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">Transações</TabsTrigger>
            <TabsTrigger value="recurring" className="text-xs sm:text-sm">Recorrentes</TabsTrigger>
            <TabsTrigger value="forecast" className="text-xs sm:text-sm">Previsões</TabsTrigger>
            <TabsTrigger value="bills" className="text-xs sm:text-sm">Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4 sm:space-y-6">
            {/* Filters */}
            <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.tipo}
                onValueChange={(value) => setFilters({ ...filters, tipo: value as typeof filters.tipo })}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Receita">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Receitas
                    </span>
                  </SelectItem>
                  <SelectItem value="Despesa">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Despesas
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.categoria}
                onValueChange={(value) => setFilters({ ...filters, categoria: value })}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nome}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat.cor }}
                        />
                        {cat.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'gap-2',
                      (filters.periodo.inicio || filters.periodo.fim) && 'border-primary'
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {filters.periodo.inicio || filters.periodo.fim
                        ? 'Período selecionado'
                        : 'Período'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium">Data Inicial</p>
                      <CalendarComponent
                        mode="single"
                        selected={filters.periodo.inicio ? new Date(filters.periodo.inicio) : undefined}
                        onSelect={(date) => {
                          setFilters({
                            ...filters,
                            periodo: {
                              ...filters.periodo,
                              inicio: date ? format(date, 'yyyy-MM-dd') : null,
                            },
                          });
                        }}
                        locale={ptBR}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Data Final</p>
                      <CalendarComponent
                        mode="single"
                        selected={filters.periodo.fim ? new Date(filters.periodo.fim) : undefined}
                        onSelect={(date) => {
                          setFilters({
                            ...filters,
                            periodo: {
                              ...filters.periodo,
                              fim: date ? format(date, 'yyyy-MM-dd') : null,
                            },
                          });
                        }}
                        locale={ptBR}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setFilters({
                          ...filters,
                          periodo: { inicio: null, fim: null },
                        });
                        setDateRangeOpen(false);
                      }}
                    >
                      Limpar período
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Active filters badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtros ativos:</span>
              {filters.search && (
                <Badge variant="secondary" className="gap-1">
                  Busca: "{filters.search}"
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setFilters({ ...filters, search: '' })}
                  />
                </Badge>
              )}
              {filters.tipo !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Tipo: {filters.tipo}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setFilters({ ...filters, tipo: 'all' })}
                  />
                </Badge>
              )}
              {filters.categoria !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Categoria: {filters.categoria}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setFilters({ ...filters, categoria: 'all' })}
                  />
                </Badge>
              )}
              {(filters.periodo.inicio || filters.periodo.fim) && (
                <Badge variant="secondary" className="gap-1">
                  Período:{' '}
                  {filters.periodo.inicio
                    ? format(new Date(filters.periodo.inicio), 'dd/MM/yy', { locale: ptBR })
                    : '...'}{' '}
                  -{' '}
                  {filters.periodo.fim
                    ? format(new Date(filters.periodo.fim), 'dd/MM/yy', { locale: ptBR })
                    : '...'}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      setFilters({ ...filters, periodo: { inicio: null, fim: null } })
                    }
                  />
                </Badge>
              )}
            </div>
          )}

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            {filteredTransactions.length} transação(ões) encontrada(s)
          </p>
        </div>

            {/* Transaction List */}
            <TransactionList showTitle={false} />
          </TabsContent>

          <TabsContent value="recurring" className="space-y-6">
            <RecurringTransactionsList />
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            <ForecastCard />
          </TabsContent>

          <TabsContent value="bills" className="space-y-4 sm:space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setBillFormOpen(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="text-sm sm:text-base">Nova Conta</span>
              </Button>
            </div>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <BillsList tipo="pagar" />
              <BillsList tipo="receber" />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
      <BillForm open={billFormOpen} onOpenChange={setBillFormOpen} />
    </AppLayout>
  );
};

export default Transacoes;
