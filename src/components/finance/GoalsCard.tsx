import { useState } from 'react';
import { Target, Plus, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { Goal } from '@/types/finance';
import { GoalForm } from './GoalForm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function GoalsCard() {
  const { goals, deleteGoal, isConnected } = useFinanceContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleDelete = async (id: string) => {
    const success = await deleteGoal(id);
    if (success) {
      toast.success('Meta excluída com sucesso!');
    } else {
      toast.error('Erro ao excluir meta');
    }
    setDeletingId(null);
  };

  if (!isConnected && goals.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Metas Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Conecte ao Google Sheets para gerenciar suas metas
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Metas Financeiras
          </CardTitle>
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Nova Meta
          </Button>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhuma meta cadastrada</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setFormOpen(true)}
              >
                Criar primeira meta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const progress = goal.valor_alvo > 0 
                  ? Math.min((goal.valor_atual / goal.valor_alvo) * 100, 100) 
                  : 0;
                const remaining = goal.valor_alvo - goal.valor_atual;
                const isCompleted = progress >= 100;

                return (
                  <div
                    key={goal.id}
                    className={cn(
                      'rounded-lg border p-4 transition-all',
                      isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: goal.cor }}
                          />
                          <h4 className="font-medium">{goal.nome}</h4>
                          {isCompleted && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-600">
                              Concluída!
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-bold">
                            {formatCurrency(goal.valor_atual)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            de {formatCurrency(goal.valor_alvo)}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingGoal(goal)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(goal.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4">
                      <Progress
                        value={progress}
                        className="h-2"
                        style={{
                          ['--progress-background' as string]: goal.cor,
                        }}
                      />
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {progress.toFixed(0)}% alcançado
                        </span>
                        {!isCompleted && (
                          <span className="font-medium">
                            Faltam {formatCurrency(remaining)}
                          </span>
                        )}
                      </div>
                    </div>

                    {goal.prazo && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Prazo: {new Date(goal.prazo).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GoalForm
        open={formOpen || !!editingGoal}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingGoal(null);
          }
        }}
        goal={editingGoal}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
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
