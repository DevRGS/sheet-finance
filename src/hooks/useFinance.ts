import { useState, useCallback, useMemo, useEffect } from 'react';
import { Transaction, Category, Goal, TransactionFilters, GoalTransaction, BalanceData, RecurringTransaction, ForecastTransaction, Bill, Budget, BankAccount } from '@/types/finance';
import { getMonthlyData, getCategoryData, getBalanceData, getRecurringOccurrences } from '@/data/mockData';
import * as sheetsService from '@/services/googleSheets';
import { useGoogleSheetsConfig } from './useGoogleSheetsConfig';

// ── Dashboard Period ──────────────────────────────────────────────────────────

export type DashboardPreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DashboardPeriod {
  preset: DashboardPreset;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPresetPeriod(preset: Exclude<DashboardPreset, 'custom'>): DashboardPeriod {
  const today = new Date();
  const todayStr = fmtDate(today);
  switch (preset) {
    case 'today':
      return { preset, start: todayStr, end: todayStr };
    case 'week': {
      const day = today.getDay();
      const daysToMon = day === 0 ? 6 : day - 1;
      const mon = new Date(today);
      mon.setDate(today.getDate() - daysToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { preset, start: fmtDate(mon), end: fmtDate(sun) };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { preset, start: fmtDate(s), end: fmtDate(e) };
    }
    case 'year': {
      const s = new Date(today.getFullYear(), 0, 1);
      const e = new Date(today.getFullYear(), 11, 31);
      return { preset, start: fmtDate(s), end: fmtDate(e) };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

const MAX_AUTO_CONNECT_ATTEMPTS = 3;
const AUTO_CONNECT_ATTEMPTS_KEY = 'auto_connect_attempts';

// ── Skipped recurring materializations (localStorage) ────────────────────────

const SKIPPED_RECURRENCES_KEY = 'finance_skipped_recurrences';

function getSkippedRecurrences(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIPPED_RECURRENCES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addSkippedRecurrence(recorrenteId: string, yearMonth: string): void {
  const skipped = getSkippedRecurrences();
  skipped.add(`${recorrenteId}_${yearMonth}`);
  localStorage.setItem(SKIPPED_RECURRENCES_KEY, JSON.stringify(Array.from(skipped)));
}

export function useFinance(isSignedIn = false) {
  const { config, isValid } = useGoogleSheetsConfig();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalTransactions, setGoalTransactions] = useState<GoalTransaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [dashboardPeriod, setDashboardPeriodState] = useState<DashboardPeriod>(
    () => getPresetPeriod('month')
  );
  const setDashboardPeriod = useCallback((period: DashboardPeriod) => {
    setDashboardPeriodState(period);
  }, []);
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
      const [transactionsData, categoriesData, goalsData, recurringData, billsData, budgetsData, bankAccountsData] = await Promise.all([
        sheetsService.fetchTransactions(config),
        sheetsService.fetchCategories(config),
        sheetsService.fetchGoals(config),
        sheetsService.fetchRecurringTransactions(config),
        sheetsService.fetchBills(config),
        sheetsService.fetchBudgets(config),
        sheetsService.fetchBankAccounts(config),
      ]);

      // ── Materialize recurring transactions ──────────────────────────────
      // Generate real transaction entries for each occurrence of each active
      // recurring transaction (from start date up to end of current month).
      // Only creates entries that are not yet present and not intentionally skipped.
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const materializedSet = new Set<string>();
      transactionsData.forEach((t) => {
        if (t.recorrente_id) {
          materializedSet.add(`${t.recorrente_id}_${t.data.substring(0, 7)}`);
        }
      });

      const skippedSet = getSkippedRecurrences();
      const toCreate: Omit<Transaction, 'id'>[] = [];

      recurringData
        .filter((rt) => rt.ativo)
        .forEach((rt) => {
          const occurrences = getRecurringOccurrences(rt, endOfMonthStr);
          occurrences.forEach((occDate) => {
            const yearMonth = occDate.substring(0, 7);
            const key = `${rt.id}_${yearMonth}`;
            if (!materializedSet.has(key) && !skippedSet.has(key)) {
              toCreate.push({
                data: occDate,
                tipo: rt.tipo,
                descricao: rt.descricao,
                valor: rt.valor,
                categoria: rt.categoria,
                forma_pagamento: rt.forma_pagamento,
                observacao: rt.observacao,
                recorrente_id: rt.id,
              });
              materializedSet.add(key);
            }
          });
        });

      let finalTransactions = transactionsData;
      if (toCreate.length > 0) {
        await sheetsService.addTransactionsBatch(toCreate, config);
        // Re-fetch transactions to get the newly created entries with server-assigned IDs
        finalTransactions = await sheetsService.fetchTransactions(config);
      }
      // ───────────────────────────────────────────────────────────────────

      setTransactions(finalTransactions);
      if (categoriesData.length > 0) {
        setCategories(categoriesData);
      }
      setGoals(goalsData);
      setRecurringTransactions(recurringData);
      setBills(billsData);
      setBudgets(budgetsData);
      setBankAccounts(bankAccountsData);

      // Load all goal transactions
      const allGoalTransactions: GoalTransaction[] = [];
      for (const goal of goalsData) {
        try {
          const goalTxs = await sheetsService.fetchGoalTransactions(goal.id, config);
          allGoalTransactions.push(...goalTxs);
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

  const connectToSheets = useCallback(async (isManual = false) => {
    if (!config || !isValid) {
      return {
        success: false,
        message: 'Configure o ID da Planilha antes de conectar',
      };
    }

    setIsInitializing(true);
    setConnectionError(null);
    try {
      const testResult = await sheetsService.testConnection(config);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      const initResult = await sheetsService.initializeSpreadsheet(config);
      if (!initResult.success) {
        throw new Error(initResult.message);
      }

      setIsConnected(true);
      setConnectionError(null);
      localStorage.removeItem(AUTO_CONNECT_ATTEMPTS_KEY);
      return { success: true, message: 'Conexão estabelecida com sucesso!' };
    } catch (error) {
      console.error('Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao conectar';

      let friendlyMessage = errorMessage;
      if (
        errorMessage.includes('Sessão expirada') ||
        errorMessage.includes('Não autenticado') ||
        errorMessage.includes('Faça login')
      ) {
        friendlyMessage = 'Sessão do Google expirada. Clique em "Conectar com Google" para renovar o acesso.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Permission denied')) {
        friendlyMessage = 'Acesso negado (403). Verifique se o email tem permissão de Editor na planilha.';
      }

      setConnectionError(friendlyMessage);
      return { success: false, message: friendlyMessage };
    } finally {
      setIsInitializing(false);
    }
  }, [config, isValid]);

  const retryConnection = useCallback(() => {
    localStorage.removeItem(AUTO_CONNECT_ATTEMPTS_KEY);
    setConnectionError(null);
    // Directly trigger connection attempt
    if (config && isValid) {
      connectToSheets(true);
    }
  }, [config, isValid, connectToSheets]);

  // Reset connection counter whenever the user re-authenticates
  useEffect(() => {
    if (isSignedIn) {
      const attempts = parseInt(localStorage.getItem(AUTO_CONNECT_ATTEMPTS_KEY) || '0', 10);
      if (attempts >= MAX_AUTO_CONNECT_ATTEMPTS) {
        localStorage.removeItem(AUTO_CONNECT_ATTEMPTS_KEY);
        setConnectionError(null);
      }
    }
  }, [isSignedIn]);

  // Auto-connect when credentials are valid, user is signed in, and not yet connected.
  useEffect(() => {
    if (!config || !isValid || isConnected || isInitializing || !isSignedIn) return;

    const attempts = parseInt(localStorage.getItem(AUTO_CONNECT_ATTEMPTS_KEY) || '0', 10);
    if (attempts >= MAX_AUTO_CONNECT_ATTEMPTS) return;

    const timer = setTimeout(() => {
      connectToSheets(false).then((result) => {
        if (!result.success) {
          const newAttempts = attempts + 1;
          localStorage.setItem(AUTO_CONNECT_ATTEMPTS_KEY, newAttempts.toString());
        }
      }).catch(() => {
        const newAttempts = attempts + 1;
        localStorage.setItem(AUTO_CONNECT_ATTEMPTS_KEY, newAttempts.toString());
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [config, isValid, isConnected, isInitializing, isSignedIn, connectToSheets]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<boolean> => {
    const tempId = `temp_${Date.now()}`;
    setTransactions((prev) => [{ ...transaction, id: tempId }, ...prev]);
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addTransaction(transaction, config);
        if (!success) {
          setTransactions((prev) => prev.filter((t) => t.id !== tempId));
          return false;
        }
        const fresh = await sheetsService.fetchTransactions(config);
        setTransactions(fresh);
        return true;
      }
      return true;
    } catch (error) {
      console.error('Error adding transaction:', error);
      setTransactions((prev) => prev.filter((t) => t.id !== tempId));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid]);

  const updateTransaction = useCallback(async (id: string, transaction: Partial<Transaction>): Promise<boolean> => {
    const snapshot = transactions;
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...transaction } : t)));
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateTransaction(id, transaction, snapshot, config);
        if (!success) {
          setTransactions(snapshot);
          return false;
        }
        return true;
      }
      return true;
    } catch (error) {
      console.error('Error updating transaction:', error);
      setTransactions(snapshot);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [transactions, isConnected, config, isValid]);

  const deleteTransaction = useCallback(async (id: string) => {
    const snapshot = transactions;
    const tx = snapshot.find((t) => t.id === id);
    if (tx?.recorrente_id) {
      addSkippedRecurrence(tx.recorrente_id, tx.data.substring(0, 7));
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteTransaction(id, snapshot, config);
        if (!success) {
          setTransactions(snapshot);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [transactions, isConnected, config, isValid]);

  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    setCategories((prev) => [...prev, { ...category, id: tempId }]);
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.addCategory(category, config);
        if (!success) {
          setCategories((prev) => prev.filter((c) => c.id !== tempId));
          return false;
        }
        const fresh = await sheetsService.fetchCategories(config);
        if (fresh.length > 0) setCategories(fresh);
        return true;
      }
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid]);

  const updateCategory = useCallback(async (id: string, category: Partial<Category>) => {
    const snapshot = categories;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...category } : c)));
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.updateCategory(id, category, snapshot, config);
        if (!success) { setCategories(snapshot); return false; }
        return true;
      }
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [categories, isConnected, config, isValid]);

  const deleteCategory = useCallback(async (id: string) => {
    const snapshot = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteCategory(id, snapshot, config);
        if (!success) { setCategories(snapshot); return false; }
        return true;
      }
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [categories, isConnected, config, isValid]);

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

  // Only paid bills are reflected in charts/cards
  const paidBills = useMemo(() => bills.filter((b) => b.pago), [bills]);

  const stats = useMemo(() => {
    const { start, end } = dashboardPeriod;

    // ── Period totals from transactions ─────────────────────────────────────
    const periodTxs = transactions.filter((t) => t.data >= start && t.data <= end);

    let receitasMes = periodTxs
      .filter((t) => t.tipo === 'Receita')
      .reduce((sum, t) => sum + t.valor, 0);

    let despesasMes = periodTxs
      .filter((t) => t.tipo === 'Despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    // ── Paid bills within period ─────────────────────────────────────────────
    paidBills
      .filter((b) => b.data_pagamento && b.data_pagamento >= start && b.data_pagamento <= end)
      .forEach((b) => {
        if (b.tipo === 'pagar') despesasMes += b.valor;
        else if (b.tipo === 'receber') receitasMes += b.valor;
      });

    return {
      totalReceitas: receitasMes,
      totalDespesas: despesasMes,
      saldo: receitasMes - despesasMes,
      receitasMes,
      despesasMes,
      saldoMes: receitasMes - despesasMes,
    };
  }, [transactions, paidBills, dashboardPeriod]);

  const monthlyData = useMemo(
    () => getMonthlyData(transactions, paidBills, [], dashboardPeriod),
    [transactions, paidBills, dashboardPeriod]
  );
  const categoryData = useMemo(
    () => getCategoryData(transactions, categories, paidBills, [], dashboardPeriod),
    [transactions, categories, paidBills, dashboardPeriod]
  );
  const balanceData = useMemo(() => getBalanceData(transactions, goalTransactions, undefined, undefined, bills), [transactions, goalTransactions, bills]);
  
  // Generate forecast transactions
  const forecastTransactions = useMemo(() => {
    // Generate forecasts for 24 months ahead to support longer period selections
    return sheetsService.generateForecastTransactions(recurringTransactions, 24);
  }, [recurringTransactions]);

  // Bills CRUD (optimistic)
  const addBill = useCallback(async (bill: Omit<Bill, 'id'>): Promise<boolean> => {
    const tempId = `temp_${Date.now()}`;
    setBills((prev) => [...prev, { ...bill, id: tempId }]);
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.addBill(bill, config);
      if (!success) { setBills((prev) => prev.filter((b) => b.id !== tempId)); return false; }
      const fresh = await sheetsService.fetchBills(config);
      setBills(fresh);
      return true;
    } finally { setIsLoading(false); }
  }, [isConnected, config, isValid]);

  const updateBill = useCallback(async (id: string, bill: Partial<Bill>): Promise<boolean> => {
    const snapshot = bills;
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...bill } : b)));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.updateBill(id, bill, snapshot, config);
      if (!success) { setBills(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [bills, isConnected, config, isValid]);

  const deleteBill = useCallback(async (id: string): Promise<boolean> => {
    const snapshot = bills;
    setBills((prev) => prev.filter((b) => b.id !== id));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.deleteBill(id, snapshot, config);
      if (!success) { setBills(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [bills, isConnected, config, isValid]);

  // Budget CRUD (optimistic)
  const addBudget = useCallback(async (budget: Omit<Budget, 'id'>): Promise<boolean> => {
    const tempId = `temp_${Date.now()}`;
    setBudgets((prev) => [...prev, { ...budget, id: tempId }]);
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.addBudget(budget, config);
      if (!success) { setBudgets((prev) => prev.filter((b) => b.id !== tempId)); return false; }
      const fresh = await sheetsService.fetchBudgets(config);
      setBudgets(fresh);
      return true;
    } finally { setIsLoading(false); }
  }, [isConnected, config, isValid]);

  const updateBudget = useCallback(async (id: string, budget: Partial<Budget>): Promise<boolean> => {
    const snapshot = budgets;
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...budget } : b)));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.updateBudget(id, budget, snapshot, config);
      if (!success) { setBudgets(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [budgets, isConnected, config, isValid]);

  const deleteBudget = useCallback(async (id: string): Promise<boolean> => {
    const snapshot = budgets;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.deleteBudget(id, snapshot, config);
      if (!success) { setBudgets(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [budgets, isConnected, config, isValid]);

  // Bank Accounts CRUD (optimistic)
  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id'>): Promise<boolean> => {
    const tempId = `temp_${Date.now()}`;
    setBankAccounts((prev) => [...prev, { ...account, id: tempId }]);
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.addBankAccount(account, config);
      if (!success) { setBankAccounts((prev) => prev.filter((a) => a.id !== tempId)); return false; }
      const fresh = await sheetsService.fetchBankAccounts(config);
      setBankAccounts(fresh);
      return true;
    } finally { setIsLoading(false); }
  }, [isConnected, config, isValid]);

  const updateBankAccount = useCallback(async (id: string, account: Partial<BankAccount>): Promise<boolean> => {
    const snapshot = bankAccounts;
    setBankAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...account } : a)));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.updateBankAccount(id, account, snapshot, config);
      if (!success) { setBankAccounts(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [bankAccounts, isConnected, config, isValid]);

  const deleteBankAccount = useCallback(async (id: string): Promise<boolean> => {
    const snapshot = bankAccounts;
    setBankAccounts((prev) => prev.filter((a) => a.id !== id));
    setIsLoading(true);
    try {
      if (!isConnected || !config || !isValid) return true;
      const success = await sheetsService.deleteBankAccount(id, snapshot, config);
      if (!success) { setBankAccounts(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [bankAccounts, isConnected, config, isValid]);

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
    budgets,
    bankAccounts,
    isConnected,
    isLoading,
    isInitializing,
    connectionError,
    retryConnection,
    stats,
    monthlyData,
    categoryData,
    balanceData,
    dashboardPeriod,
    setDashboardPeriod,
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
    addBudget,
    updateBudget,
    deleteBudget,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
  };
}
