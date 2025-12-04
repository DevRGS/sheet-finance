import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
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
  FormDescription,
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { RecurringTransaction, TransactionType, PaymentMethod, RecurrenceType, RecurrenceEndType } from '@/types/finance';

const formSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.enum(['Receita', 'Despesa']),
  valor: z.string().min(1, 'Valor é obrigatório').refine(
    (val) => !isNaN(parseFloat(val.replace(',', '.'))) && parseFloat(val.replace(',', '.')) > 0,
    'Valor deve ser um número positivo'
  ),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  forma_pagamento: z.enum(['Cartão', 'PIX', 'Dinheiro', 'Transferência', 'Boleto']),
  data_inicio: z.date({
    required_error: 'Data de início é obrigatória',
  }),
  recorrencia: z.enum(['mensal', 'bimestral', 'trimestral', 'semestral', 'anual']),
  fim_tipo: z.enum(['after_months', 'until_cancelled']),
  meses_duracao: z.string().optional(),
  observacao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RecurringTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: RecurringTransaction;
}

export function RecurringTransactionForm({
  open,
  onOpenChange,
  transaction,
}: RecurringTransactionFormProps) {
  const { categories, addRecurringTransaction, updateRecurringTransaction } = useFinanceContext();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: '',
      tipo: 'Despesa',
      valor: '',
      categoria: '',
      forma_pagamento: 'PIX',
      data_inicio: new Date(),
      recorrencia: 'mensal',
      fim_tipo: 'until_cancelled',
      meses_duracao: '',
      observacao: '',
    },
  });

  useEffect(() => {
    if (transaction) {
      form.reset({
        descricao: transaction.descricao,
        tipo: transaction.tipo,
        valor: transaction.valor.toString().replace('.', ','),
        categoria: transaction.categoria,
        forma_pagamento: transaction.forma_pagamento,
        data_inicio: (() => {
          const [year, month, day] = transaction.data_inicio.split('-').map(Number);
          return new Date(year, month - 1, day);
        })(),
        recorrencia: transaction.recorrencia,
        fim_tipo: transaction.fim_tipo,
        meses_duracao: transaction.meses_duracao?.toString() || '',
        observacao: transaction.observacao || '',
      });
    } else {
      form.reset({
        descricao: '',
        tipo: 'Despesa',
        valor: '',
        categoria: '',
        forma_pagamento: 'PIX',
        data_inicio: new Date(),
        recorrencia: 'mensal',
        fim_tipo: 'until_cancelled',
        meses_duracao: '',
        observacao: '',
      });
    }
  }, [transaction, form, open]);

  const fimTipo = form.watch('fim_tipo');

  const onSubmit = async (data: FormData) => {
    const transactionData = {
      descricao: data.descricao,
      tipo: data.tipo as TransactionType,
      valor: parseFloat(data.valor.replace(',', '.')),
      categoria: data.categoria,
      forma_pagamento: data.forma_pagamento as PaymentMethod,
      data_inicio: format(data.data_inicio, 'yyyy-MM-dd'),
      recorrencia: data.recorrencia as RecurrenceType,
      fim_tipo: data.fim_tipo as RecurrenceEndType,
      meses_duracao: data.fim_tipo === 'after_months' && data.meses_duracao 
        ? parseInt(data.meses_duracao) 
        : undefined,
      ativo: true,
      observacao: data.observacao || '',
    };

    try {
      let success = false;
      if (transaction) {
        success = await updateRecurringTransaction(transaction.id, transactionData);
        if (success) {
          toast.success('Transação recorrente atualizada com sucesso!');
        } else {
          toast.error('Erro ao atualizar transação recorrente. Tente novamente.');
          return;
        }
      } else {
        success = await addRecurringTransaction(transactionData);
        if (success) {
          toast.success('Transação recorrente cadastrada com sucesso!');
        } else {
          toast.error('Erro ao cadastrar transação recorrente. Tente novamente.');
          return;
        }
      }

      if (success) {
        form.reset();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Recurring transaction form submission error:', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transação Recorrente' : 'Nova Transação Recorrente'}
          </DialogTitle>
          <DialogDescription>
            Configure uma transação que se repete automaticamente
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Netflix, Salário..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Receita">Receita</SelectItem>
                        <SelectItem value="Despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d,]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="forma_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cartão">Cartão</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="recorrencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recorrência</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a recorrência" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="bimestral">Bimestral</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fim_tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim da Recorrência</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="until_cancelled">Até cancelar</SelectItem>
                        <SelectItem value="after_months">Após X meses</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {fimTipo === 'after_months' && (
              <FormField
                control={form.control}
                name="meses_duracao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (meses)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 12"
                        {...field}
                        min="1"
                      />
                    </FormControl>
                    <FormDescription>
                      Número de meses que a transação será repetida
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Observações adicionais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {transaction ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

