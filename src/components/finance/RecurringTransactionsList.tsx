import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, MoreHorizontal, Repeat, Power, PowerOff } from 'lucide-react';
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
import { RecurringTransaction } from '@/types/finance';
import { RecurringTransactionForm } from './RecurringTransactionForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function RecurringTransactionsList() {
  const { recurringTransactions, updateRecurringTransaction, deleteRecurringTransaction } = useFinanceContext();
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getRecurrenceLabel = (recorrencia: RecurringTransaction['recorrencia']) => {
    const labels = {
      mensal: 'Mensal',
      bimestral: 'Bimestral',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
    };
    return labels[recorrencia];
  };

  const getEndTypeLabel = (transaction: RecurringTransaction) => {
    if (transaction.fim_tipo === 'until_cancelled') {
      return 'Até cancelar';
    }
    return `Por ${transaction.meses_duracao} meses`;
  };

  const handleToggleActive = async (transaction: RecurringTransaction) => {
    const success = await updateRecurringTransaction(transaction.id, {
      ativo: !transaction.ativo,
    });
    if (success) {
      toast.success(
        transaction.ativo
          ? 'Transação recorrente desativada'
          : 'Transação recorrente ativada'
      );
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteRecurringTransaction(id);
    if (success) {
      setDeletingId(null);
      toast.success('Transação recorrente excluída com sucesso!');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Transações Recorrentes</CardTitle>
            <Button onClick={() => setFormOpen(true)} size="sm">
              Nova Recorrente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recurringTransactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma transação recorrente cadastrada
              </div>
            ) : (
              recurringTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm',
                    !transaction.ativo && 'opacity-60'
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        transaction.tipo === 'Receita'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                      )}
                    >
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{transaction.descricao}</p>
                        {!transaction.ativo && (
                          <Badge variant="secondary" className="text-xs">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{formatCurrency(transaction.valor)}</span>
                        <span>•</span>
                        <span>{getRecurrenceLabel(transaction.recorrencia)}</span>
                        <span>•</span>
                        <span>{getEndTypeLabel(transaction)}</span>
                        <span>•</span>
                        <span>Início: {(() => {
                          const [year, month, day] = transaction.data_inicio.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          return format(date, 'dd/MM/yyyy', { locale: ptBR });
                        })()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-lg font-semibold',
                        transaction.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      {transaction.tipo === 'Receita' ? '+' : '-'}
                      {formatCurrency(transaction.valor)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleActive(transaction)}>
                          {transaction.ativo ? (
                            <>
                              <PowerOff className="mr-2 h-4 w-4" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
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

      <RecurringTransactionForm
        open={formOpen || editingTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingTransaction(null);
          }
        }}
        transaction={editingTransaction || undefined}
      />

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação Recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação recorrente? Esta ação não pode ser desfeita.
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

