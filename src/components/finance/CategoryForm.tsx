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
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Category } from '@/types/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(50, 'Máximo 50 caracteres'),
  cor: z.string().min(1, 'Selecione uma cor'),
});

type FormData = z.infer<typeof formSchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

const colorOptions = [
  '#a78bfa', '#c084fc', '#818cf8', '#8b5cf6',
  '#737373', '#a855f7', '#22c55e', '#6b7280',
  '#ef4444', '#f59e0b', '#06b6d4', '#ec4899',
];

export function CategoryForm({ open, onOpenChange, category }: CategoryFormProps) {
  const { addCategory, updateCategory, isLoading } = useFinanceContext();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: category
      ? { nome: category.nome, cor: category.cor }
      : { nome: '', cor: colorOptions[0] },
  });

  const onSubmit = async (data: FormData) => {
    let success: boolean;
    const categoryData = { nome: data.nome, cor: data.cor };
    if (category) {
      success = await updateCategory(category.id, categoryData);
      if (success) {
        toast.success('Categoria atualizada com sucesso!');
      }
    } else {
      success = await addCategory(categoryData);
      if (success) {
        toast.success('Categoria cadastrada com sucesso!');
      }
    }

    if (success) {
      form.reset();
      onOpenChange(false);
    } else {
      toast.error('Erro ao salvar categoria');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          <DialogDescription>
            {category
              ? 'Atualize os dados da categoria'
              : 'Crie uma nova categoria para suas transações'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Entretenimento" {...field} />
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
                {category ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
