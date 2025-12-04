import { useState } from 'react';
import { Plus, Edit2, Trash2, MoreHorizontal, Tag } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppHeader } from '@/components/layout/AppHeader';
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
import { CategoryForm } from '@/components/finance/CategoryForm';
import { Category } from '@/types/finance';
import { toast } from 'sonner';

const Categorias = () => {
  const { categories, categoryData, deleteCategory, transactions } = useFinanceContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCategoryTotal = (categoryName: string) => {
    const data = categoryData.find((c) => c.categoria === categoryName);
    return data?.valor || 0;
  };

  const getCategoryTransactionCount = (categoryName: string) => {
    return transactions.filter((t) => t.categoria === categoryName).length;
  };

  const totalDespesas = categoryData.reduce((sum, c) => sum + c.valor, 0);

  const handleDelete = async (id: string) => {
    const category = categories.find(c => c.id === id);
    const transactionCount = category ? getCategoryTransactionCount(category.nome) : 0;
    
    if (transactionCount > 0) {
      toast.error(`Não é possível excluir. Existem ${transactionCount} transação(ões) usando esta categoria.`);
      setDeletingId(null);
      return;
    }

    const success = await deleteCategory(id);
    if (success) {
      toast.success('Categoria excluída com sucesso!');
    } else {
      toast.error('Erro ao excluir categoria');
    }
    setDeletingId(null);
  };

  return (
    <AppLayout>
      <AppHeader title="Categorias" />

      <main className="flex-1 space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
              Categorias de Transações
            </CardTitle>
            <Button onClick={() => setFormOpen(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="text-sm sm:text-base">Nova Categoria</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => {
                const total = getCategoryTotal(category.nome);
                const transactionCount = getCategoryTransactionCount(category.nome);
                const percentage = totalDespesas > 0 ? ((total / totalDespesas) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={category.id}
                    className="group relative rounded-lg border border-border p-4 transition-all hover:shadow-md"
                  >
                    <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(category.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl"
                        style={{ backgroundColor: `${category.cor}30` }}
                      >
                        <div
                          className="flex h-full w-full items-center justify-center rounded-xl"
                          style={{ color: category.cor }}
                        >
                          <Tag className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{category.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {transactionCount} transação(ões)
                        </p>
                      </div>
                    </div>

                    {total > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                          <Badge 
                            variant="secondary"
                            style={{ 
                              backgroundColor: `${category.cor}20`,
                              color: category.cor,
                            }}
                          >
                            {percentage}%
                          </Badge>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(parseFloat(percentage), 100)}%`,
                              backgroundColor: category.cor,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <CategoryForm
        open={formOpen || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingCategory(null);
          }
        }}
        category={editingCategory}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
              {(() => {
                const category = categories.find(c => c.id === deletingId);
                const count = category ? getCategoryTransactionCount(category.nome) : 0;
                if (count > 0) {
                  return (
                    <span className="mt-2 block font-medium text-destructive">
                      Atenção: Existem {count} transação(ões) usando esta categoria.
                    </span>
                  );
                }
                return null;
              })()}
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
    </AppLayout>
  );
};

export default Categorias;
