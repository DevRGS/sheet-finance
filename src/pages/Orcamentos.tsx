import { useState } from 'react';
import { Plus, PiggyBank, Pencil, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import { BudgetForm } from '@/components/finance/BudgetForm';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Budget } from '@/types/finance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Orcamentos() {
  const { budgets, transactions, categories, deleteBudget } = useFinanceContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const spendingByCategory: Record<string, number> = {};
  transactions
    .filter((t) => t.tipo === 'Despesa' && t.data.startsWith(currentMonth))
    .forEach((t) => {
      spendingByCategory[t.categoria] = (spendingByCategory[t.categoria] || 0) + t.valor;
    });

  const handleEdit = (budget: Budget) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteBudget(deleteTarget);
    if (success) toast.success('Orçamento excluído!');
    else toast.error('Erro ao excluir orçamento');
    setDeleteTarget(null);
  };

  const activeBudgets = budgets.filter((b) => b.mes === '' || b.mes === currentMonth);
  const otherBudgets = budgets.filter((b) => b.mes !== '' && b.mes !== currentMonth);

  const BudgetRow = ({ budget }: { budget: Budget }) => {
    const cat = categories.find((c) => c.nome === budget.categoria);
    const spent = spendingByCategory[budget.categoria] || 0;
    const pct = budget.valor_limite > 0 ? Math.min((spent / budget.valor_limite) * 100, 100) : 0;
    const over = spent > budget.valor_limite;

    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {cat && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />}
            <span className="font-medium">{budget.categoria}</span>
            {budget.mes === '' ? (
              <Badge variant="secondary" className="text-xs">Mensal</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">{budget.mes}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(budget)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(budget.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Progress
          value={pct}
          className={cn(
            'h-2.5',
            over ? '[&>div]:bg-destructive' : pct >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
          )}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(spent)} de {formatCurrency(budget.valor_limite)}
          </span>
          <span className={cn('flex items-center gap-1', over ? 'text-destructive' : pct >= 80 ? 'text-amber-500' : 'text-emerald-600')}>
            {over ? (
              <><AlertTriangle className="h-3.5 w-3.5" /> Excedido em {formatCurrency(spent - budget.valor_limite)}</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Restam {formatCurrency(budget.valor_limite - spent)}</>
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
            <SidebarTrigger />
            <div className="flex flex-1 items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold sm:text-xl">Orçamentos</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Defina limites de gastos por categoria
                </p>
              </div>
              <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Orçamento</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {budgets.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center gap-3">
                <PiggyBank className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nenhum orçamento criado</p>
                  <p className="text-sm text-muted-foreground">Defina limites para controlar seus gastos por categoria</p>
                </div>
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />Criar Orçamento
                </Button>
              </div>
            )}

            {activeBudgets.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Mês Atual ({currentMonth})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeBudgets.map((b) => <BudgetRow key={b.id} budget={b} />)}
                </div>
              </section>
            )}

            {otherBudgets.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Outros Períodos
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherBudgets.map((b) => <BudgetRow key={b.id} budget={b} />)}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <BudgetForm open={formOpen} onOpenChange={setFormOpen} budget={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
