import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, MoreHorizontal, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Bill } from '@/types/finance';
import { BillForm } from './BillForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BillsListProps {
  tipo?: 'pagar' | 'receber' | 'all';
}

export function BillsList({ tipo = 'all' }: BillsListProps) {
  const { bills, deleteBill, updateBill, categories } = useFinanceContext();
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(c => c.nome === categoryName);
    return category?.cor || '#6b7280';
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // Filter by type
      if (tipo !== 'all' && bill.tipo !== tipo) return false;
      
      // Filter by status
      if (filterStatus === 'paid' && !bill.pago) return false;
      if (filterStatus === 'unpaid' && bill.pago) return false;
      
      return true;
    });
  }, [bills, tipo, filterStatus]);

  const handleDelete = async (id: string) => {
    const success = await deleteBill(id);
    if (success) {
      toast.success('Conta excluída com sucesso!');
    } else {
      toast.error('Erro ao excluir conta');
    }
    setDeletingId(null);
  };

  const handleMarkAsPaid = async (bill: Bill) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const success = await updateBill(bill.id, {
      pago: true,
      data_pagamento: today,
    });
    if (success) {
      toast.success('Conta marcada como paga/recebida!');
    } else {
      toast.error('Erro ao atualizar conta');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isOverdue = (bill: Bill): boolean => {
    if (bill.pago || !bill.data_vencimento) return false;
    const vencimento = parseDateString(bill.data_vencimento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return vencimento < today;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold">
              {tipo === 'pagar' ? 'Contas a Pagar' : tipo === 'receber' ? 'Contas a Receber' : 'Contas'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unpaid">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredBills.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma conta encontrada
              </div>
            ) : (
              filteredBills.map((bill) => {
                const overdue = isOverdue(bill);
                return (
                  <div
                    key={bill.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm',
                      overdue && !bill.pago && 'border-rose-500/50 bg-rose-50/50 dark:bg-rose-950/20'
                    )}
                  >
                    <div className="flex flex-1 items-start gap-3 sm:gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                          bill.tipo === 'receber'
                            ? 'bg-emerald-500/10'
                            : 'bg-rose-500/10'
                        )}
                      >
                        {bill.pago ? (
                          <CheckCircle2 className={cn(
                            'h-5 w-5',
                            bill.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'
                          )} />
                        ) : (
                          <AlertCircle className={cn(
                            'h-5 w-5',
                            bill.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'
                          )} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-sm sm:text-base">{bill.descricao}</p>
                          <Badge
                            variant={bill.tipo === 'receber' ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs',
                              bill.tipo === 'receber' && 'bg-emerald-500/10 text-emerald-600'
                            )}
                          >
                            {bill.tipo === 'receber' ? 'A Receber' : 'A Pagar'}
                          </Badge>
                          {bill.pago && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                              Paga
                            </Badge>
                          )}
                          {overdue && !bill.pago && (
                            <Badge variant="destructive" className="text-xs">
                              Vencida
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            style={{
                              backgroundColor: `${getCategoryColor(bill.categoria)}20`,
                              color: getCategoryColor(bill.categoria),
                            }}
                          >
                            {bill.categoria}
                          </Badge>
                          {bill.data_vencimento && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Vence: {format(parseDateString(bill.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            </>
                          )}
                          {bill.data_pagamento && bill.pago && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="flex items-center gap-1">
                                Pago em: {format(parseDateString(bill.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <div className="text-right">
                        <p className={cn(
                          'font-semibold text-sm sm:text-base',
                          bill.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          {bill.tipo === 'receber' ? '+' : '-'}
                          {formatCurrency(bill.valor)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!bill.pago && (
                            <DropdownMenuItem onClick={() => handleMarkAsPaid(bill)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Marcar como Paga
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setEditingBill(bill)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(bill.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <BillForm
        open={!!editingBill}
        onOpenChange={(open) => {
          if (!open) setEditingBill(null);
        }}
        bill={editingBill}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
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

