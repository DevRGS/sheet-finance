import { useState, useCallback, useMemo } from 'react';
import { Transaction, Category, GoogleSheetsConfig } from '@/types/finance';
import { mockTransactions, defaultCategories, getMonthlyData, getCategoryData } from '@/data/mockData';

export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [categories] = useState<Category[]>(defaultCategories);
  const [config, setConfig] = useState<GoogleSheetsConfig>({
    serviceAccountEmail: '',
    sheetsId: '',
    privateKey: '',
    isConnected: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    setIsLoading(true);
    setTimeout(() => {
      const newTransaction: Transaction = {
        ...transaction,
        id: Date.now().toString(),
      };
      setTransactions((prev) => [newTransaction, ...prev]);
      setIsLoading(false);
    }, 500);
  }, []);

  const updateTransaction = useCallback((id: string, transaction: Partial<Transaction>) => {
    setIsLoading(true);
    setTimeout(() => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...transaction } : t))
      );
      setIsLoading(false);
    }, 500);
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setIsLoading(false);
    }, 500);
  }, []);

  const connectToSheets = useCallback(async (newConfig: Omit<GoogleSheetsConfig, 'isConnected'>) => {
    setIsLoading(true);
    // Simulating connection - in production, this would call an edge function
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setConfig({ ...newConfig, isConnected: true });
    setIsLoading(false);
    return true;
  }, []);

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
    categories,
    config,
    isLoading,
    stats,
    monthlyData,
    categoryData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    connectToSheets,
  };
}
