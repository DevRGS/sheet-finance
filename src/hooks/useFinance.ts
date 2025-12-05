import { useState, useCallback, useMemo, useEffect } from 'react';
import { Transaction, Category, Goal, TransactionFilters, GoalTransaction, BalanceData, RecurringTransaction, ForecastTransaction, Bill } from '@/types/finance';
import { getMonthlyData, getCategoryData, getBalanceData } from '@/data/mockData';
import * as sheetsService from '@/services/googleSheets';
import { useGoogleSheetsConfig } from './useGoogleSheetsConfig';

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
  const { config, isValid } = useGoogleSheetsConfig();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalTransactions, setGoalTransactions] = useState<GoalTransaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
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
    if (!isConnected || !config || !isValid) return;
    
    setIsLoading(true);
    try {
      const [transactionsData, categoriesData, goalsData, recurringData, billsData] = await Promise.all([
        sheetsService.fetchTransactions(config),
        sheetsService.fetchCategories(config),
        sheetsService.fetchGoals(config),
        sheetsService.fetchRecurringTransactions(config),
        sheetsService.fetchBills(config),
      ]);
      
      setTransactions(transactionsData);
      if (categoriesData.length > 0) {
        setCategories(categoriesData);
      }
      setGoals(goalsData);
      setRecurringTransactions(recurringData);
      setBills(billsData);

      // Load all goal transactions
      const allGoalTransactions: GoalTransaction[] = [];
      for (const goal of goalsData) {
        try {
          const transactions = await sheetsService.fetchGoalTransactions(goal.id, config);
          allGoalTransactions.push(...transactions);
        } catch (error) {
          console.error(`Error loading transactions for goal ${goal.id}:`, error);
        }
      }
      setGoalTransactions(allGoalTransactions);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected, loadData]);

  const connectToSheets = useCallback(async () => {
    if (!config || !isValid) {
      return {
        success: false,
        message: 'Configure as credenciais antes de conectar',
      };
    }

    setIsInitializing(true);
    try {
      const testResult = await sheetsService.testConnection(config);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      const initResult = await sheetsService.initializeSpreadsheetPublic(config);
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
  }, [config, isValid]);

  // Auto-connect when credentials are valid and not yet connected
  useEffect(() => {
    if (config && isValid && !isConnected && !isInitializing) {
      // Small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        connectToSheets().catch((error) => {
          console.error('Auto-connect failed:', error);
          // Silently fail - user can manually connect if needed
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [config, isValid, isConnected, isInitializing, connectToSheets]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addTransaction(transaction, config);
        if (success) {
          await loadData();
          return true;
        }
        return false;
      } else {
        const newTransaction: Transaction = {
          ...transaction,
          id: Date.now().toString(),
        };
        setTransactions((prev) => [newTransaction, ...prev]);
        return true;
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  const updateTransaction = useCallback(async (id: string, transaction: Partial<Transaction>): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateTransaction(id, transaction, transactions, config);
        if (success) {
          await loadData();
          return true;
        }
        return false;
      } else {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...transaction } : t))
        );
        return true;
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData, transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteTransaction(id, transactions, config);
        if (success) {
          await loadData();
        }
      } else {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData, transactions]);

  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addCategory(category, config);
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
  }, [isConnected, config, isValid, loadData]);

  const updateCategory = useCallback(async (id: string, category: Partial<Category>) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateCategory(id, category, categories, config);
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
  }, [isConnected, config, isValid, loadData, categories]);

  const deleteCategory = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteCategory(id, categories, config);
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
  }, [isConnected, config, isValid, loadData, categories]);

  const addGoal = useCallback(async (goal: Omit<Goal, 'id'>) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addGoal(goal, config);
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
  }, [isConnected, config, isValid, loadData]);

  const updateGoal = useCallback(async (id: string, goal: Partial<Goal>) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateGoal(id, goal, goals, config);
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
  }, [isConnected, config, isValid, loadData, goals]);

  const deleteGoal = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteGoal(id, goals, config);
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
  }, [isConnected, config, isValid, loadData, goals]);

  // Goal Transactions
  const fetchGoalTransactions = useCallback(async (goalId: string): Promise<GoalTransaction[]> => {
    if (!isConnected || !config || !isValid) return [];
    
    try {
      return await sheetsService.fetchGoalTransactions(goalId, config);
    } catch (error) {
      console.error('Error fetching goal transactions:', error);
      return [];
    }
  }, [isConnected, config, isValid]);

  const addGoalTransaction = useCallback(async (
    transaction: Omit<GoalTransaction, 'id'>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addGoalTransaction(transaction, config);
        if (success) {
          // Add to local state immediately
          const newTransaction: GoalTransaction = {
            ...transaction,
            id: Date.now().toString(),
          };
          setGoalTransactions((prev) => [...prev, newTransaction]);
          await loadData(); // Reload to get updated goal values
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error adding goal transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  const deleteGoalTransaction = useCallback(async (
    id: string,
    goalId: string,
    transactions: GoalTransaction[]
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteGoalTransaction(id, goalId, transactions, config);
        if (success) {
          // Remove from local state immediately
          setGoalTransactions((prev) => prev.filter((t) => t.id !== id));
          await loadData(); // Reload to get updated goal values
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error deleting goal transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  // Helper to parse date string safely
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

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
        const transactionDate = parseDateString(t.data);
        const [startYear, startMonth, startDay] = filters.periodo.inicio.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        if (transactionDate < startDate) return false;
      }

      if (filters.periodo.fim) {
        const transactionDate = parseDateString(t.data);
        const [endYear, endMonth, endDay] = filters.periodo.fim.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
        if (transactionDate > endDate) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = parseDateString(a.data);
      const dateB = parseDateString(b.data);
      return dateB.getTime() - dateA.getTime();
    });
  }, [transactions, filters]);

  const stats = useMemo(() => {
    const totalReceitas = transactions
      .filter((t) => t.tipo === 'Receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalDespesas = transactions
      .filter((t) => t.tipo === 'Despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    const saldo = totalReceitas - totalDespesas;

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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

  const monthlyData = useMemo(() => getMonthlyData(transactions, bills), [transactions, bills]);
  const categoryData = useMemo(() => getCategoryData(transactions, categories, bills), [transactions, categories, bills]);
  const balanceData = useMemo(() => getBalanceData(transactions, goalTransactions, undefined, undefined, bills), [transactions, goalTransactions, bills]);
  
  // Generate forecast transactions
  const forecastTransactions = useMemo(() => {
    // Generate forecasts for 24 months ahead to support longer period selections
    return sheetsService.generateForecastTransactions(recurringTransactions, 24);
  }, [recurringTransactions]);

  // Bills CRUD
  const addBill = useCallback(async (
    bill: Omit<Bill, 'id'>
  ): Promise<boolean> => {
    if (!isConnected || !config || !isValid) return false;
    const success = await sheetsService.addBill(bill, config);
    if (success) {
      await loadData();
    }
    return success;
  }, [isConnected, config, isValid, loadData]);

  const updateBill = useCallback(async (
    id: string,
    bill: Partial<Bill>
  ): Promise<boolean> => {
    if (!isConnected || !config || !isValid) return false;
    const success = await sheetsService.updateBill(id, bill, bills, config);
    if (success) {
      await loadData();
    }
    return success;
  }, [isConnected, config, isValid, loadData, bills]);

  const deleteBill = useCallback(async (
    id: string
  ): Promise<boolean> => {
    if (!isConnected || !config || !isValid) return false;
    const success = await sheetsService.deleteBill(id, bills, config);
    if (success) {
      await loadData();
    }
    return success;
  }, [isConnected, config, isValid, loadData, bills]);

  // Recurring Transactions CRUD
  const addRecurringTransaction = useCallback(async (
    transaction: Omit<RecurringTransaction, 'id'>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addRecurringTransaction(transaction, config);
        if (success) {
          await loadData();
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error adding recurring transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  const updateRecurringTransaction = useCallback(async (
    id: string,
    transaction: Partial<RecurringTransaction>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateRecurringTransaction(id, transaction, config);
        if (success) {
          await loadData();
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error updating recurring transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  const deleteRecurringTransaction = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteRecurringTransaction(id, config);
        if (success) {
          await loadData();
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid, loadData]);

  return {
    transactions,
    filteredTransactions,
    categories,
    goals,
    goalTransactions,
    recurringTransactions,
    forecastTransactions,
    bills,
    isConnected,
    isLoading,
    isInitializing,
    stats,
    monthlyData,
    categoryData,
    balanceData,
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
    fetchGoalTransactions,
    addGoalTransaction,
    deleteGoalTransaction,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    addBill,
    updateBill,
    deleteBill,
  };
}
