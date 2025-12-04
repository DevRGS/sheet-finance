import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, MoreHorizontal, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Transaction } from '@/types/finance';
import { TransactionForm } from './TransactionForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TransactionListProps {
  limit?: number;
  showTitle?: boolean;
}

export function TransactionList({ limit, showTitle = true }: TransactionListProps) {
  const { filteredTransactions, deleteTransaction, categories } = useFinanceContext();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayedTransactions = limit
    ? filteredTransactions.slice(0, limit)
    : filteredTransactions;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(c => c.nome === categoryName);
    return category?.cor || '#6b7280';
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setDeletingId(null);
    toast.success('Transação excluída com sucesso!');
  };

  return (
    <>
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Últimas Transações</CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn(!showTitle && 'pt-6')}>
          <div className="space-y-3">
            {displayedTransactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              displayedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm"
                >
                  <div className="flex flex-1 items-start gap-3 sm:gap-4">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        transaction.tipo === 'Receita'
                          ? 'bg-emerald-500/10'
                          : 'bg-rose-500/10'
                      )}
                    >
                      {transaction.tipo === 'Receita' ? (
                        <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-rose-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium text-sm sm:text-base">{transaction.descricao}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm text-muted-foreground">
                        <span>
                          {(() => {
                            // Parse date string safely to avoid timezone issues
                            const [year, month, day] = transaction.data.split('-').map(Number);
                            const date = new Date(year, month - 1, day);
                            return format(date, "dd 'de' MMM", { locale: ptBR });
                          })()}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                          style={{ 
                            backgroundColor: `${getCategoryColor(transaction.categoria)}20`,
                            color: getCategoryColor(transaction.categoria),
                          }}
                        >
                          {transaction.categoria}
                        </Badge>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden text-xs sm:inline">{transaction.forma_pagamento}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span
                      className={cn(
                        'font-semibold',
                        transaction.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      {transaction.tipo === 'Receita' ? '+' : '-'}{' '}
                      {formatCurrency(transaction.valor)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTransaction(transaction)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingId(transaction.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {editingTransaction && (
        <TransactionForm
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
