import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Edit2, Trash2, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  CheckSquare, Square, Minus, X, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Transaction } from '@/types/finance';
import { TransactionForm } from './TransactionForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  'Dinheiro', 'Pix', 'Cartão de Débito', 'Cartão de Crédito',
  'Transferência', 'Boleto', 'Cheque', 'Outro',
];

const NO_CHANGE = '__no_change__';

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-edit dialog
// ─────────────────────────────────────────────────────────────────────────────

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onConfirm: (patch: Partial<Pick<Transaction, 'tipo' | 'categoria' | 'forma_pagamento'>>) => Promise<void>;
}

function BulkEditDialog({ open, onOpenChange, count, onConfirm }: BulkEditDialogProps) {
  const { categories } = useFinanceContext();
  const [tipo, setTipo] = useState(NO_CHANGE);
  const [categoria, setCategoria] = useState(NO_CHANGE);
  const [formaPagamento, setFormaPagamento] = useState(NO_CHANGE);
  const [saving, setSaving] = useState(false);

  const hasChange = tipo !== NO_CHANGE || categoria !== NO_CHANGE || formaPagamento !== NO_CHANGE;

  const handleClose = () => {
    setTipo(NO_CHANGE);
    setCategoria(NO_CHANGE);
    setFormaPagamento(NO_CHANGE);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!hasChange) return;
    setSaving(true);
    const patch: Partial<Pick<Transaction, 'tipo' | 'categoria' | 'forma_pagamento'>> = {};
    if (tipo !== NO_CHANGE) patch.tipo = tipo as Transaction['tipo'];
    if (categoria !== NO_CHANGE) patch.categoria = categoria;
    if (formaPagamento !== NO_CHANGE) patch.forma_pagamento = formaPagamento;
    await onConfirm(patch);
    setSaving(false);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {count} transação{count !== 1 ? 'ões' : ''}</DialogTitle>
          <DialogDescription>
            Selecione os campos que deseja alterar. Campos com "Sem alteração" serão mantidos como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>
                  <span className="text-muted-foreground">Sem alteração</span>
                </SelectItem>
                <SelectItem value="Receita">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Receita
                  </span>
                </SelectItem>
                <SelectItem value="Despesa">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Despesa
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>
                  <span className="text-muted-foreground">Sem alteração</span>
                </SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.nome}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.cor }} />
                      {cat.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>
                  <span className="text-muted-foreground">Sem alteração</span>
                </SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!hasChange || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aplicar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main list component
// ─────────────────────────────────────────────────────────────────────────────

interface TransactionListProps {
  limit?: number;
  showTitle?: boolean;
}

export function TransactionList({ limit, showTitle = true }: TransactionListProps) {
  const { filteredTransactions, deleteTransaction, updateTransaction, categories } = useFinanceContext();

  // ── Single item actions ──
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Bulk selection ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const displayedTransactions = limit
    ? filteredTransactions.slice(0, limit)
    : filteredTransactions;

  // ── Selection helpers ──

  const allSelected = displayedTransactions.length > 0 &&
    displayedTransactions.every((t) => selectedIds.has(t.id));
  const someSelected = !allSelected && displayedTransactions.some((t) => selectedIds.has(t.id));
  const selectedCount = selectedIds.size;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedTransactions.map((t) => t.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ── Formatting helpers ──

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((c) => c.nome === categoryName);
    return category?.cor || '#6b7280';
  };

  // ── Single delete ──
  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setDeletingId(null);
    toast.success('Transação excluída.');
  };

  // ── Bulk delete ──
  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteTransaction(id)));
      toast.success(`${selectedCount} transação(ões) excluída(s).`);
      exitSelectionMode();
    } catch {
      toast.error('Erro ao excluir transações.');
    } finally {
      setBulkLoading(false);
      setBulkDeleteOpen(false);
    }
  };

  // ── Bulk edit ──
  const handleBulkEdit = async (
    patch: Partial<Pick<Transaction, 'tipo' | 'categoria' | 'forma_pagamento'>>
  ) => {
    const targets = filteredTransactions.filter((t) => selectedIds.has(t.id));
    try {
      await Promise.all(targets.map((t) => updateTransaction({ ...t, ...patch })));
      toast.success(`${selectedCount} transação(ões) atualizada(s).`);
      exitSelectionMode();
    } catch {
      toast.error('Erro ao atualizar transações.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        {/* ── Card header ── */}
        <CardHeader className={cn('pb-3', !showTitle && 'pt-4 pb-0')}>
          <div className="flex items-center justify-between gap-2">
            {showTitle && (
              <CardTitle className="text-lg font-semibold">Últimas Transações</CardTitle>
            )}
            {!showTitle && <div />}

            {/* Toolbar buttons */}
            {!selectionMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="gap-1.5 h-8 text-xs"
                disabled={displayedTransactions.length === 0}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Selecionar
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Select-all checkbox */}
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : someSelected ? (
                    <Minus className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {allSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSelectionMode}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn(!showTitle && 'pt-3')}>
          <div className="space-y-2">
            {displayedTransactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              displayedTransactions.map((transaction) => {
                const isSelected = selectedIds.has(transaction.id);
                return (
                  <div
                    key={transaction.id}
                    onClick={() => selectionMode && toggleSelection(transaction.id)}
                    className={cn(
                      'flex items-center justify-between rounded-lg border bg-card p-3.5 transition-all',
                      selectionMode
                        ? 'cursor-pointer hover:bg-accent/50'
                        : 'hover:shadow-sm',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    {/* Checkbox (visible in selection mode) */}
                    {selectionMode && (
                      <div className="mr-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(transaction.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    )}

                    {/* Icon + info */}
                    <div className="flex flex-1 items-start gap-3 sm:gap-4 min-w-0">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          transaction.tipo === 'Receita'
                            ? 'bg-emerald-500/10'
                            : 'bg-rose-500/10'
                        )}
                      >
                        {transaction.tipo === 'Receita' ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-rose-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium text-sm">{transaction.descricao}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>
                            {(() => {
                              const [year, month, day] = transaction.data.split('-').map(Number);
                              return format(new Date(year, month - 1, day), "dd 'de' MMM", { locale: ptBR });
                            })()}
                          </span>
                          <span>•</span>
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0"
                            style={{
                              backgroundColor: `${getCategoryColor(transaction.categoria)}20`,
                              color: getCategoryColor(transaction.categoria),
                            }}
                          >
                            {transaction.categoria}
                          </Badge>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{transaction.forma_pagamento}</span>
                        </div>
                      </div>
                    </div>

                    {/* Value + actions */}
                    <div className="flex shrink-0 items-center gap-2 ml-2">
                      <span
                        className={cn(
                          'font-semibold text-sm',
                          transaction.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600'
                        )}
                      >
                        {transaction.tipo === 'Receita' ? '+' : '-'}{' '}
                        {formatCurrency(transaction.valor)}
                      </span>

                      {!selectionMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
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
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Bulk action bar (floating) ── */}
      {selectionMode && selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-xl ring-1 ring-black/5">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} selecionada{selectedCount !== 1 ? 's' : ''}
            </span>
            <div className="h-4 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkEditOpen(true)}
              className="gap-1.5 h-8"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-1.5 h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
            <button
              onClick={exitSelectionMode}
              className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Single edit ── */}
      {editingTransaction && (
        <TransactionForm
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
        />
      )}

      {/* ── Single delete confirm ── */}
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

      {/* ── Bulk delete confirm ── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedCount} transação{selectedCount !== 1 ? 'ões' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente as {selectedCount} transações selecionadas.
              Não é possível desfazer esta operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk edit dialog ── */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        count={selectedCount}
        onConfirm={handleBulkEdit}
      />
    </>
  );
}
