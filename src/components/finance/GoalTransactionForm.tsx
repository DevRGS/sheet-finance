import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
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
import { Goal, GoalTransactionType } from '@/types/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formSchema = z.object({
  tipo: z.enum(['deposito', 'saque'], { required_error: 'Selecione o tipo' }),
  valor: z.string().min(1, 'Valor é obrigatório'),
  data: z.date({ required_error: 'Selecione uma data' }),
  observacao: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GoalTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal;
}

export function GoalTransactionForm({ open, onOpenChange, goal }: GoalTransactionFormProps) {
  const { addGoalTransaction, isLoading } = useFinanceContext();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'deposito',
      valor: '',
      data: new Date(),
      observacao: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        tipo: 'deposito',
        valor: '',
        data: new Date(),
        observacao: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (data: FormData) => {
    const transactionData = {
      goal_id: goal.id,
      tipo: data.tipo as GoalTransactionType,
      valor: parseFloat(data.valor.replace(',', '.')),
      data: format(data.data, 'yyyy-MM-dd'),
      observacao: data.observacao || '',
    };

    try {
      const success = await addGoalTransaction(transactionData);
      if (success) {
        toast.success(
          data.tipo === 'deposito'
            ? 'Depósito adicionado com sucesso!'
            : 'Saque realizado com sucesso!'
        );
        form.reset();
        onOpenChange(false);
      } else {
        toast.error('Erro ao processar movimentação. Tente novamente.');
      }
    } catch (error) {
      console.error('Error submitting goal transaction:', error);
      toast.error('Erro ao processar movimentação. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimentação - {goal.nome}</DialogTitle>
          <DialogDescription>
            Adicione um depósito ou realize um saque nesta meta
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimentação</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="deposito">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          Depósito
                        </span>
                      </SelectItem>
                      <SelectItem value="saque">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-rose-500" />
                          Saque
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
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
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione uma observação sobre esta movimentação..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Valor Atual da Meta</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(goal.valor_atual)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Meta: {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(goal.valor_alvo)}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.watch('tipo') === 'deposito' ? 'Adicionar Depósito' : 'Realizar Saque'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

