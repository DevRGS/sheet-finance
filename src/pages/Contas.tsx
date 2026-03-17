import { useState, useMemo } from 'react';
import { Plus, Wallet, Pencil, Trash2, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { BankAccountForm } from '@/components/finance/BankAccountForm';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { BankAccount, AccountType } from '@/types/finance';
import { toast } from 'sonner';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const TIPO_LABELS: Record<AccountType, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimentos',
  carteira: 'Carteira',
  cartao_credito: 'Cartão de Crédito',
};

export default function Contas() {
  const { bankAccounts, transactions, updateBankAccount, deleteBankAccount } = useFinanceContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const balanceByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    bankAccounts.forEach((a) => {
      map[a.id] = a.saldo_inicial;
    });
    transactions.forEach((t) => {
      if (!t.conta_id || !map[t.conta_id] === undefined) return;
      if (map[t.conta_id] === undefined) return;
      if (t.tipo === 'Receita') map[t.conta_id] += t.valor;
      else map[t.conta_id] -= t.valor;
    });
    return map;
  }, [bankAccounts, transactions]);

  const totalBalance = useMemo(() => {
    return bankAccounts
      .filter((a) => a.ativo && a.tipo !== 'cartao_credito')
      .reduce((sum, a) => sum + (balanceByAccount[a.id] || 0), 0);
  }, [bankAccounts, balanceByAccount]);

  const handleEdit = (account: BankAccount) => {
    setEditing(account);
    setFormOpen(true);
  };

  const handleToggleAtivo = async (account: BankAccount) => {
    await updateBankAccount(account.id, { ativo: !account.ativo });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteBankAccount(deleteTarget);
    if (success) toast.success('Conta excluída!');
    else toast.error('Erro ao excluir conta');
    setDeleteTarget(null);
  };

  const activeAccounts = bankAccounts.filter((a) => a.ativo);
  const inactiveAccounts = bankAccounts.filter((a) => !a.ativo);

  const AccountCard = ({ account }: { account: BankAccount }) => {
    const balance = balanceByAccount[account.id] ?? account.saldo_inicial;
    const isNegative = balance < 0;

    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: account.cor }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${account.cor}20` }}>
                <Wallet className="h-4 w-4" style={{ color: account.cor }} />
              </div>
              <div>
                <p className="font-semibold leading-tight">{account.nome}</p>
                <p className="text-xs text-muted-foreground">{TIPO_LABELS[account.tipo]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(account)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(account.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {account.banco && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {account.banco}
            </div>
          )}

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Saldo atual</p>
              <p className={`text-lg font-bold ${isNegative ? 'text-destructive' : 'text-foreground'}`}>
                {isNegative && '−'}
                {formatCurrency(Math.abs(balance))}
              </p>
            </div>
            {isNegative ? (
              <TrendingDown className="h-5 w-5 text-destructive" />
            ) : (
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs text-muted-foreground">Conta ativa</span>
            <Switch
              checked={account.ativo}
              onCheckedChange={() => handleToggleAtivo(account)}
            />
          </div>
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
                <h1 className="text-lg font-semibold sm:text-xl">Contas Bancárias</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Gerencie suas contas e acompanhe os saldos
                </p>
              </div>
              <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova Conta</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Total balance summary */}
            {bankAccounts.length > 0 && (
              <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                <p className="text-sm text-muted-foreground">Saldo Total (contas ativas)</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeAccounts.length} conta(s) ativa(s)</p>
              </div>
            )}

            {bankAccounts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center gap-3">
                <Wallet className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nenhuma conta cadastrada</p>
                  <p className="text-sm text-muted-foreground">Adicione suas contas bancárias para controlar seu saldo</p>
                </div>
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />Adicionar Conta
                </Button>
              </div>
            )}

            {activeAccounts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Contas Ativas
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeAccounts.map((a) => <AccountCard key={a.id} account={a} />)}
                </div>
              </section>
            )}

            {inactiveAccounts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  Contas Inativas
                  <Badge variant="secondary">{inactiveAccounts.length}</Badge>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                  {inactiveAccounts.map((a) => <AccountCard key={a.id} account={a} />)}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <BankAccountForm open={formOpen} onOpenChange={setFormOpen} account={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
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
