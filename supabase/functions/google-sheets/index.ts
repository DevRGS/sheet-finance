import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SheetRequest {
  action: 'test' | 'read' | 'append' | 'update' | 'delete' | 'init';
  sheet?: string;
  data?: Record<string, unknown>[];
  rowIndex?: number;
  credentials?: {
    email: string;
    sheetsId: string;
    privateKey: string;
  };
}

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

  console.log(`Making request to: ${method} ${endpoint}`);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Sheets API error: ${response.status} - ${errorText}`);
    throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function ensureSheetExists(accessToken: string, sheetsId: string, sheetName: string, headers: string[]): Promise<void> {
  try {
    // Check if sheet exists
    const spreadsheet = await sheetsRequest(accessToken, sheetsId, '') as { sheets: Array<{ properties: { title: string } }> };
    const sheetExists = spreadsheet.sheets?.some((s: { properties: { title: string } }) => s.properties.title === sheetName);

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

      // Add headers - use SheetName:append format
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

async function initializeSpreadsheet(accessToken: string, sheetsId: string): Promise<void> {
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

async function readSheet(accessToken: string, sheetsId: string, sheet: string): Promise<Record<string, unknown>[]> {
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

async function appendToSheet(
  accessToken: string,
  sheetsId: string,
  sheet: string,
  data: Record<string, unknown>[]
): Promise<void> {
  try {
    // Get headers first
    console.log(`Getting headers for sheet: ${sheet}`);
    const headersResponse = await sheetsRequest(accessToken, sheetsId, `/values/${sheet}!1:1`) as { values?: string[][] };
    const headers = headersResponse.values?.[0] || [];

    if (!headers || headers.length === 0) {
      throw new Error(`No headers found for sheet: ${sheet}. Make sure the sheet exists and has headers in row 1.`);
    }

    console.log(`Headers for ${sheet}:`, headers);
    console.log(`Data to append:`, JSON.stringify(data, null, 2));

    const rows = data.map(item => {
      const row = headers.map(header => {
        const value = item[header];
        // Convert all values to strings for RAW input
        if (value === null || value === undefined) {
          return '';
        }
        return String(value);
      });
      console.log(`Row mapped (${row.length} columns):`, row);
      return row;
    });
    
    console.log(`Appending ${rows.length} row(s) to ${sheet} with ${headers.length} columns`);
    
    // Use the correct format for append: /values/{range}:append
    // The range should be just the sheet name, not SheetName!A:append
    // The API will automatically append to the next available row
    const endpoint = `/values/${sheet}:append?valueInputOption=RAW`;
    console.log(`Making append request to: ${endpoint}`);
    
    const requestBody = {
      values: rows
    };
    
    console.log(`Request body:`, JSON.stringify(requestBody, null, 2));
    
    await sheetsRequest(accessToken, sheetsId, endpoint, 'POST', requestBody);
    
    console.log(`Successfully appended data to ${sheet}`);
  } catch (error) {
    console.error(`Error in appendToSheet for ${sheet}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to append to sheet ${sheet}: ${errorMessage}`);
  }
}

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
    // Convert all values to strings for RAW input
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SheetRequest = await req.json();
    const { action, sheet, data, rowIndex, credentials } = body;

    // Get credentials from request body or environment variables (fallback)
    const email = credentials?.email || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const sheetsId = credentials?.sheetsId || Deno.env.get('GOOGLE_SHEETS_ID');
    const privateKey = credentials?.privateKey || Deno.env.get('GOOGLE_PRIVATE_KEY');

    if (!email || !sheetsId || !privateKey) {
      console.error('Missing credentials');
      return new Response(
        JSON.stringify({ error: 'Credenciais não configuradas. Configure na página de Configurações.', code: 'MISSING_CREDENTIALS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing action: ${action} for sheet: ${sheet || 'N/A'}`);

    const accessToken = await getAccessToken(email, privateKey);

    let result: unknown;

    switch (action) {
      case 'test':
        // Just test the connection
        await sheetsRequest(accessToken, sheetsId, '');
        result = { success: true, message: 'Conexão estabelecida com sucesso!' };
        break;

      case 'init':
        await initializeSpreadsheet(accessToken, sheetsId);
        result = { success: true, message: 'Planilha inicializada com sucesso!' };
        break;

      case 'read':
        if (!sheet) throw new Error('Sheet name required');
        result = await readSheet(accessToken, sheetsId, sheet);
        break;

      case 'append':
        if (!sheet || !data) {
          throw new Error('Sheet name and data required');
        }
        if (!Array.isArray(data)) {
          throw new Error('Data must be an array');
        }
        console.log(`Appending to sheet ${sheet} with ${data.length} item(s)`);
        await appendToSheet(accessToken, sheetsId, sheet, data);
        result = { success: true };
        break;

      case 'update':
        if (!sheet || rowIndex === undefined || !data?.[0]) {
          throw new Error('Sheet name, row index, and data required');
        }
        await updateInSheet(accessToken, sheetsId, sheet, rowIndex, data[0]);
        result = { success: true };
        break;

      case 'delete':
        if (!sheet || rowIndex === undefined) {
          throw new Error('Sheet name and row index required');
        }
        await deleteFromSheet(accessToken, sheetsId, sheet, rowIndex);
        result = { success: true };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in Edge Function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      errorType: error?.constructor?.name,
    });
    
    // Return a more detailed error message
    const errorResponse = {
      error: errorMessage,
      ...(errorStack && { stack: errorStack }),
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
