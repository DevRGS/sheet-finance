import { Transaction, Category, Goal, GoogleSheetsConfig, GoalTransaction, RecurringTransaction, ForecastTransaction, Bill } from '@/types/finance';

interface SheetResponse<T> {
  data?: T;
  error?: string;
}

// Get Google OAuth access token using JWT
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Encode header and claim
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${headerB64}.${claimB64}`;

  // Import private key and sign
  const cleanKey = privateKey.replace(/\\n/g, '\n');
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = cleanKey.substring(
    cleanKey.indexOf(pemHeader) + pemHeader.length,
    cleanKey.indexOf(pemFooter)
  ).replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    console.error('Token error:', tokenData);
    throw new Error('Failed to get access token');
  }
  
  return tokenData.access_token;
}

// Make request to Google Sheets API
async function sheetsRequest(
  accessToken: string,
  sheetsId: string,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Sheets API error: ${response.status} - ${errorText}`);
    throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Ensure sheet exists with headers
async function ensureSheetExists(
  accessToken: string,
  sheetsId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  try {
    // Check if sheet exists
    const spreadsheet = await sheetsRequest(accessToken, sheetsId, '') as { 
      sheets: Array<{ properties: { title: string } }> 
    };
    const sheetExists = spreadsheet.sheets?.some(
      (s: { properties: { title: string } }) => s.properties.title === sheetName
    );

    if (!sheetExists) {
      // Create the sheet
      await sheetsRequest(accessToken, sheetsId, ':batchUpdate', 'POST', {
        requests: [{
          addSheet: {
            properties: { title: sheetName }
          }
        }]
      });
      console.log(`Created sheet: ${sheetName}`);

      // Add headers
      await sheetsRequest(accessToken, sheetsId, `/values/${sheetName}:append?valueInputOption=RAW`, 'POST', {
        values: [headers]
      });
      console.log(`Added headers to: ${sheetName}`);
    }
  } catch (error) {
    console.error(`Error ensuring sheet exists: ${error}`);
    throw error;
  }
}

// Initialize spreadsheet with all required sheets
async function initializeSpreadsheet(credentials: GoogleSheetsConfig): Promise<void> {
  const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const sheetsId = credentials.sheetsId;

  // Config sheet
  await ensureSheetExists(accessToken, sheetsId, 'config', ['chave', 'valor']);
  
  // Transactions sheet
  await ensureSheetExists(accessToken, sheetsId, 'transacoes', [
    'id', 'data', 'tipo', 'descricao', 'valor', 'categoria', 'forma_pagamento', 'observacao'
  ]);
  
  // Categories sheet with default values
  await ensureSheetExists(accessToken, sheetsId, 'categorias', ['id', 'nome', 'cor']);
  
  // Goals sheet
  await ensureSheetExists(accessToken, sheetsId, 'metas', ['id', 'nome', 'valor_alvo', 'valor_atual', 'prazo', 'cor']);
  
  // Goal transactions sheet
  await ensureSheetExists(accessToken, sheetsId, 'movimentacoes_metas', [
    'id', 'goal_id', 'tipo', 'valor', 'data', 'observacao'
  ]);
  
  // Recurring transactions sheet
  await ensureSheetExists(accessToken, sheetsId, 'transacoes_recorrentes', [
    'id', 'descricao', 'tipo', 'valor', 'categoria', 'forma_pagamento', 
    'data_inicio', 'recorrencia', 'fim_tipo', 'meses_duracao', 'ativo', 'observacao'
  ]);

  await ensureSheetExists(accessToken, sheetsId, 'contas', [
    'id', 'tipo', 'descricao', 'valor', 'categoria', 'data_vencimento', 'data_pagamento', 'pago', 'observacao'
  ]);

  // Check if categories are empty and add defaults
  const categoriesData = await sheetsRequest(accessToken, sheetsId, '/values/categorias!A2:C') as { values?: string[][] };
  if (!categoriesData.values || categoriesData.values.length === 0) {
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
    
    await sheetsRequest(accessToken, sheetsId, '/values/categorias:append?valueInputOption=RAW', 'POST', {
      values: defaultCategories
    });
    console.log('Added default categories');
  }

  // Add config entries
  const configData = await sheetsRequest(accessToken, sheetsId, '/values/config!A2:B') as { values?: string[][] };
  if (!configData.values || configData.values.length === 0) {
    await sheetsRequest(accessToken, sheetsId, '/values/config:append?valueInputOption=RAW', 'POST', {
      values: [
        ['data_criacao', new Date().toISOString()],
        ['versao', '1.0.0'],
      ]
    });
  }
}

// Read sheet data
async function readSheet(
  accessToken: string,
  sheetsId: string,
  sheet: string
): Promise<Record<string, unknown>[]> {
  const response = await sheetsRequest(accessToken, sheetsId, `/values/${sheet}`) as { values?: string[][] };
  
  if (!response.values || response.values.length < 2) {
    return [];
  }
  
  const [headers, ...rows] = response.values;
  return rows.map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

// Append to sheet
async function appendToSheet(
  accessToken: string,
  sheetsId: string,
  sheet: string,
  data: Record<string, unknown>[]
): Promise<void> {
  // Get headers first
  const headersResponse = await sheetsRequest(accessToken, sheetsId, `/values/${sheet}!1:1`) as { values?: string[][] };
  const headers = headersResponse.values?.[0] || [];

  if (!headers || headers.length === 0) {
    throw new Error(`No headers found for sheet: ${sheet}. Make sure the sheet exists and has headers in row 1.`);
  }

  const rows = data.map(item => {
    return headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    });
  });
  
  await sheetsRequest(accessToken, sheetsId, `/values/${sheet}:append?valueInputOption=RAW`, 'POST', {
    values: rows
  });
}

// Update in sheet
async function updateInSheet(
  accessToken: string,
  sheetsId: string,
  sheet: string,
  rowIndex: number,
  data: Record<string, unknown>
): Promise<void> {
  const headersResponse = await sheetsRequest(accessToken, sheetsId, `/values/${sheet}!1:1`) as { values?: string[][] };
  const headers = headersResponse.values?.[0] || [];

  const row = headers.map(header => {
    const value = data[header];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
  const range = `${sheet}!A${rowIndex + 2}:${String.fromCharCode(64 + headers.length)}${rowIndex + 2}`;
  
  await sheetsRequest(accessToken, sheetsId, `/values/${range}?valueInputOption=RAW`, 'PUT', {
    values: [row]
  });
}

// Delete from sheet
async function deleteFromSheet(
  accessToken: string,
  sheetsId: string,
  sheet: string,
  rowIndex: number
): Promise<void> {
  // Get sheet ID
  const spreadsheet = await sheetsRequest(accessToken, sheetsId, '') as { 
    sheets: Array<{ properties: { sheetId: number; title: string } }> 
  };
  const sheetInfo = spreadsheet.sheets?.find((s) => s.properties.title === sheet);
  
  if (!sheetInfo) {
    throw new Error(`Sheet ${sheet} not found`);
  }

  await sheetsRequest(accessToken, sheetsId, ':batchUpdate', 'POST', {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: sheetInfo.properties.sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex + 1, // +1 for header row
          endIndex: rowIndex + 2
        }
      }
    }]
  });
}

// Public API functions
export async function testConnection(credentials: GoogleSheetsConfig): Promise<{ success: boolean; message: string }> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    await sheetsRequest(accessToken, credentials.sheetsId, '');
    return { success: true, message: 'Conexão estabelecida com sucesso!' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, message: errorMessage };
  }
}

export async function initializeSpreadsheetPublic(credentials: GoogleSheetsConfig): Promise<{ success: boolean; message: string }> {
  try {
    await initializeSpreadsheet(credentials);
    return { success: true, message: 'Planilha inicializada com sucesso!' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, message: errorMessage };
  }
}

export async function fetchTransactions(credentials: GoogleSheetsConfig): Promise<Transaction[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'transacoes');
    
    return data.map(row => ({
      id: String(row.id || ''),
      data: String(row.data || ''),
    tipo: row.tipo as Transaction['tipo'],
      descricao: String(row.descricao || ''),
      valor: parseFloat(String(row.valor || '0')) || 0,
      categoria: String(row.categoria || ''),
    forma_pagamento: row.forma_pagamento as Transaction['forma_pagamento'],
      observacao: String(row.observacao || ''),
    }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    
    const transactionData = {
      id: Date.now().toString(),
      data: transaction.data || '',
      tipo: transaction.tipo || '',
      descricao: transaction.descricao || '',
      valor: transaction.valor?.toString() || '0',
      categoria: transaction.categoria || '',
      forma_pagamento: transaction.forma_pagamento || '',
      observacao: transaction.observacao || '',
    };

    await appendToSheet(accessToken, credentials.sheetsId, 'transacoes', [transactionData]);
    return true;
  } catch (error) {
    console.error('Error adding transaction:', error);
    return false;
  }
}

export async function updateTransaction(
  id: string,
  transaction: Partial<Transaction>,
  transactions: Transaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = transactions.findIndex(t => t.id === id);
  if (rowIndex === -1) return false;

  const updatedTransaction = { ...transactions[rowIndex], ...transaction };
    await updateInSheet(accessToken, credentials.sheetsId, 'transacoes', rowIndex, updatedTransaction);
    return true;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return false;
  }
}

export async function deleteTransaction(
  id: string,
  transactions: Transaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = transactions.findIndex(t => t.id === id);
  if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'transacoes', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
}

export async function fetchCategories(credentials: GoogleSheetsConfig): Promise<Category[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'categorias');
    
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

export async function addCategory(
  category: Omit<Category, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    await appendToSheet(accessToken, credentials.sheetsId, 'categorias', [{
      id: Date.now().toString(),
      ...category,
    }]);
    return true;
  } catch (error) {
    console.error('Error adding category:', error);
    return false;
  }
}

export async function updateCategory(
  id: string,
  category: Partial<Category>,
  categories: Category[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = categories.findIndex(c => c.id === id);
  if (rowIndex === -1) return false;

  const updatedCategory = { ...categories[rowIndex], ...category };
    await updateInSheet(accessToken, credentials.sheetsId, 'categorias', rowIndex, updatedCategory);
    return true;
  } catch (error) {
    console.error('Error updating category:', error);
    return false;
  }
}

export async function deleteCategory(
  id: string,
  categories: Category[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = categories.findIndex(c => c.id === id);
  if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'categorias', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    return false;
  }
}

export async function fetchGoals(credentials: GoogleSheetsConfig): Promise<Goal[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'metas');
    
    const goals = data.map(row => ({
      id: String(row.id || ''),
      nome: String(row.nome || ''),
      valor_alvo: parseFloat(String(row.valor_alvo || '0')) || 0,
      valor_atual: parseFloat(String(row.valor_atual || '0')) || 0,
      prazo: String(row.prazo || ''),
      cor: String(row.cor || ''),
    }));
    
    // Recalculate valor_atual for each goal based on transactions
    // This ensures the displayed value is always accurate
    for (const goal of goals) {
      const transactions = await fetchGoalTransactions(goal.id, credentials);
      const calculatedValue = transactions.reduce((sum, t) => {
        return sum + (t.tipo === 'deposito' ? t.valor : -t.valor);
      }, 0);
      
      // Update the goal's valor_atual with calculated value
      goal.valor_atual = Math.max(0, calculatedValue);
      
      // Update in sheet if different (to keep sheet in sync)
      const goalIndex = data.findIndex((g: Record<string, unknown>) => String(g.id) === goal.id);
      if (goalIndex !== -1 && Math.abs(parseFloat(String(data[goalIndex].valor_atual || '0')) - calculatedValue) > 0.01) {
        const goalData = data[goalIndex];
        await updateInSheet(accessToken, credentials.sheetsId, 'metas', goalIndex, {
          ...goalData,
          valor_atual: goal.valor_atual.toString(),
        });
      }
    }
    
    return goals;
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

export async function addGoal(
  goal: Omit<Goal, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    await appendToSheet(accessToken, credentials.sheetsId, 'metas', [{
      id: Date.now().toString(),
      ...goal,
    }]);
    return true;
  } catch (error) {
    console.error('Error adding goal:', error);
    return false;
  }
}

export async function updateGoal(
  id: string,
  goal: Partial<Goal>,
  goals: Goal[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = goals.findIndex(g => g.id === id);
  if (rowIndex === -1) return false;

  const updatedGoal = { ...goals[rowIndex], ...goal };
    await updateInSheet(accessToken, credentials.sheetsId, 'metas', rowIndex, updatedGoal);
    return true;
  } catch (error) {
    console.error('Error updating goal:', error);
    return false;
  }
}

export async function deleteGoal(
  id: string,
  goals: Goal[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
  const rowIndex = goals.findIndex(g => g.id === id);
  if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'metas', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting goal:', error);
    return false;
  }
}

// Goal Transactions functions
export async function fetchGoalTransactions(
  goalId: string,
  credentials: GoogleSheetsConfig
): Promise<GoalTransaction[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'movimentacoes_metas');
    
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
        // Parse dates safely to avoid timezone issues
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

export async function addGoalTransaction(
  transaction: Omit<GoalTransaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    
    const transactionData = {
      id: Date.now().toString(),
      goal_id: transaction.goal_id,
      tipo: transaction.tipo,
      valor: transaction.valor.toString(),
      data: transaction.data,
      observacao: transaction.observacao || '',
    };

    await appendToSheet(accessToken, credentials.sheetsId, 'movimentacoes_metas', [transactionData]);
    
    // Recalculate goal's valor_atual
    await recalculateGoalValue(transaction.goal_id, credentials);
    
    return true;
  } catch (error) {
    console.error('Error adding goal transaction:', error);
    return false;
  }
}

export async function deleteGoalTransaction(
  id: string,
  goalId: string,
  transactions: GoalTransaction[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const rowIndex = transactions.findIndex(t => t.id === id);
    if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'movimentacoes_metas', rowIndex);
    
    // Recalculate goal's valor_atual
    await recalculateGoalValue(goalId, credentials);
    
    return true;
  } catch (error) {
    console.error('Error deleting goal transaction:', error);
    return false;
  }
}

async function recalculateGoalValue(
  goalId: string,
  credentials: GoogleSheetsConfig
): Promise<void> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    
    // Get all transactions for this goal
    const transactions = await fetchGoalTransactions(goalId, credentials);
    
    // Calculate total
    const total = transactions.reduce((sum, t) => {
      return sum + (t.tipo === 'deposito' ? t.valor : -t.valor);
    }, 0);
    
    // Get goals to find the row index
    const goalsData = await readSheet(accessToken, credentials.sheetsId, 'metas');
    const goalIndex = goalsData.findIndex((g) => String(g.id) === goalId);
    
    if (goalIndex === -1) return;
    
    // Update goal's valor_atual
    const goal = goalsData[goalIndex];
    await updateInSheet(accessToken, credentials.sheetsId, 'metas', goalIndex, {
      ...goal,
      valor_atual: Math.max(0, total).toString(), // Ensure non-negative and convert to string
    });
  } catch (error) {
    console.error('Error recalculating goal value:', error);
  }
}

// Recurring Transactions
export async function fetchRecurringTransactions(
  credentials: GoogleSheetsConfig
): Promise<RecurringTransaction[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes');
    
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
        // Parse dates safely to avoid timezone issues
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

export async function addRecurringTransaction(
  transaction: Omit<RecurringTransaction, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    
    const transactionData = {
      id: Date.now().toString(),
      descricao: transaction.descricao,
      tipo: transaction.tipo,
      valor: transaction.valor.toString(),
      categoria: transaction.categoria,
      forma_pagamento: transaction.forma_pagamento,
      data_inicio: transaction.data_inicio,
      recorrencia: transaction.recorrencia,
      fim_tipo: transaction.fim_tipo,
      meses_duracao: transaction.meses_duracao?.toString() || '',
      ativo: transaction.ativo.toString(),
      observacao: transaction.observacao || '',
    };

    await appendToSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes', [transactionData]);
    return true;
  } catch (error) {
    console.error('Error adding recurring transaction:', error);
    return false;
  }
}

export async function updateRecurringTransaction(
  id: string,
  transaction: Partial<RecurringTransaction>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes');
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

    await updateInSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes', rowIndex, updated);
    return true;
  } catch (error) {
    console.error('Error updating recurring transaction:', error);
    return false;
  }
}

export async function deleteRecurringTransaction(
  id: string,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes');
    const rowIndex = data.findIndex((t) => String(t.id) === id);
    
    if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'transacoes_recorrentes', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    return false;
  }
}

// Generate forecast transactions based on recurring transactions
export function generateForecastTransactions(
  recurringTransactions: RecurringTransaction[],
  monthsAhead: number = 12
): ForecastTransaction[] {
  const forecasts: ForecastTransaction[] = [];
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + monthsAhead);

  // Map recurrence types to months
  const recurrenceMonths: Record<RecurringTransaction['recorrencia'], number> = {
    mensal: 1,
    bimestral: 2,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };

  // Helper to parse date string safely
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper to format date to YYYY-MM-DD
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to safely add months to a date, preserving the day when possible
  const addMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    const originalDay = result.getDate();
    const targetMonth = result.getMonth() + months;
    
    // Set to first day of target month to avoid rollover issues
    result.setMonth(targetMonth, 1);
    
    // Get the last day of the target month
    const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    
    // Use the original day, or the last day of the month if original day doesn't exist
    const dayToUse = Math.min(originalDay, lastDayOfMonth);
    result.setDate(dayToUse);
    
    return result;
  };

  recurringTransactions
    .filter(rt => rt.ativo)
    .forEach(rt => {
      const startDate = parseDateString(rt.data_inicio);
      const recurrenceMonthsValue = recurrenceMonths[rt.recorrencia];
      
      let currentDate = new Date(startDate);
      let occurrenceCount = 0;

      while (currentDate <= endDate) {
        // Check if we should stop based on fim_tipo
        if (rt.fim_tipo === 'after_months' && rt.meses_duracao) {
          const monthsSinceStart = 
            (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
            (currentDate.getMonth() - startDate.getMonth());
          
          if (monthsSinceStart >= rt.meses_duracao) {
            break;
          }
        }

        // Only include future dates
        if (currentDate >= today) {
          forecasts.push({
            id: `${rt.id}-${occurrenceCount}`,
            recurring_id: rt.id,
            data: formatDateToString(currentDate),
            tipo: rt.tipo,
            descricao: rt.descricao,
            valor: rt.valor,
            categoria: rt.categoria,
            forma_pagamento: rt.forma_pagamento,
            observacao: rt.observacao,
          });
        }

        // Move to next occurrence using safe month addition
        currentDate = addMonths(currentDate, recurrenceMonthsValue);
        occurrenceCount++;
      }
    });

  return forecasts.sort((a, b) => {
    const dateA = parseDateString(a.data);
    const dateB = parseDateString(b.data);
    return dateA.getTime() - dateB.getTime();
  });
}

// Helper to parse date string safely (used in multiple functions)
function parseDateStringSafe(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Bills (Contas a Pagar/Receber)
export async function fetchBills(
  credentials: GoogleSheetsConfig
): Promise<Bill[]> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'contas');
    
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
        // Sort by due date (nulls last), then by description
        const dateA = a.data_vencimento ? parseDateStringSafe(a.data_vencimento) : null;
        const dateB = b.data_vencimento ? parseDateStringSafe(b.data_vencimento) : null;
        
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

export async function addBill(
  bill: Omit<Bill, 'id'>,
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    
    const billData = {
      id: Date.now().toString(),
      tipo: bill.tipo,
      descricao: bill.descricao,
      valor: bill.valor.toString(),
      categoria: bill.categoria,
      data_vencimento: bill.data_vencimento || '',
      data_pagamento: bill.data_pagamento || '',
      pago: bill.pago.toString(),
      observacao: bill.observacao || '',
    };

    await appendToSheet(accessToken, credentials.sheetsId, 'contas', [billData]);
    return true;
  } catch (error) {
    console.error('Error adding bill:', error);
    return false;
  }
}

export async function updateBill(
  id: string,
  bill: Partial<Bill>,
  bills: Bill[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'contas');
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

    await updateInSheet(accessToken, credentials.sheetsId, 'contas', rowIndex, updated);
    return true;
  } catch (error) {
    console.error('Error updating bill:', error);
    return false;
  }
}

export async function deleteBill(
  id: string,
  bills: Bill[],
  credentials: GoogleSheetsConfig
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(credentials.serviceAccountEmail, credentials.privateKey);
    const data = await readSheet(accessToken, credentials.sheetsId, 'contas');
    const rowIndex = data.findIndex((b) => String(b.id) === id);
    
    if (rowIndex === -1) return false;

    await deleteFromSheet(accessToken, credentials.sheetsId, 'contas', rowIndex);
    return true;
  } catch (error) {
    console.error('Error deleting bill:', error);
    return false;
  }
}
