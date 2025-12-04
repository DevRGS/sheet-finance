import { useState } from 'react';
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
import { Bill, BillType } from '@/types/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formSchema = z.object({
  tipo: z.enum(['pagar', 'receber'], { required_error: 'Selecione o tipo' }),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(100, 'Máximo 100 caracteres'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  categoria: z.string().min(1, 'Selecione uma categoria'),
  data_vencimento: z.date().optional().nullable(),
  data_pagamento: z.date().optional().nullable(),
  pago: z.boolean(),
  observacao: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: Bill | null;
}

export function BillForm({ open, onOpenChange, bill }: BillFormProps) {
  const { categories, addBill, updateBill, isLoading } = useFinanceContext();
  const [calendarVencimentoOpen, setCalendarVencimentoOpen] = useState(false);
  const [calendarPagamentoOpen, setCalendarPagamentoOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: bill
      ? {
          tipo: bill.tipo,
          descricao: bill.descricao,
          valor: bill.valor.toString(),
          categoria: bill.categoria,
          data_vencimento: bill.data_vencimento
            ? (() => {
                const [year, month, day] = bill.data_vencimento.split('-').map(Number);
                return new Date(year, month - 1, day);
              })()
            : null,
          data_pagamento: bill.data_pagamento
            ? (() => {
                const [year, month, day] = bill.data_pagamento.split('-').map(Number);
                return new Date(year, month - 1, day);
              })()
            : null,
          pago: bill.pago,
          observacao: bill.observacao || '',
        }
      : {
          tipo: 'pagar',
          descricao: '',
          valor: '',
          categoria: '',
          data_vencimento: null,
          data_pagamento: null,
          pago: false,
          observacao: '',
        },
  });

  const onSubmit = async (data: FormData) => {
    const billData = {
      tipo: data.tipo as BillType,
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(',', '.')),
      categoria: data.categoria,
      data_vencimento: data.data_vencimento ? format(data.data_vencimento, 'yyyy-MM-dd') : null,
      data_pagamento: data.data_pagamento ? format(data.data_pagamento, 'yyyy-MM-dd') : null,
      pago: data.pago,
      observacao: data.observacao || '',
    };

    try {
      let success = false;
      if (bill) {
        success = await updateBill(bill.id, billData);
        if (success) {
          toast.success('Conta atualizada com sucesso!');
          onOpenChange(false);
        } else {
          toast.error('Erro ao atualizar conta. Tente novamente.');
        }
      } else {
        success = await addBill(billData);
        if (success) {
          toast.success('Conta adicionada com sucesso!');
          onOpenChange(false);
          form.reset();
        } else {
          toast.error('Erro ao adicionar conta. Tente novamente.');
        }
      }
    } catch (error) {
      console.error('Error submitting bill:', error);
      toast.error('Erro ao processar conta. Tente novamente.');
    }
  };

  const watchedPago = form.watch('pago');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{bill ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          <DialogDescription>
            {bill ? 'Atualize as informações da conta' : 'Adicione uma nova conta a pagar ou receber'}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pagar">Conta a Pagar</SelectItem>
                        <SelectItem value="receber">Conta a Receber</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aluguel, Salário..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
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

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Vencimento (Opcional)</FormLabel>
                    <Popover open={calendarVencimentoOpen} onOpenChange={setCalendarVencimentoOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
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
                          selected={field.value || undefined}
                          onSelect={(date) => {
                            field.onChange(date || null);
                            setCalendarVencimentoOpen(false);
                          }}
                          disabled={(date) => date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_pagamento"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Pagamento/Recebimento (Opcional)</FormLabel>
                    <Popover open={calendarPagamentoOpen} onOpenChange={setCalendarPagamentoOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
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
                          selected={field.value || undefined}
                          onSelect={(date) => {
                            field.onChange(date || null);
                            setCalendarPagamentoOpen(false);
                          }}
                          disabled={(date) => date < new Date('1900-01-01')}
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
              name="pago"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Conta Paga/Recebida</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Marque se a conta já foi paga ou recebida
                    </div>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (Opcional)</FormLabel>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {bill ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

