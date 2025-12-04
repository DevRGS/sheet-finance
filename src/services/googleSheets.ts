import { supabase } from '@/integrations/supabase/client';
import { Transaction, Category, Goal } from '@/types/finance';

interface SheetResponse<T> {
  data?: T;
  error?: string;
}

async function callSheetsFunction<T>(body: Record<string, unknown>): Promise<SheetResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('google-sheets', {
      body,
    });

    if (error) {
      console.error('Sheets function error:', error);
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { data };
  } catch (err) {
    console.error('Sheets request error:', err);
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const response = await callSheetsFunction<{ success: boolean; message: string }>({ action: 'test' });
  if (response.error) {
    return { success: false, message: response.error };
  }
  return response.data || { success: false, message: 'Erro desconhecido' };
}

export async function initializeSpreadsheet(): Promise<{ success: boolean; message: string }> {
  const response = await callSheetsFunction<{ success: boolean; message: string }>({ action: 'init' });
  if (response.error) {
    return { success: false, message: response.error };
  }
  return response.data || { success: false, message: 'Erro desconhecido' };
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await callSheetsFunction<Record<string, string>[]>({ action: 'read', sheet: 'transacoes' });
  if (response.error || !response.data) {
    console.error('Error fetching transactions:', response.error);
    return [];
  }
  
  return response.data.map(row => ({
    id: row.id,
    data: row.data,
    tipo: row.tipo as Transaction['tipo'],
    descricao: row.descricao,
    valor: parseFloat(row.valor) || 0,
    categoria: row.categoria,
    forma_pagamento: row.forma_pagamento as Transaction['forma_pagamento'],
    observacao: row.observacao,
  }));
}

export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<boolean> {
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'append',
    sheet: 'transacoes',
    data: [{
      id: Date.now().toString(),
      ...transaction,
    }],
  });
  return !response.error && response.data?.success === true;
}

export async function updateTransaction(id: string, transaction: Partial<Transaction>, transactions: Transaction[]): Promise<boolean> {
  const rowIndex = transactions.findIndex(t => t.id === id);
  if (rowIndex === -1) return false;

  const updatedTransaction = { ...transactions[rowIndex], ...transaction };
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'update',
    sheet: 'transacoes',
    rowIndex,
    data: [updatedTransaction],
  });
  return !response.error && response.data?.success === true;
}

export async function deleteTransaction(id: string, transactions: Transaction[]): Promise<boolean> {
  const rowIndex = transactions.findIndex(t => t.id === id);
  if (rowIndex === -1) return false;

  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'delete',
    sheet: 'transacoes',
    rowIndex,
  });
  return !response.error && response.data?.success === true;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await callSheetsFunction<Record<string, string>[]>({ action: 'read', sheet: 'categorias' });
  if (response.error || !response.data) {
    console.error('Error fetching categories:', response.error);
    return [];
  }
  
  return response.data.map(row => ({
    id: row.id,
    nome: row.nome,
    cor: row.cor,
  }));
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<boolean> {
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'append',
    sheet: 'categorias',
    data: [{
      id: Date.now().toString(),
      ...category,
    }],
  });
  return !response.error && response.data?.success === true;
}

export async function updateCategory(id: string, category: Partial<Category>, categories: Category[]): Promise<boolean> {
  const rowIndex = categories.findIndex(c => c.id === id);
  if (rowIndex === -1) return false;

  const updatedCategory = { ...categories[rowIndex], ...category };
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'update',
    sheet: 'categorias',
    rowIndex,
    data: [updatedCategory],
  });
  return !response.error && response.data?.success === true;
}

export async function deleteCategory(id: string, categories: Category[]): Promise<boolean> {
  const rowIndex = categories.findIndex(c => c.id === id);
  if (rowIndex === -1) return false;

  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'delete',
    sheet: 'categorias',
    rowIndex,
  });
  return !response.error && response.data?.success === true;
}

export async function fetchGoals(): Promise<Goal[]> {
  const response = await callSheetsFunction<Record<string, string>[]>({ action: 'read', sheet: 'metas' });
  if (response.error || !response.data) {
    console.error('Error fetching goals:', response.error);
    return [];
  }
  
  return response.data.map(row => ({
    id: row.id,
    nome: row.nome,
    valor_alvo: parseFloat(row.valor_alvo) || 0,
    valor_atual: parseFloat(row.valor_atual) || 0,
    prazo: row.prazo,
    cor: row.cor,
  }));
}

export async function addGoal(goal: Omit<Goal, 'id'>): Promise<boolean> {
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'append',
    sheet: 'metas',
    data: [{
      id: Date.now().toString(),
      ...goal,
    }],
  });
  return !response.error && response.data?.success === true;
}

export async function updateGoal(id: string, goal: Partial<Goal>, goals: Goal[]): Promise<boolean> {
  const rowIndex = goals.findIndex(g => g.id === id);
  if (rowIndex === -1) return false;

  const updatedGoal = { ...goals[rowIndex], ...goal };
  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'update',
    sheet: 'metas',
    rowIndex,
    data: [updatedGoal],
  });
  return !response.error && response.data?.success === true;
}

export async function deleteGoal(id: string, goals: Goal[]): Promise<boolean> {
  const rowIndex = goals.findIndex(g => g.id === id);
  if (rowIndex === -1) return false;

  const response = await callSheetsFunction<{ success: boolean }>({
    action: 'delete',
    sheet: 'metas',
    rowIndex,
  });
  return !response.error && response.data?.success === true;
}
