import { Transaction, Category, Goal, GoogleSheetsConfig, GoalTransaction, RecurringTransaction, Bill, ForecastTransaction, Budget, BankAccount } from '@/types/finance';

import { getValidToken } from './googleApiService';

declare global {
  interface Window {
    gapi: any;
  }
}

// Helper to get access token using Google API Service
async function getAccessToken(): Promise<string> {
  return await getValidToken();
}

// Helper to handle Google API errors and provide user-friendly messages
function handleGoogleApiError(error: any): Error {
  // Log the full error for debugging
  console.error('Google API Error details:', {
    status: error?.status,
    code: error?.result?.error?.code,
    message: error?.result?.error?.message || error?.message,
    error: error,
  });

  // Check for 403 Forbidden error - multiple ways gapi can return this
  const status = error?.status || error?.result?.error?.code;
  const message = error?.result?.error?.message || error?.message || '';
  const statusText = error?.statusText || '';
  
  if (status === 403 || message.includes('403') || message.includes('Forbidden') || statusText.includes('Forbidden')) {
    return new Error('Acesso negado (403). Verifique se: 1) A planilha foi compartilhada com o email que você usou para fazer login, 2) O email tem permissão de Editor, 3) O ID da planilha está correto.');
  }
  
  // Check for 404 Not Found
  if (status === 404 || message.includes('404') || message.includes('Not Found')) {
    return new Error('Planilha não encontrada (404). Verifique se o ID da planilha está correto.');
  }
  
  // Check for authentication errors
  if (status === 401 || message.includes('401') || message.includes('Unauthorized') || message.includes('Invalid credentials')) {
    return new Error('Não autenticado. Faça login com Google primeiro.');
  }
  
  // Check for rate limiting (429)
  if (status === 429 || message.includes('429') || message.includes('rate limit')) {
    return new Error('Muitas requisições. Aguarde alguns instantes antes de tentar novamente.');
  }
  
  // Return original error or a generic message
  if (error instanceof Error) {
    return error;
  }
  
  // Try to extract a meaningful message from the error
  const errorMessage = error?.result?.error?.message || error?.message || 'Erro desconhecido ao acessar Google Sheets';
  return new Error(errorMessage);
}

// Helper to ensure gapi is ready
async function ensureGapiReady(): Promise<void> {
  // Wait for gapi to load
  if (!window.gapi) {
    // Wait up to 10 seconds for gapi to load
    await new Promise<void>((resolve, reject) => {
      const checkGapi = setInterval(() => {
        if (window.gapi) {
          clearInterval(checkGapi);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
      
      const timeout = setTimeout(() => {
        clearInterval(checkGapi);
        reject(new Error('Google API não carregada. Aguarde o carregamento da biblioteca.'));
      }, 10000);
    });
  }
  
  // Load client library
  if (!window.gapi.client) {
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client', {
        callback: resolve,
        onerror: reject,
      });
    });
  }
  
  // Load Sheets API
  if (!window.gapi.client.sheets) {
    await window.gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  }
  
  // Get and set access token for gapi requests
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Token de acesso não disponível');
    }
    window.gapi.client.setToken({ access_token: accessToken });
  } catch (error) {
    // If token is not available, throw a more helpful error
    const errorMessage = error instanceof Error ? error.message : 'Erro ao obter token';
    throw new Error(`Não autenticado. Faça login com Google primeiro através do botão "Conectar com Google". Erro: ${errorMessage}`);
  }
}

// Read sheet data using gapi
async function readSheet(sheetsId: string, range: string): Promise<Record<string, unknown>[]> {
  await ensureGapiReady();

  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetsId,
      range: range,
    });

    const values = response.result.values || [];
    if (values.length < 2) {
      return [];
    }

    const [headers, ...rows] = values;
    return rows.map((row: string[]) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  } catch (error: any) {
    console.error('Error reading sheet:', error);
    throw handleGoogleApiError(error);
  }
}

// Append to sheet using gapi
async function appendToSheet(sheetsId: string, range: string, values: string[][]): Promise<void> {
  await ensureGapiReady();

  try {
    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values,
      },
    });
  } catch (error: any) {
    console.error('Error appending to sheet:', error);
    throw handleGoogleApiError(error);
  }
}

// Update sheet using gapi
async function updateSheet(sheetsId: string, range: string, values: string[][]): Promise<void> {
  await ensureGapiReady();

  try {
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: values,
      },
    });
  } catch (error: any) {
    console.error('Error updating sheet:', error);
    throw handleGoogleApiError(error);
  }
}

// Delete row from sheet using gapi
async function deleteRow(sheetsId: string, sheetName: string, rowIndex: number): Promise<void> {
  await ensureGapiReady();

  try {
    // Get sheet ID
    const spreadsheet = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: sheetsId,
    });

    const sheet = spreadsheet.result.sheets?.find(
      (s: any) => s.properties.title === sheetName
    );

    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found`);
    }

    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetsId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 for header row
              endIndex: rowIndex + 2,
            },
          },
        }],
      },
    });
  } catch (error: any) {
    console.error('Error deleting row:', error);
    throw handleGoogleApiError(error);
  }
}

export interface SpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

// List all spreadsheets accessible by the authenticated user via Drive API
export async function listSpreadsheets(): Promise<SpreadsheetItem[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Erro ${response.status}`;
    throw new Error(`Erro ao listar planilhas: ${message}`);
  }

  const data = await response.json();
  return (data.files || []) as SpreadsheetItem[];
}

// Create a new spreadsheet with the given name
export async function createSpreadsheet(name: string): Promise<string> {
  await ensureGapiReady();

  const response = await window.gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: {
        title: name,
      },
    },
  });

  const spreadsheetId = response.result.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Não foi possível obter o ID da nova planilha.');
  }

  return spreadsheetId;
}

// Test connection
export async function testConnection(credentials: GoogleSheetsConfig): Promise<{ success: boolean; message: string }> {
  try {
    await ensureGapiReady();

    await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: credentials.sheetsId,
    });

    return { success: true, message: 'Conexão estabelecida com sucesso!' };
  } catch (error: any) {
    const handledError = handleGoogleApiError(error);
    return { success: false, message: handledError.message };
  }
}

// Initialize spreadsheet
export async function initializeSpreadsheet(credentials: GoogleSheetsConfig): Promise<{ success: boolean; message: string }> {
  try {
    await ensureGapiReady();

    // Get existing sheets
    const spreadsheet = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: credentials.sheetsId,
    });

    const existingSheets = spreadsheet.result.sheets?.map((s: any) => s.properties.title) || [];

    // Create missing sheets
    const requiredSheets = [
      { name: 'config', headers: ['chave', 'valor'] },
      { name: 'transacoes', headers: ['id', 'data', 'tipo', 'descricao', 'valor', 'categoria', 'forma_pagamento', 'observacao', 'recorrente_id', 'conta_id'] },
      { name: 'categorias', headers: ['id', 'nome', 'cor'] },
      { name: 'metas', headers: ['id', 'nome', 'valor_alvo', 'valor_atual', 'prazo', 'cor'] },
      { name: 'movimentacoes_metas', headers: ['id', 'goal_id', 'tipo', 'valor', 'data', 'observacao'] },
      { name: 'transacoes_recorrentes', headers: ['id', 'descricao', 'tipo', 'valor', 'categoria', 'forma_pagamento', 'data_inicio', 'recorrencia', 'fim_tipo', 'meses_duracao', 'ativo', 'observacao'] },
      { name: 'contas', headers: ['id', 'tipo', 'descricao', 'valor', 'categoria', 'data_vencimento', 'data_pagamento', 'pago', 'observacao'] },
      { name: 'orcamentos', headers: ['id', 'categoria', 'valor_limite', 'mes'] },
      { name: 'contas_bancarias', headers: ['id', 'nome', 'tipo', 'banco', 'saldo_inicial', 'cor', 'ativo'] },
    ];

    const sheetsToCreate = requiredSheets.filter(s => !existingSheets.includes(s.name));

    // Create missing sheets (non-critical — wrapped so a failure here doesn't block access)
    if (sheetsToCreate.length > 0) {
      try {
        await window.gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: credentials.sheetsId,
          resource: {
            requests: sheetsToCreate.map(sheet => ({
              addSheet: { properties: { title: sheet.name } },
            })),
          },
        });
        // Add headers to newly created sheets
        for (const sheet of sheetsToCreate) {
          try {
            await appendToSheet(credentials.sheetsId, `${sheet.name}!A1`, [sheet.headers]);
          } catch (headerErr) {
            console.warn(`Could not add header to ${sheet.name}:`, headerErr);
          }
        }
      } catch (createErr: any) {
        // If sheets already exist (concurrent init) or another non-fatal error, continue
        const msg: string = createErr?.result?.error?.message || createErr?.message || '';
        if (!msg.includes('already exists')) {
          console.warn('Could not create new sheets (non-fatal):', createErr);
        }
      }
    }

    // Migrate transacoes header columns if missing
    if (existingSheets.includes('transacoes')) {
      try {
        const headerRes = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: credentials.sheetsId,
          range: 'transacoes!1:1',
        });
        let headers: string[] = headerRes.result.values?.[0] || [];
        let changed = false;
        for (const col of ['recorrente_id', 'conta_id']) {
          if (headers.length > 0 && !headers.includes(col)) {
            headers = [...headers, col];
            changed = true;
          }
        }
        if (changed) await updateSheet(credentials.sheetsId, 'transacoes!A1', [headers]);
      } catch (e) {
        console.warn('Could not migrate transacoes header:', e);
      }
    }

    // Seed default categories if the sheet is empty (non-critical)
    try {
      const categories = await readSheet(credentials.sheetsId, 'categorias');
      if (categories.length === 0) {
        const defaultCategories = [
          ['1', 'Alimentação', '#a78bfa'],
          ['2', 'Moradia', '#c084fc'],
          ['3', 'Transporte', '#818cf8'],
          ['4', 'Educação', '#8b5cf6'],
          ['5', 'Saúde', '#737373'],
          ['6', 'Lazer', '#a855f7'],
          ['7', 'Investimentos', '#22c55e'],
          ['8', 'Outros', '#6b7280'],
        ];
        await appendToSheet(credentials.sheetsId, 'categorias!A2', defaultCategories);
      }
    } catch (e) {
      console.warn('Could not seed categories:', e);
    }

    // Seed config metadata if empty (non-critical)
    try {
      const config = await readSheet(credentials.sheetsId, 'config');
      if (config.length === 0) {
        await appendToSheet(credentials.sheetsId, 'config!A2', [
          ['data_criacao', new Date().toISOString()],
          ['versao', '2.0.0'],
        ]);
      }
    } catch (e) {
      console.warn('Could not seed config:', e);
    }

    return { success: true, message: 'Planilha inicializada com sucesso!' };
  } catch (error: any) {
    const handledError = handleGoogleApiError(error);
    return { success: false, message: handledError.message };
  }
}

// Fetch transactions
export async function fetchTransactions(credentials: GoogleSheetsConfig): Promise<Transaction[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'transacoes');
    
    return data.map(row => ({
      id: String(row.id || ''),
      data: String(row.data || ''),
      tipo: row.tipo as Transaction['tipo'],
      descricao: String(row.descricao || ''),
      valor: parseFloat(String(row.valor || '0')) || 0,
      categoria: String(row.categoria || ''),
      forma_pagamento: row.forma_pagamento as Transaction['forma_pagamento'],
      observacao: String(row.observacao || '') || undefined,
      recorrente_id: String(row.recorrente_id || '') || undefined,
      conta_id: String(row.conta_id || '') || undefined,
    }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Add transaction
export async function addTransaction(
  transaction: Omit<Transaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const transactionData = [
      Date.now().toString(),
      transaction.data || '',
      transaction.tipo || '',
      transaction.descricao || '',
      transaction.valor?.toString() || '0',
      transaction.categoria || '',
      transaction.forma_pagamento || '',
      transaction.observacao || '',
      transaction.recorrente_id || '',
      transaction.conta_id || '',
    ];

    await appendToSheet(credentials.sheetsId, 'transacoes!A2', [transactionData]);
    return true;
  } catch (error) {
    console.error('Error adding transaction:', error);
    return false;
  }
}

// Batch-add multiple transactions at once (used for recurring materialization)
export async function addTransactionsBatch(
  transactions: Omit<Transaction, 'id'>[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  if (transactions.length === 0) return true;
  try {
    const rows = transactions.map((t) => [
      `${Date.now()}${Math.floor(Math.random() * 100000)}`,
      t.data || '',
      t.tipo || '',
      t.descricao || '',
      t.valor?.toString() || '0',
      t.categoria || '',
      t.forma_pagamento || '',
      t.observacao || '',
      t.recorrente_id || '',
      t.conta_id || '',
    ]);
    await appendToSheet(credentials.sheetsId, 'transacoes!A2', rows);
    return true;
  } catch (error) {
    console.error('Error batch adding transactions:', error);
    return false;
  }
}

// Update transaction
export async function updateTransaction(
  id: string,
  transaction: Partial<Transaction>,
  transactions: Transaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = transactions.findIndex(t => t.id === id);
    if (rowIndex === -1) return false;

    const updated = { ...transactions[rowIndex], ...transaction };
    const row = [
      updated.id,
      updated.data,
      updated.tipo,
      updated.descricao,
      updated.valor.toString(),
      updated.categoria,
      updated.forma_pagamento,
      updated.observacao || '',
      updated.recorrente_id || '',
      updated.conta_id || '',
    ];

    await updateSheet(credentials.sheetsId, `transacoes!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return false;
  }
}

// Delete transaction
export async function deleteTransaction(
  id: string,
  transactions: Transaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = transactions.findIndex(t => t.id === id);
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'transacoes', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
}

// Fetch categories
export async function fetchCategories(credentials: GoogleSheetsConfig): Promise<Category[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'categorias');
    
    return data.map(row => ({
      id: String(row.id || ''),
      nome: String(row.nome || ''),
      cor: String(row.cor || ''),
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Add category
export async function addCategory(
  category: Omit<Category, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const categoryData = [
      Date.now().toString(),
      category.nome,
      category.cor,
    ];

    await appendToSheet(credentials.sheetsId, 'categorias!A2', [categoryData]);
    return true;
  } catch (error) {
    console.error('Error adding category:', error);
    return false;
  }
}

// Update category
export async function updateCategory(
  id: string,
  category: Partial<Category>,
  categories: Category[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = categories.findIndex(c => c.id === id);
    if (rowIndex === -1) return false;

    const updated = { ...categories[rowIndex], ...category };
    const row = [
      updated.id,
      updated.nome,
      updated.cor,
    ];

    await updateSheet(credentials.sheetsId, `categorias!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating category:', error);
    return false;
  }
}

// Delete category
export async function deleteCategory(
  id: string,
  categories: Category[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = categories.findIndex(c => c.id === id);
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'categorias', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    return false;
  }
}

// Fetch goals
export async function fetchGoals(credentials: GoogleSheetsConfig): Promise<Goal[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'metas');
    
    const goals = data.map(row => ({
      id: String(row.id || ''),
      nome: String(row.nome || ''),
      valor_alvo: parseFloat(String(row.valor_alvo || '0')) || 0,
      valor_atual: parseFloat(String(row.valor_atual || '0')) || 0,
      prazo: String(row.prazo || ''),
      cor: String(row.cor || ''),
    }));
    
    // Recalculate valor_atual for each goal
    for (const goal of goals) {
      const transactions = await fetchGoalTransactions(goal.id, credentials);
      const calculatedValue = transactions.reduce((sum, t) => {
        return sum + (t.tipo === 'deposito' ? t.valor : -t.valor);
      }, 0);
      
      goal.valor_atual = Math.max(0, calculatedValue);
      
      // Update in sheet if different
      const goalIndex = data.findIndex((g: Record<string, unknown>) => String(g.id) === goal.id);
      if (goalIndex !== -1 && Math.abs(parseFloat(String(data[goalIndex].valor_atual || '0')) - calculatedValue) > 0.01) {
        const goalData = data[goalIndex];
        const row = [
          goalData.id,
          goalData.nome,
          goalData.valor_alvo,
          goal.valor_atual.toString(),
          goalData.prazo,
          goalData.cor,
        ];
        await updateSheet(credentials.sheetsId, `metas!A${goalIndex + 2}`, [row]);
      }
    }
    
    return goals;
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

// Add goal
export async function addGoal(
  goal: Omit<Goal, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const goalData = [
      Date.now().toString(),
      goal.nome,
      goal.valor_alvo.toString(),
      goal.valor_atual.toString(),
      goal.prazo,
      goal.cor,
    ];

    await appendToSheet(credentials.sheetsId, 'metas!A2', [goalData]);
    return true;
  } catch (error) {
    console.error('Error adding goal:', error);
    return false;
  }
}

// Update goal
export async function updateGoal(
  id: string,
  goal: Partial<Goal>,
  goals: Goal[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = goals.findIndex(g => g.id === id);
    if (rowIndex === -1) return false;

    const updated = { ...goals[rowIndex], ...goal };
    const row = [
      updated.id,
      updated.nome,
      updated.valor_alvo.toString(),
      updated.valor_atual.toString(),
      updated.prazo,
      updated.cor,
    ];

    await updateSheet(credentials.sheetsId, `metas!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating goal:', error);
    return false;
  }
}

// Delete goal
export async function deleteGoal(
  id: string,
  goals: Goal[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = goals.findIndex(g => g.id === id);
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'metas', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting goal:', error);
    return false;
  }
}

// Fetch goal transactions
export async function fetchGoalTransactions(
  goalId: string,
  credentials: GoogleSheetsConfig
): Promise<GoalTransaction[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'movimentacoes_metas');
    
    return data
      .filter(row => String(row.goal_id) === goalId)
      .map(row => ({
        id: String(row.id || ''),
        goal_id: String(row.goal_id || ''),
        tipo: row.tipo as GoalTransaction['tipo'],
        valor: parseFloat(String(row.valor || '0')) || 0,
        data: String(row.data || ''),
        observacao: String(row.observacao || ''),
      }))
      .sort((a, b) => {
        const parseDate = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        return parseDate(b.data).getTime() - parseDate(a.data).getTime();
      });
  } catch (error) {
    console.error('Error fetching goal transactions:', error);
    return [];
  }
}

// Add goal transaction
export async function addGoalTransaction(
  transaction: Omit<GoalTransaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const transactionData = [
      Date.now().toString(),
      transaction.goal_id,
      transaction.tipo,
      transaction.valor.toString(),
      transaction.data,
      transaction.observacao || '',
    ];

    await appendToSheet(credentials.sheetsId, 'movimentacoes_metas!A2', [transactionData]);
    
    // Recalculate goal value
    await recalculateGoalValue(transaction.goal_id, credentials);
    
    return true;
  } catch (error) {
    console.error('Error adding goal transaction:', error);
    return false;
  }
}

// Delete goal transaction
export async function deleteGoalTransaction(
  id: string,
  goalId: string,
  transactions: GoalTransaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const rowIndex = transactions.findIndex(t => t.id === id);
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'movimentacoes_metas', rowIndex);
    
    // Recalculate goal value
    await recalculateGoalValue(goalId, credentials);
    
    return true;
  } catch (error) {
    console.error('Error deleting goal transaction:', error);
    return false;
  }
}

// Recalculate goal value
async function recalculateGoalValue(
  goalId: string,
  credentials: GoogleSheetsConfig
): Promise<void> {
  try {
    const transactions = await fetchGoalTransactions(goalId, credentials);
    const total = transactions.reduce((sum, t) => {
      return sum + (t.tipo === 'deposito' ? t.valor : -t.valor);
    }, 0);
    
    const goalsData = await readSheet(credentials.sheetsId, 'metas');
    const goalIndex = goalsData.findIndex((g) => String(g.id) === goalId);
    
    if (goalIndex === -1) return;
    
    const goal = goalsData[goalIndex];
    const row = [
      goal.id,
      goal.nome,
      goal.valor_alvo,
      Math.max(0, total).toString(),
      goal.prazo,
      goal.cor,
    ];
    await updateSheet(credentials.sheetsId, `metas!A${goalIndex + 2}`, [row]);
  } catch (error) {
    console.error('Error recalculating goal value:', error);
  }
}

// Fetch recurring transactions
export async function fetchRecurringTransactions(
  credentials: GoogleSheetsConfig
): Promise<RecurringTransaction[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'transacoes_recorrentes');
    
    return data
      .map(row => ({
        id: String(row.id || ''),
        descricao: String(row.descricao || ''),
        tipo: row.tipo as RecurringTransaction['tipo'],
        valor: parseFloat(String(row.valor || '0')) || 0,
        categoria: String(row.categoria || ''),
        forma_pagamento: row.forma_pagamento as RecurringTransaction['forma_pagamento'],
        data_inicio: String(row.data_inicio || ''),
        recorrencia: row.recorrencia as RecurringTransaction['recorrencia'],
        fim_tipo: row.fim_tipo as RecurringTransaction['fim_tipo'],
        meses_duracao: row.meses_duracao ? parseInt(String(row.meses_duracao)) : undefined,
        ativo: String(row.ativo || 'true').toLowerCase() === 'true',
        observacao: String(row.observacao || ''),
      }))
      .sort((a, b) => {
        const parseDate = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        return parseDate(b.data_inicio).getTime() - parseDate(a.data_inicio).getTime();
      });
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    return [];
  }
}

// Add recurring transaction
export async function addRecurringTransaction(
  transaction: Omit<RecurringTransaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const transactionData = [
      Date.now().toString(),
      transaction.descricao,
      transaction.tipo,
      transaction.valor.toString(),
      transaction.categoria,
      transaction.forma_pagamento,
      transaction.data_inicio,
      transaction.recorrencia,
      transaction.fim_tipo,
      transaction.meses_duracao?.toString() || '',
      transaction.ativo.toString(),
      transaction.observacao || '',
    ];

    await appendToSheet(credentials.sheetsId, 'transacoes_recorrentes!A2', [transactionData]);
    return true;
  } catch (error) {
    console.error('Error adding recurring transaction:', error);
    return false;
  }
}

// Update recurring transaction
export async function updateRecurringTransaction(
  id: string,
  transaction: Partial<RecurringTransaction>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const data = await readSheet(credentials.sheetsId, 'transacoes_recorrentes');
    const rowIndex = data.findIndex((t) => String(t.id) === id);
    
    if (rowIndex === -1) return false;

    const existing = data[rowIndex];
    const updated = {
      id: String(existing.id || ''),
      descricao: transaction.descricao ?? String(existing.descricao || ''),
      tipo: transaction.tipo ?? String(existing.tipo || ''),
      valor: transaction.valor !== undefined ? transaction.valor.toString() : String(existing.valor || '0'),
      categoria: transaction.categoria ?? String(existing.categoria || ''),
      forma_pagamento: transaction.forma_pagamento ?? String(existing.forma_pagamento || ''),
      data_inicio: transaction.data_inicio ?? String(existing.data_inicio || ''),
      recorrencia: transaction.recorrencia ?? String(existing.recorrencia || ''),
      fim_tipo: transaction.fim_tipo ?? String(existing.fim_tipo || ''),
      meses_duracao: transaction.meses_duracao !== undefined 
        ? transaction.meses_duracao.toString() 
        : String(existing.meses_duracao || ''),
      ativo: transaction.ativo !== undefined ? transaction.ativo.toString() : String(existing.ativo || 'true'),
      observacao: transaction.observacao ?? String(existing.observacao || ''),
    };

    const row = [
      updated.id,
      updated.descricao,
      updated.tipo,
      updated.valor,
      updated.categoria,
      updated.forma_pagamento,
      updated.data_inicio,
      updated.recorrencia,
      updated.fim_tipo,
      updated.meses_duracao,
      updated.ativo,
      updated.observacao,
    ];

    await updateSheet(credentials.sheetsId, `transacoes_recorrentes!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating recurring transaction:', error);
    return false;
  }
}

// Delete recurring transaction
export async function deleteRecurringTransaction(
  id: string,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const data = await readSheet(credentials.sheetsId, 'transacoes_recorrentes');
    const rowIndex = data.findIndex((t) => String(t.id) === id);
    
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'transacoes_recorrentes', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    return false;
  }
}

// Generate forecast transactions from recurring transactions
export function generateForecastTransactions(
  recurringTransactions: RecurringTransaction[],
  monthsAhead: number
): ForecastTransaction[] {
  const forecasts: ForecastTransaction[] = [];
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + monthsAhead);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const addMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  };

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const addWeeks = (date: Date, weeks: number): Date => {
    return addDays(date, weeks * 7);
  };

  recurringTransactions.forEach((recurring) => {
    if (!recurring.ativo) return;

    const startDate = parseDate(recurring.data_inicio);
    if (startDate > endDate) return;

    // Check if transaction should end
    let shouldEnd = false;
    let endDateLimit: Date | null = null;

    if (recurring.fim_tipo === 'after_months' && recurring.meses_duracao) {
      endDateLimit = addMonths(startDate, recurring.meses_duracao);
      if (endDateLimit < today) {
        shouldEnd = true;
      }
    }

    if (shouldEnd) return;

    let currentDate = startDate > today ? startDate : today;
    const maxDate = endDateLimit && endDateLimit < endDate ? endDateLimit : endDate;

    let occurrenceCount = 0;
    const maxOccurrences = 1000; // Safety limit

    while (currentDate <= maxDate && occurrenceCount < maxOccurrences) {
      const forecast: ForecastTransaction = {
        id: `${recurring.id}-${formatDate(currentDate)}`,
        recurring_id: recurring.id,
        data: formatDate(currentDate),
        tipo: recurring.tipo,
        descricao: recurring.descricao,
        valor: recurring.valor,
        categoria: recurring.categoria,
        forma_pagamento: recurring.forma_pagamento,
        observacao: recurring.observacao,
      };

      forecasts.push(forecast);
      occurrenceCount++;

      // Calculate next occurrence based on recurrence type
      switch (recurring.recorrencia) {
        case 'mensal':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'bimestral':
          currentDate = addMonths(currentDate, 2);
          break;
        case 'trimestral':
          currentDate = addMonths(currentDate, 3);
          break;
        case 'semestral':
          currentDate = addMonths(currentDate, 6);
          break;
        case 'anual':
          currentDate = addMonths(currentDate, 12);
          break;
        default:
          // Unknown recurrence type, stop
          return;
      }
    }
  });

  return forecasts.sort((a, b) => {
    if (a.data < b.data) return -1;
    if (a.data > b.data) return 1;
    return 0;
  });
}

// Fetch bills
export async function fetchBills(
  credentials: GoogleSheetsConfig
): Promise<Bill[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'contas');
    
    return data
      .map(row => ({
        id: String(row.id || ''),
        tipo: row.tipo as Bill['tipo'],
        descricao: String(row.descricao || ''),
        valor: parseFloat(String(row.valor || '0')) || 0,
        categoria: String(row.categoria || ''),
        data_vencimento: row.data_vencimento ? String(row.data_vencimento) : null,
        data_pagamento: row.data_pagamento ? String(row.data_pagamento) : null,
        pago: String(row.pago || 'false').toLowerCase() === 'true',
        observacao: String(row.observacao || ''),
      }))
      .sort((a, b) => {
        const dateA = a.data_vencimento ? (() => {
          const [year, month, day] = a.data_vencimento!.split('-').map(Number);
          return new Date(year, month - 1, day);
        })() : null;
        const dateB = b.data_vencimento ? (() => {
          const [year, month, day] = b.data_vencimento!.split('-').map(Number);
          return new Date(year, month - 1, day);
        })() : null;
        
        if (!dateA && !dateB) return a.descricao.localeCompare(b.descricao);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return [];
  }
}

// Add bill
export async function addBill(
  bill: Omit<Bill, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const billData = [
      Date.now().toString(),
      bill.tipo,
      bill.descricao,
      bill.valor.toString(),
      bill.categoria,
      bill.data_vencimento || '',
      bill.data_pagamento || '',
      bill.pago.toString(),
      bill.observacao || '',
    ];

    await appendToSheet(credentials.sheetsId, 'contas!A2', [billData]);
    return true;
  } catch (error) {
    console.error('Error adding bill:', error);
    return false;
  }
}

// Update bill
export async function updateBill(
  id: string,
  bill: Partial<Bill>,
  bills: Bill[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const data = await readSheet(credentials.sheetsId, 'contas');
    const rowIndex = data.findIndex((b) => String(b.id) === id);
    
    if (rowIndex === -1) return false;

    const existing = data[rowIndex];
    const updated = {
      id: String(existing.id || ''),
      tipo: bill.tipo ?? String(existing.tipo || ''),
      descricao: bill.descricao ?? String(existing.descricao || ''),
      valor: bill.valor !== undefined ? bill.valor.toString() : String(existing.valor || '0'),
      categoria: bill.categoria ?? String(existing.categoria || ''),
      data_vencimento: bill.data_vencimento !== undefined ? (bill.data_vencimento || '') : String(existing.data_vencimento || ''),
      data_pagamento: bill.data_pagamento !== undefined ? (bill.data_pagamento || '') : String(existing.data_pagamento || ''),
      pago: bill.pago !== undefined ? bill.pago.toString() : String(existing.pago || 'false'),
      observacao: bill.observacao ?? String(existing.observacao || ''),
    };

    const row = [
      updated.id,
      updated.tipo,
      updated.descricao,
      updated.valor,
      updated.categoria,
      updated.data_vencimento,
      updated.data_pagamento,
      updated.pago,
      updated.observacao,
    ];

    await updateSheet(credentials.sheetsId, `contas!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating bill:', error);
    return false;
  }
}

// Delete bill
export async function deleteBill(
  id: string,
  bills: Bill[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const data = await readSheet(credentials.sheetsId, 'contas');
    const rowIndex = data.findIndex((b) => String(b.id) === id);
    
    if (rowIndex === -1) return false;

    await deleteRow(credentials.sheetsId, 'contas', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting bill:', error);
    return false;
  }
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function fetchBudgets(credentials: GoogleSheetsConfig): Promise<Budget[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'orcamentos');
    return data.map(row => ({
      id: String(row.id || ''),
      categoria: String(row.categoria || ''),
      valor_limite: parseFloat(String(row.valor_limite || '0')) || 0,
      mes: String(row.mes || ''),
    }));
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }
}

export async function addBudget(budget: Omit<Budget, 'id'>, credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const row = [Date.now().toString(), budget.categoria, budget.valor_limite.toString(), budget.mes || ''];
    await appendToSheet(credentials.sheetsId, 'orcamentos!A2', [row]);
    return true;
  } catch (error) {
    console.error('Error adding budget:', error);
    return false;
  }
}

export async function updateBudget(id: string, budget: Partial<Budget>, budgets: Budget[], credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const rowIndex = budgets.findIndex(b => b.id === id);
    if (rowIndex === -1) return false;
    const updated = { ...budgets[rowIndex], ...budget };
    const row = [updated.id, updated.categoria, updated.valor_limite.toString(), updated.mes || ''];
    await updateSheet(credentials.sheetsId, `orcamentos!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating budget:', error);
    return false;
  }
}

export async function deleteBudget(id: string, budgets: Budget[], credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const rowIndex = budgets.findIndex(b => b.id === id);
    if (rowIndex === -1) return false;
    await deleteRow(credentials.sheetsId, 'orcamentos', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting budget:', error);
    return false;
  }
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

export async function fetchBankAccounts(credentials: GoogleSheetsConfig): Promise<BankAccount[]> {
  try {
    const data = await readSheet(credentials.sheetsId, 'contas_bancarias');
    return data.map(row => ({
      id: String(row.id || ''),
      nome: String(row.nome || ''),
      tipo: (row.tipo as BankAccount['tipo']) || 'corrente',
      banco: String(row.banco || ''),
      saldo_inicial: parseFloat(String(row.saldo_inicial || '0')) || 0,
      cor: String(row.cor || '#7c3aed'),
      ativo: String(row.ativo || 'true').toLowerCase() === 'true',
    }));
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return [];
  }
}

export async function addBankAccount(account: Omit<BankAccount, 'id'>, credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const row = [Date.now().toString(), account.nome, account.tipo, account.banco || '', account.saldo_inicial.toString(), account.cor, account.ativo.toString()];
    await appendToSheet(credentials.sheetsId, 'contas_bancarias!A2', [row]);
    return true;
  } catch (error) {
    console.error('Error adding bank account:', error);
    return false;
  }
}

export async function updateBankAccount(id: string, account: Partial<BankAccount>, accounts: BankAccount[], credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const rowIndex = accounts.findIndex(a => a.id === id);
    if (rowIndex === -1) return false;
    const updated = { ...accounts[rowIndex], ...account };
    const row = [updated.id, updated.nome, updated.tipo, updated.banco || '', updated.saldo_inicial.toString(), updated.cor, updated.ativo.toString()];
    await updateSheet(credentials.sheetsId, `contas_bancarias!A${rowIndex + 2}`, [row]);
    return true;
  } catch (error) {
    console.error('Error updating bank account:', error);
    return false;
  }
}

export async function deleteBankAccount(id: string, accounts: BankAccount[], credentials: GoogleSheetsConfig): Promise<boolean> {
  try {
    const rowIndex = accounts.findIndex(a => a.id === id);
    if (rowIndex === -1) return false;
    await deleteRow(credentials.sheetsId, 'contas_bancarias', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return false;
  }
}

