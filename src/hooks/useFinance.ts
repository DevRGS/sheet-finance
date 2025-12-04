import { useState, useCallback, useMemo, useEffect } from 'react';
import { Transaction, Category, Goal, TransactionFilters } from '@/types/finance';
import { getMonthlyData, getCategoryData } from '@/data/mockData';
import * as sheetsService from '@/services/googleSheets';

const defaultCategories: Category[] = [
  { id: '1', nome: 'Alimentação', cor: '#a78bfa' },
  { id: '2', nome: 'Moradia', cor: '#c084fc' },
  { id: '3', nome: 'Transporte', cor: '#818cf8' },
  { id: '4', nome: 'Educação', cor: '#8b5cf6' },
  { id: '5', nome: 'Saúde', cor: '#737373' },
  { id: '6', nome: 'Lazer', cor: '#a855f7' },
  { id: '7', nome: 'Investimentos', cor: '#22c55e' },
  { id: '8', nome: 'Outros', cor: '#6b7280' },
];

export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    tipo: 'all',
    categoria: 'all',
    periodo: { inicio: null, fim: null },
  });

  // Load data from Google Sheets when connected
  const loadData = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const [transactionsData, categoriesData, goalsData] = await Promise.all([
        sheetsService.fetchTransactions(),
        sheetsService.fetchCategories(),
        sheetsService.fetchGoals(),
      ]);
      
      setTransactions(transactionsData);
      if (categoriesData.length > 0) {
        setCategories(categoriesData);
      }
      setGoals(goalsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected, loadData]);

  const connectToSheets = useCallback(async () => {
    setIsInitializing(true);
    try {
      const testResult = await sheetsService.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      const initResult = await sheetsService.initializeSpreadsheet();
      if (!initResult.success) {
        throw new Error(initResult.message);
      }

      setIsConnected(true);
      return { success: true, message: 'Conexão estabelecida com sucesso!' };
    } catch (error) {
      console.error('Connection error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao conectar' 
      };
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.addTransaction(transaction);
        if (success) {
          await loadData();
        }
      } else {
        const newTransaction: Transaction = {
          ...transaction,
          id: Date.now().toString(),
        };
        setTransactions((prev) => [newTransaction, ...prev]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData]);

  const updateTransaction = useCallback(async (id: string, transaction: Partial<Transaction>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.updateTransaction(id, transaction, transactions);
        if (success) {
          await loadData();
        }
      } else {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...transaction } : t))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.deleteTransaction(id, transactions);
        if (success) {
          await loadData();
        }
      } else {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, transactions]);

  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.addCategory(category);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        const newCategory: Category = {
          ...category,
          id: Date.now().toString(),
        };
        setCategories((prev) => [...prev, newCategory]);
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData]);

  const updateCategory = useCallback(async (id: string, category: Partial<Category>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.updateCategory(id, category, categories);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...category } : c))
        );
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, categories]);

  const deleteCategory = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.deleteCategory(id, categories);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, categories]);

  const addGoal = useCallback(async (goal: Omit<Goal, 'id'>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.addGoal(goal);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        const newGoal: Goal = {
          ...goal,
          id: Date.now().toString(),
        };
        setGoals((prev) => [...prev, newGoal]);
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData]);

  const updateGoal = useCallback(async (id: string, goal: Partial<Goal>) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.updateGoal(id, goal, goals);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        setGoals((prev) =>
          prev.map((g) => (g.id === id ? { ...g, ...goal } : g))
        );
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, goals]);

  const deleteGoal = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected) {
        const success = await sheetsService.deleteGoal(id, goals);
        if (success) {
          await loadData();
        }
        return success;
      } else {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        return true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, loadData, goals]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          t.descricao.toLowerCase().includes(searchLower) ||
          t.categoria.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filters.tipo !== 'all' && t.tipo !== filters.tipo) {
        return false;
      }

      // Category filter
      if (filters.categoria !== 'all' && t.categoria !== filters.categoria) {
        return false;
      }

      // Date range filter
      if (filters.periodo.inicio) {
        const transactionDate = new Date(t.data);
        const startDate = new Date(filters.periodo.inicio);
        if (transactionDate < startDate) return false;
      }

      if (filters.periodo.fim) {
        const transactionDate = new Date(t.data);
        const endDate = new Date(filters.periodo.fim);
        if (transactionDate > endDate) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [transactions, filters]);

  const stats = useMemo(() => {
    const totalReceitas = transactions
      .filter((t) => t.tipo === 'Receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalDespesas = transactions
      .filter((t) => t.tipo === 'Despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    const saldo = totalReceitas - totalDespesas;

    const currentMonth = new Date().toISOString().substring(0, 7);
    const currentMonthTransactions = transactions.filter(
      (t) => t.data.substring(0, 7) === currentMonth
    );

    const receitasMes = currentMonthTransactions
      .filter((t) => t.tipo === 'Receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const despesasMes = currentMonthTransactions
      .filter((t) => t.tipo === 'Despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    return {
      totalReceitas,
      totalDespesas,
      saldo,
      receitasMes,
      despesasMes,
      saldoMes: receitasMes - despesasMes,
    };
  }, [transactions]);

  const monthlyData = useMemo(() => getMonthlyData(transactions), [transactions]);
  const categoryData = useMemo(() => getCategoryData(transactions, categories), [transactions, categories]);

  return {
    transactions,
    filteredTransactions,
    categories,
    goals,
    isConnected,
    isLoading,
    isInitializing,
    stats,
    monthlyData,
    categoryData,
    filters,
    setFilters,
    connectToSheets,
    loadData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addGoal,
    updateGoal,
    deleteGoal,
  };
}
