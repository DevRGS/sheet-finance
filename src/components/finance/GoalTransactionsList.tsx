import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Goal, GoalTransaction } from '@/types/finance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GoalTransactionsListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal;
}

export function GoalTransactionsList({ open, onOpenChange, goal }: GoalTransactionsListProps) {
  const { fetchGoalTransactions, deleteGoalTransaction, isLoading } = useFinanceContext();
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && goal) {
      loadTransactions();
    }
  }, [open, goal]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await fetchGoalTransactions(goal.id);
      setTransactions(data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteGoalTransaction(id, goal.id, transactions);
    if (success) {
      toast.success('Movimentação excluída com sucesso!');
      await loadTransactions();
    } else {
      toast.error('Erro ao excluir movimentação');
    }
    setDeletingId(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse date string safely to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const totalDeposits = transactions
    .filter(t => t.tipo === 'deposito')
    .reduce((sum, t) => sum + t.valor, 0);
  
  const totalWithdrawals = transactions
    .filter(t => t.tipo === 'saque')
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Movimentações - {goal.nome}</DialogTitle>
            <DialogDescription>
              Histórico completo de depósitos e saques desta meta
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Depositado</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(totalDeposits)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Sacado</p>
                  <p className="text-lg font-semibold text-rose-600">
                    {formatCurrency(totalWithdrawals)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Atual</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(goal.valor_atual)}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3',
                        transaction.tipo === 'deposito'
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-rose-500/30 bg-rose-500/5'
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            transaction.tipo === 'deposito'
                              ? 'bg-emerald-500/20 text-emerald-600'
                              : 'bg-rose-500/20 text-rose-600'
                          )}
                        >
                          {transaction.tipo === 'deposito' ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {transaction.tipo === 'deposito' ? 'Depósito' : 'Saque'}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(transaction.data)}
                            </span>
                          </div>
                          {transaction.observacao && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {transaction.observacao}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              'font-semibold',
                              transaction.tipo === 'deposito'
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            )}
                          >
                            {transaction.tipo === 'deposito' ? '+' : '-'}
                            {formatCurrency(transaction.valor)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita e o valor da meta será recalculado.
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

