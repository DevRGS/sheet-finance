import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Transaction, Category, Goal, TransactionFilters, GoalTransaction, BalanceData, RecurringTransaction, ForecastTransaction, Bill, Budget, BankAccount } from '@/types/finance';
import { getMonthlyData, getCategoryData, getBalanceData, getRecurringOccurrences, getRecurringTotalsInRange } from '@/data/mockData';
import * as sheetsService from '@/services/googleSheets';
import { useGoogleSheetsConfig } from './useGoogleSheetsConfig';
import { loadFinanceSnapshot, saveFinanceSnapshot } from '@/services/offlineSnapshot';
import { isAuthenticated } from '@/services/googleApiService';

// ── Dashboard Period ──────────────────────────────────────────────────────────

export type DashboardPreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DashboardPeriod {
  preset: DashboardPreset;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export type DashboardView = 'realizado' | 'previsto';

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
  { id: '1', nome: 'Alimentação', cor: '#a78bfa', tipo: 'Despesa' },
  { id: '2', nome: 'Moradia', cor: '#c084fc', tipo: 'Despesa' },
  { id: '3', nome: 'Transporte', cor: '#818cf8', tipo: 'Despesa' },
  { id: '4', nome: 'Educação', cor: '#8b5cf6', tipo: 'Despesa' },
  { id: '5', nome: 'Saúde', cor: '#737373', tipo: 'Despesa' },
  { id: '6', nome: 'Lazer', cor: '#a855f7', tipo: 'Despesa' },
  { id: '7', nome: 'Investimentos', cor: '#22c55e', tipo: 'Despesa' },
  { id: '8', nome: 'Outros', cor: '#6b7280', tipo: 'Ambos' },
];

const MAX_AUTO_CONNECT_ATTEMPTS = 3;
/** Chave antiga: o contador persistido bloqueava a conexão automática entre recarregamentos. */
const LEGACY_AUTO_CONNECT_ATTEMPTS_KEY = 'auto_connect_attempts';

type ConnectResult = { success: boolean; message: string; retryable?: boolean };

/** Erros que não se resolvem tentando de novo sozinho (precisam de ação do usuário). */
function isPermanentConnectionError(message: string): boolean {
  return /Acesso negado|não encontrada|Sessão|Não autenticado|permiss|Configure o ID/i.test(message);
}

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

export function useFinance(isSignedIn = false, accountEmail: string | null = null) {
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
  const [hasOfflineSnapshot, setHasOfflineSnapshot] = useState(false);
  const [offlineSnapshotUpdatedAt, setOfflineSnapshotUpdatedAt] = useState<string | null>(null);
  const [dashboardPeriod, setDashboardPeriodState] = useState<DashboardPeriod>(
    () => getPresetPeriod('month')
  );
  const [dashboardView, setDashboardView] = useState<DashboardView>('realizado');
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
      const [transactionsData, categoriesData, goalsData, recurringData, billsData, budgetsData, bankAccountsData, goalTransactionsData] = await Promise.all([
        sheetsService.fetchTransactions(config),
        sheetsService.fetchCategories(config),
        sheetsService.fetchGoals(config),
        sheetsService.fetchRecurringTransactions(config),
        sheetsService.fetchBills(config),
        sheetsService.fetchBudgets(config),
        sheetsService.fetchBankAccounts(config),
        sheetsService.fetchAllGoalTransactions(config),
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

      // Goal transactions (one read of the sheet, filtered to existing goals)
      const goalIds = new Set(goalsData.map((g) => g.id));
      const allGoalTransactions: GoalTransaction[] = goalTransactionsData.filter((t) => goalIds.has(t.goal_id));
      setGoalTransactions(allGoalTransactions);

      // Persist offline snapshot (best-effort)
      try {
        const snapshot = {
          version: 1 as const,
          sheetsId: config.sheetsId,
          updatedAt: new Date().toISOString(),
          data: {
            transactions: finalTransactions,
            categories: categoriesData.length > 0 ? categoriesData : defaultCategories,
            goals: goalsData,
            goalTransactions: allGoalTransactions,
            recurringTransactions: recurringData,
            bills: billsData,
            budgets: budgetsData,
            bankAccounts: bankAccountsData,
          },
        };
        await saveFinanceSnapshot(snapshot);
        setHasOfflineSnapshot(true);
        setOfflineSnapshotUpdatedAt(snapshot.updatedAt);
      } catch (e) {
        console.warn('Could not save offline snapshot:', e);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, config, isValid]);

  // Load last snapshot for offline read-only mode
  useEffect(() => {
    if (isConnected) return;
    const sheetsId = config?.sheetsId;

    let cancelled = false;
    (async () => {
      try {
        const snap = await loadFinanceSnapshot(sheetsId);
        if (!snap || cancelled) return;

        setTransactions(snap.data.transactions || []);
        if ((snap.data.categories || []).length > 0) setCategories(snap.data.categories);
        setGoals(snap.data.goals || []);
        setGoalTransactions(snap.data.goalTransactions || []);
        setRecurringTransactions(snap.data.recurringTransactions || []);
        setBills(snap.data.bills || []);
        setBudgets(snap.data.budgets || []);
        setBankAccounts(snap.data.bankAccounts || []);
        setHasOfflineSnapshot(true);
        setOfflineSnapshotUpdatedAt(snap.updatedAt);
      } catch (e) {
        console.warn('Could not load offline snapshot:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, config?.sheetsId]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected, loadData]);

  const sheetsId = isValid ? config?.sheetsId ?? null : null;
  /** Invalida conexões em curso quando a planilha/conta muda. */
  const connectSeqRef = useRef(0);
  const autoConnectRef = useRef<{ key: string | null; attempts: number }>({ key: null, attempts: 0 });

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_AUTO_CONNECT_ATTEMPTS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Trocar de planilha ou de conta Google exige uma nova conexão.
  useEffect(() => {
    connectSeqRef.current += 1;
    autoConnectRef.current = { key: null, attempts: 0 };
    setIsConnected(false);
    setIsInitializing(false);
    setConnectionError(null);
  }, [sheetsId, accountEmail]);

  const connectToSheets = useCallback(async (_isManual = false): Promise<ConnectResult> => {
    if (!config || !isValid) {
      return {
        success: false,
        message: 'Configure o ID da Planilha antes de conectar',
      };
    }

    const seq = ++connectSeqRef.current;
    const superseded: ConnectResult = { success: false, message: 'Conexão substituída por uma mais recente.', retryable: true };
    setIsInitializing(true);
    setConnectionError(null);
    try {
      // initializeSpreadsheet já valida o acesso (401/403/404) — não é preciso testConnection antes.
      const initResult = await sheetsService.initializeSpreadsheet(config);
      if (seq !== connectSeqRef.current) return superseded;
      if (!initResult.success) {
        throw new Error(initResult.message);
      }

      setIsConnected(true);
      setConnectionError(null);
      return { success: true, message: 'Conexão estabelecida com sucesso!' };
    } catch (error) {
      if (seq !== connectSeqRef.current) return superseded;
      console.error('Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao conectar';

      const friendlyMessage = !isAuthenticated()
        ? 'Sessão do Google expirada. Clique em "Reconectar" para renovar o acesso.'
        : errorMessage;

      setConnectionError(friendlyMessage);
      return { success: false, message: friendlyMessage, retryable: !isPermanentConnectionError(friendlyMessage) };
    } finally {
      if (seq === connectSeqRef.current) setIsInitializing(false);
    }
  }, [config, isValid]);

  const retryConnection = useCallback(() => {
    autoConnectRef.current = { key: sheetsId, attempts: 0 };
    setConnectionError(null);
    if (config && isValid) {
      connectToSheets(true);
    }
  }, [config, isValid, sheetsId, connectToSheets]);

  // Ao (re)autenticar, permite novas tentativas automáticas.
  useEffect(() => {
    if (isSignedIn) {
      autoConnectRef.current.attempts = 0;
      setConnectionError(null);
    }
  }, [isSignedIn]);

  // Reconectou depois de a sessão expirar com a planilha já conectada: recarrega os dados.
  const wasSignedInRef = useRef(isSignedIn);
  useEffect(() => {
    if (isSignedIn && !wasSignedInRef.current && isConnected) {
      loadData();
    }
    wasSignedInRef.current = isSignedIn;
  }, [isSignedIn, isConnected, loadData]);

  // Conexão automática: logo ao abrir (sessão restaurada) ou após o login.
  // Erros transitórios (rede, 429, 5xx) tentam de novo com espera crescente; erros de
  // permissão/sessão param e mostram a mensagem com "Tentar novamente".
  useEffect(() => {
    if (!sheetsId || !isSignedIn || isConnected || isInitializing) return;

    const state = autoConnectRef.current;
    if (state.key !== sheetsId) {
      state.key = sheetsId;
      state.attempts = 0;
    }
    if (state.attempts >= MAX_AUTO_CONNECT_ATTEMPTS) return;

    const delay = state.attempts === 0 ? 0 : 1500 * 2 ** (state.attempts - 1);
    const timer = setTimeout(() => {
      if (state.attempts >= MAX_AUTO_CONNECT_ATTEMPTS) return;
      state.attempts += 1;
      connectToSheets(false).then((result) => {
        if (!result.success && !result.retryable) state.attempts = MAX_AUTO_CONNECT_ATTEMPTS;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [sheetsId, isSignedIn, isConnected, isInitializing, connectToSheets]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<boolean> => {
    const tempId = `temp_${crypto.randomUUID()}`;
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
        const success = await sheetsService.updateTransaction(id, transaction, config);
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

  const deleteTransaction = useCallback(async (id: string): Promise<boolean> => {
    const snapshot = transactions;
    const tx = snapshot.find((t) => t.id === id);
    if (tx?.recorrente_id) {
      addSkippedRecurrence(tx.recorrente_id, tx.data.substring(0, 7));
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setIsLoading(true);
    try {
      if (isConnected && config && isValid) {
        const success = await sheetsService.deleteTransaction(id, config);
        if (!success) { setTransactions(snapshot); return false; }
        return true;
      }
      // Offline mode: keep local-only delete, but report as "not persisted"
      setTransactions(snapshot);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [transactions, isConnected, config, isValid]);

  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    const tempId = `temp_${crypto.randomUUID()}`;
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
        const success = await sheetsService.updateCategory(id, category, config);
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
        const success = await sheetsService.deleteCategory(id, config);
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
          id: crypto.randomUUID(),
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
        const success = await sheetsService.updateGoal(id, goal, config);
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
        const success = await sheetsService.deleteGoal(id, config);
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
            id: crypto.randomUUID(),
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

    // Realizado: transações + contas pagas no período (por data_pagamento)
    if (dashboardView === 'realizado') {
      const periodTxs = transactions.filter((t) => t.data >= start && t.data <= end);

      let receitasMes = periodTxs
        .filter((t) => t.tipo === 'Receita')
        .reduce((sum, t) => sum + t.valor, 0);

      let despesasMes = periodTxs
        .filter((t) => t.tipo === 'Despesa')
        .reduce((sum, t) => sum + t.valor, 0);

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
    }

    // Previsto: recorrências + contas por vencimento (independente de pago)
    const recurringTotals = getRecurringTotalsInRange(recurringTransactions, start, end);

    let receitasMes = recurringTotals.receitas;
    let despesasMes = recurringTotals.despesas;

    bills
      .filter((b) => {
        const d = b.data_vencimento || b.data_pagamento;
        return !!d && d >= start && d <= end;
      })
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
  }, [transactions, paidBills, recurringTransactions, bills, dashboardPeriod, dashboardView]);

  const monthlyData = useMemo(() => {
    if (dashboardView === 'realizado') {
      return getMonthlyData(transactions, paidBills, [], dashboardPeriod);
    }
    return getMonthlyData([], bills, recurringTransactions, dashboardPeriod);
  }, [transactions, paidBills, bills, recurringTransactions, dashboardPeriod, dashboardView]);

  const categoryData = useMemo(() => {
    if (dashboardView === 'realizado') {
      return getCategoryData(transactions, categories, paidBills, [], dashboardPeriod);
    }
    return getCategoryData([], categories, bills, recurringTransactions, dashboardPeriod);
  }, [transactions, categories, paidBills, bills, recurringTransactions, dashboardPeriod, dashboardView]);

  // Generate forecast transactions
  const forecastTransactions = useMemo(() => {
    // Generate forecasts for 24 months ahead to support longer period selections
    return sheetsService.generateForecastTransactions(recurringTransactions, 24);
  }, [recurringTransactions]);

  const balanceData = useMemo(() => {
    if (dashboardView === 'realizado') {
      return getBalanceData(transactions, goalTransactions, undefined, undefined, bills);
    }
    // Previsto: usa forecast (futuro) + contas; ignora transações realizadas para não duplicar recorrências materializadas.
    return getBalanceData([], goalTransactions, undefined, forecastTransactions, bills);
  }, [transactions, goalTransactions, bills, forecastTransactions, dashboardView]);

  // Bills CRUD (optimistic)
  const addBill = useCallback(async (bill: Omit<Bill, 'id'>): Promise<boolean> => {
    const tempId = `temp_${crypto.randomUUID()}`;
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
    const tempId = `temp_${crypto.randomUUID()}`;
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
      const success = await sheetsService.updateBudget(id, budget, config);
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
      const success = await sheetsService.deleteBudget(id, config);
      if (!success) { setBudgets(snapshot); return false; }
      return true;
    } finally { setIsLoading(false); }
  }, [budgets, isConnected, config, isValid]);

  // Bank Accounts CRUD (optimistic)
  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id'>): Promise<boolean> => {
    const tempId = `temp_${crypto.randomUUID()}`;
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
      const success = await sheetsService.updateBankAccount(id, account, config);
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
      const success = await sheetsService.deleteBankAccount(id, config);
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
    hasOfflineSnapshot,
    offlineSnapshotUpdatedAt,
    stats,
    monthlyData,
    categoryData,
    balanceData,
    dashboardPeriod,
    setDashboardPeriod,
    dashboardView,
    setDashboardView,
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
