import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Transaction, TransactionType, PaymentMethod } from '@/types/finance';
import { Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Valor sentinela para Radix Select (não permite value="") */
const NO_ACCOUNT_VALUE = '__none__';

const formSchema = z.object({
  data: z.date({ required_error: 'Selecione uma data' }),
  tipo: z.enum(['Receita', 'Despesa', 'Transferência'], { required_error: 'Selecione o tipo' }),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(100, 'Máximo 100 caracteres'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  categoria: z.string().optional(),
  forma_pagamento: z.enum(['Cartão', 'PIX', 'Dinheiro', 'Transferência', 'Boleto'], {
    required_error: 'Selecione a forma de pagamento',
  }),
  conta_id: z.string().optional(),
  conta_destino_id: z.string().optional(),
  observacao: z.string().max(200, 'Máximo 200 caracteres').optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'Transferência') {
    if (!data.conta_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_id'], message: 'Selecione a conta de origem' });
    }
    if (!data.conta_destino_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'Selecione a conta de destino' });
    }
    if (data.conta_id && data.conta_destino_id && data.conta_id === data.conta_destino_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'A conta de destino deve ser diferente da origem' });
    }
  } else {
    if (!data.categoria) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoria'], message: 'Selecione uma categoria' });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
}

export function TransactionForm({ open, onOpenChange, transaction }: TransactionFormProps) {
  const { categories, bankAccounts, addTransaction, updateTransaction, isLoading, isConnected, hasOfflineSnapshot } = useFinanceContext();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: transaction
      ? {
          data: (() => {
            // Parse date string safely to avoid timezone issues
            const [year, month, day] = transaction.data.split('-').map(Number);
            return new Date(year, month - 1, day);
          })(),
          tipo: transaction.tipo,
          descricao: transaction.descricao,
          valor: transaction.valor.toString(),
          categoria: transaction.categoria,
          forma_pagamento: transaction.forma_pagamento,
          conta_id: transaction.conta_id || '',
          conta_destino_id: transaction.conta_destino_id || '',
          observacao: transaction.observacao || '',
        }
      : {
          tipo: 'Despesa',
          descricao: '',
          valor: '',
          categoria: '',
          forma_pagamento: 'PIX',
          conta_id: '',
          conta_destino_id: '',
          observacao: '',
        },
  });

  const tipoAtual = form.watch('tipo');

  const categoriesForTipo = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      const nome = (c.nome || '').trim();
      if (!nome || seen.has(nome)) return false;
      seen.add(nome);
      const t = c.tipo ?? 'Despesa';
      if (tipoAtual === 'Receita') return t === 'Receita' || t === 'Ambos';
      if (tipoAtual === 'Despesa') return t === 'Despesa' || t === 'Ambos';
      return true;
    });
  }, [categories, tipoAtual]);

  const onSubmit = async (data: FormData) => {
    if (!isConnected) {
      toast.error(
        hasOfflineSnapshot
          ? 'Você está em modo offline (somente leitura). Conecte ao Google Sheets para salvar alterações.'
          : 'Conecte ao Google Sheets para salvar alterações.'
      );
      return;
    }

    const isTransfer = data.tipo === 'Transferência';
    const transactionData = {
      data: format(data.data, 'yyyy-MM-dd'),
      tipo: data.tipo as TransactionType,
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(',', '.')),
      categoria: isTransfer ? 'Transferência' : (data.categoria || ''),
      forma_pagamento: (isTransfer ? 'Transferência' : data.forma_pagamento) as PaymentMethod,
      conta_id: data.conta_id && data.conta_id !== NO_ACCOUNT_VALUE ? data.conta_id : undefined,
      conta_destino_id: isTransfer ? (data.conta_destino_id || undefined) : undefined,
      transferencia_id: isTransfer ? crypto.randomUUID() : undefined,
      observacao: data.observacao || '',
    };

    try {
      let success = false;
      if (transaction) {
        success = await updateTransaction(transaction.id, transactionData);
        if (success) {
          toast.success('Transação atualizada com sucesso!');
        } else {
          toast.error('Erro ao atualizar transação. Tente novamente.');
          return;
        }
      } else {
        success = await addTransaction(transactionData);
        if (success) {
          toast.success('Transação cadastrada com sucesso!');
        } else {
          toast.error('Erro ao cadastrar transação. Tente novamente.');
          return;
        }
      }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting transaction:', error);
      toast.error('Erro ao processar transação. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          <DialogDescription>
            {transaction
              ? 'Atualize os dados da transação'
              : 'Preencha os dados para cadastrar uma nova transação'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                        <SelectItem value="Transferência">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-sky-500" />
                            Transferência
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              'Selecione'
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Salário, Aluguel, Mercado..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="0,00"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.,]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipoAtual !== 'Transferência' ? (
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(() => {
                            const current = (field.value || '').trim();
                            const inList = categoriesForTipo.some((c) => c.nome.trim() === current);
                            return (
                              <>
                                {current && !inList && (
                                  <SelectItem key="__orphan_cat__" value={current}>
                                    {current} (fora da lista)
                                  </SelectItem>
                                )}
                                {categoriesForTipo.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.nome.trim()}>
                                    {cat.nome.trim()}
                                  </SelectItem>
                                ))}
                              </>
                            );
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="flex items-center rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Categoria: <span className="ml-1 font-medium text-foreground">Transferência</span>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="forma_pagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {bankAccounts.filter((a) => a.ativo).length > 0 && (
              <div className={cn('grid gap-4', tipoAtual === 'Transferência' ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                <FormField
                  control={form.control}
                  name="conta_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                        {tipoAtual === 'Transferência' ? 'Conta de origem' : 'Conta (opcional)'}
                      </FormLabel>
                      <Select
                        value={field.value ? field.value : NO_ACCOUNT_VALUE}
                        onValueChange={(v) => field.onChange(v === NO_ACCOUNT_VALUE ? '' : v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tipoAtual === 'Transferência' ? 'Selecione' : 'Sem conta vinculada'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tipoAtual !== 'Transferência' && (
                            <SelectItem value={NO_ACCOUNT_VALUE}>Sem conta</SelectItem>
                          )}
                          {bankAccounts.filter((a) => a.ativo).map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.cor }} />
                                {acc.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {tipoAtual === 'Transferência' && (
                  <FormField
                    control={form.control}
                    name="conta_destino_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                          Conta de destino
                        </FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bankAccounts.filter((a) => a.ativo).map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.cor }} />
                                  {acc.nome}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione uma observação..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transaction ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
