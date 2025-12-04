import { Transaction, Category, MonthlyData, CategoryData } from '@/types/finance';

export const defaultCategories: Category[] = [
  { id: '1', nome: 'Alimentação', cor: '#a78bfa' },
  { id: '2', nome: 'Moradia', cor: '#c084fc' },
  { id: '3', nome: 'Transporte', cor: '#818cf8' },
  { id: '4', nome: 'Educação', cor: '#8b5cf6' },
  { id: '5', nome: 'Saúde', cor: '#737373' },
  { id: '6', nome: 'Lazer', cor: '#a855f7' },
  { id: '7', nome: 'Investimentos', cor: '#22c55e' },
  { id: '8', nome: 'Outros', cor: '#6b7280' },
];

export const getMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
  const monthlyMap = new Map<string, { receitas: number; despesas: number }>();

  transactions.forEach((t) => {
    const month = t.data.substring(0, 7);
    const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };

    if (t.tipo === 'Receita') {
      current.receitas += t.valor;
    } else {
      current.despesas += t.valor;
    }

    monthlyMap.set(month, current);
  });

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receitas: data.receitas,
      despesas: data.despesas,
      saldo: data.receitas - data.despesas,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const getCategoryData = (transactions: Transaction[], categories: Category[]): CategoryData[] => {
  const categoryMap = new Map<string, number>();

  transactions
    .filter((t) => t.tipo === 'Despesa')
    .forEach((t) => {
      const current = categoryMap.get(t.categoria) || 0;
      categoryMap.set(t.categoria, current + t.valor);
    });

  return Array.from(categoryMap.entries()).map(([categoria, valor]) => ({
    categoria,
    valor,
    cor: categories.find((c) => c.nome === categoria)?.cor || '#6b7280',
  }));
};
