import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { BankAccount, AccountType } from '@/types/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(60, 'Máximo 60 caracteres'),
  tipo: z.enum(['corrente', 'poupanca', 'investimento', 'carteira', 'cartao_credito']),
  banco: z.string().max(60, 'Máximo 60 caracteres').optional(),
  saldo_inicial: z.string().min(1, 'Informe o saldo inicial'),
  cor: z.string().min(1, 'Selecione uma cor'),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const TIPO_LABELS: Record<AccountType, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimentos',
  carteira: 'Carteira / Dinheiro',
  cartao_credito: 'Cartão de Crédito',
};

const colorOptions = [
  '#7c3aed', '#06b6d4', '#22c55e', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
];

interface BankAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BankAccount | null;
}

export function BankAccountForm({ open, onOpenChange, account }: BankAccountFormProps) {
  const { addBankAccount, updateBankAccount, isLoading } = useFinanceContext();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: account
      ? {
          nome: account.nome,
          tipo: account.tipo,
          banco: account.banco || '',
          saldo_inicial: account.saldo_inicial.toString(),
          cor: account.cor,
          ativo: account.ativo,
        }
      : {
          nome: '',
          tipo: 'corrente',
          banco: '',
          saldo_inicial: '0',
          cor: colorOptions[0],
          ativo: true,
        },
  });

  const onSubmit = async (data: FormData) => {
    const payload: Omit<BankAccount, 'id'> = {
      nome: data.nome,
      tipo: data.tipo as AccountType,
      banco: data.banco || '',
      saldo_inicial: parseFloat(data.saldo_inicial.replace(',', '.')) || 0,
      cor: data.cor,
      ativo: data.ativo,
    };

    const success = account
      ? await updateBankAccount(account.id, payload)
      : await addBankAccount(payload);

    if (success) {
      toast.success(account ? 'Conta atualizada!' : 'Conta adicionada!');
      form.reset();
      onOpenChange(false);
    } else {
      toast.error('Erro ao salvar conta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
          <DialogDescription>
            {account ? 'Atualize os dados da conta' : 'Adicione uma nova conta para controlar seu saldo'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nubank, Bradesco Principal..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(TIPO_LABELS) as [AccountType, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="banco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Nubank, Itaú..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="saldo_inicial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Inicial (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            'h-8 w-8 rounded-full border-2 transition-all',
                            field.value === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {account ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
