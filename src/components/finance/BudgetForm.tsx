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
import { Budget } from '@/types/finance';
import { toast } from 'sonner';

const formSchema = z.object({
  categoria: z.string().min(1, 'Selecione uma categoria'),
  valor_limite: z.string().min(1, 'Informe o valor limite').refine(
    (v) => parseFloat(v.replace(',', '.')) > 0,
    'Valor deve ser maior que zero'
  ),
  mes: z.string(),
});

type FormData = z.infer<typeof formSchema>;

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget | null;
}

// Sentinel: Radix Select.Item rejects empty string values
const RECURRING_VALUE = '__recorrente__';

export function BudgetForm({ open, onOpenChange, budget }: BudgetFormProps) {
  const { categories, addBudget, updateBudget, isLoading } = useFinanceContext();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: budget
      ? { categoria: budget.categoria, valor_limite: budget.valor_limite.toString(), mes: budget.mes || RECURRING_VALUE }
      : { categoria: '', valor_limite: '', mes: RECURRING_VALUE },
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      categoria: data.categoria,
      valor_limite: parseFloat(data.valor_limite.replace(',', '.')),
      // Convert sentinel back to empty string (stored as '' in the sheet)
      mes: data.mes === RECURRING_VALUE ? '' : data.mes,
    };

    const success = budget
      ? await updateBudget(budget.id, payload)
      : await addBudget(payload);

    if (success) {
      toast.success(budget ? 'Orçamento atualizado!' : 'Orçamento criado!');
      form.reset();
      onOpenChange(false);
    } else {
      toast.error('Erro ao salvar orçamento');
    }
  };

  // Generate months for the next 12 months
  const now = new Date();
  const monthOptions: { value: string; label: string }[] = [
    { value: RECURRING_VALUE, label: 'Recorrente (todo mês)' },
    ...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { value, label };
    }),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
          <DialogDescription>
            {budget ? 'Ajuste o limite de orçamento para a categoria' : 'Defina um limite de gastos por categoria'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.cor }} />
                            {cat.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valor_limite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite (R$)</FormLabel>
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
              name="mes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o período" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {budget ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
