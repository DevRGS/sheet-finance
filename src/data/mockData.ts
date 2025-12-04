import { Transaction, Category, MonthlyData, CategoryData } from '@/types/finance';

export const defaultCategories: Category[] = [
  { id: '1', nome: 'Alimentação', cor: 'hsl(var(--chart-1))' },
  { id: '2', nome: 'Moradia', cor: 'hsl(var(--chart-2))' },
  { id: '3', nome: 'Transporte', cor: 'hsl(var(--chart-3))' },
  { id: '4', nome: 'Educação', cor: 'hsl(var(--chart-4))' },
  { id: '5', nome: 'Saúde', cor: 'hsl(var(--chart-5))' },
  { id: '6', nome: 'Lazer', cor: 'hsl(258 89% 66%)' },
  { id: '7', nome: 'Investimentos', cor: 'hsl(150 60% 45%)' },
  { id: '8', nome: 'Outros', cor: 'hsl(240 3% 46%)' },
];

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    data: '2024-01-05',
    tipo: 'Receita',
    descricao: 'Salário',
    valor: 8500,
    categoria: 'Outros',
    forma_pagamento: 'Transferência',
    observacao: 'Salário mensal',
  },
  {
    id: '2',
    data: '2024-01-10',
    tipo: 'Despesa',
    descricao: 'Aluguel',
    valor: 2000,
    categoria: 'Moradia',
    forma_pagamento: 'Boleto',
  },
  {
    id: '3',
    data: '2024-01-12',
    tipo: 'Despesa',
    descricao: 'Supermercado',
    valor: 850,
    categoria: 'Alimentação',
    forma_pagamento: 'Cartão',
  },
  {
    id: '4',
    data: '2024-01-15',
    tipo: 'Despesa',
    descricao: 'Combustível',
    valor: 350,
    categoria: 'Transporte',
    forma_pagamento: 'Cartão',
  },
  {
    id: '5',
    data: '2024-01-18',
    tipo: 'Receita',
    descricao: 'Freelance',
    valor: 2000,
    categoria: 'Outros',
    forma_pagamento: 'PIX',
  },
  {
    id: '6',
    data: '2024-01-20',
    tipo: 'Despesa',
    descricao: 'Curso Online',
    valor: 297,
    categoria: 'Educação',
    forma_pagamento: 'Cartão',
  },
  {
    id: '7',
    data: '2024-01-22',
    tipo: 'Despesa',
    descricao: 'Academia',
    valor: 150,
    categoria: 'Saúde',
    forma_pagamento: 'Cartão',
  },
  {
    id: '8',
    data: '2024-01-25',
    tipo: 'Despesa',
    descricao: 'Cinema',
    valor: 80,
    categoria: 'Lazer',
    forma_pagamento: 'PIX',
  },
  {
    id: '9',
    data: '2024-02-05',
    tipo: 'Receita',
    descricao: 'Salário',
    valor: 8500,
    categoria: 'Outros',
    forma_pagamento: 'Transferência',
  },
  {
    id: '10',
    data: '2024-02-10',
    tipo: 'Despesa',
    descricao: 'Aluguel',
    valor: 2000,
    categoria: 'Moradia',
    forma_pagamento: 'Boleto',
  },
  {
    id: '11',
    data: '2024-02-15',
    tipo: 'Despesa',
    descricao: 'Mercado',
    valor: 920,
    categoria: 'Alimentação',
    forma_pagamento: 'Cartão',
  },
  {
    id: '12',
    data: '2024-03-05',
    tipo: 'Receita',
    descricao: 'Salário',
    valor: 8500,
    categoria: 'Outros',
    forma_pagamento: 'Transferência',
  },
  {
    id: '13',
    data: '2024-03-08',
    tipo: 'Despesa',
    descricao: 'Investimento Ações',
    valor: 1500,
    categoria: 'Investimentos',
    forma_pagamento: 'Transferência',
  },
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
    cor: categories.find((c) => c.nome === categoria)?.cor || 'hsl(var(--muted))',
  }));
};
