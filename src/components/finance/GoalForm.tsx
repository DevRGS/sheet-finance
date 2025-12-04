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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Goal } from '@/types/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo 100 caracteres'),
  valor_alvo: z.string().min(1, 'Valor alvo é obrigatório'),
  valor_atual: z.string(),
  prazo: z.date().optional(),
  cor: z.string().min(1, 'Selecione uma cor'),
});

type FormData = z.infer<typeof formSchema>;

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}

const colorOptions = [
  '#a78bfa', '#c084fc', '#818cf8', '#8b5cf6',
  '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
];

export function GoalForm({ open, onOpenChange, goal }: GoalFormProps) {
  const { addGoal, updateGoal, isLoading } = useFinanceContext();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: goal
      ? {
          nome: goal.nome,
          valor_alvo: goal.valor_alvo.toString(),
          valor_atual: goal.valor_atual.toString(),
          prazo: goal.prazo ? new Date(goal.prazo) : undefined,
          cor: goal.cor,
        }
      : {
          nome: '',
          valor_alvo: '',
          valor_atual: '0',
          cor: colorOptions[0],
        },
  });

  const onSubmit = async (data: FormData) => {
    const goalData = {
      nome: data.nome,
      valor_alvo: parseFloat(data.valor_alvo.replace(',', '.')),
      valor_atual: parseFloat(data.valor_atual.replace(',', '.')) || 0,
      prazo: data.prazo ? format(data.prazo, 'yyyy-MM-dd') : '',
      cor: data.cor,
    };

    let success: boolean;
    if (goal) {
      success = await updateGoal(goal.id, goalData);
      if (success) {
        toast.success('Meta atualizada com sucesso!');
      }
    } else {
      success = await addGoal(goalData);
      if (success) {
        toast.success('Meta cadastrada com sucesso!');
      }
    }

    if (success) {
      form.reset();
      onOpenChange(false);
    } else {
      toast.error('Erro ao salvar meta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{goal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          <DialogDescription>
            {goal
              ? 'Atualize os dados da sua meta financeira'
              : 'Defina uma meta de economia para acompanhar seu progresso'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Meta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Viagem de férias" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="valor_alvo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Alvo (R$)</FormLabel>
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
                name="valor_atual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Atual (R$)</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="prazo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo (opcional)</FormLabel>
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
                            'Selecione uma data'
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
                            field.value === color
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-105'
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {goal ? 'Salvar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
