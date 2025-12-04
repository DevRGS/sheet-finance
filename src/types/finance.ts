export type TransactionType = 'Receita' | 'Despesa';

export type PaymentMethod = 'Cartão' | 'PIX' | 'Dinheiro' | 'Transferência' | 'Boleto';

export interface Transaction {
  id: string;
  data: string;
  tipo: TransactionType;
  descricao: string;
  valor: number;
  categoria: string;
  forma_pagamento: PaymentMethod;
  observacao?: string;
}

export interface Category {
  id: string;
  nome: string;
  cor: string;
}

export interface GoogleSheetsConfig {
  serviceAccountEmail: string;
  sheetsId: string;
  privateKey: string;
  isConnected: boolean;
}

export interface MonthlyData {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface CategoryData {
  categoria: string;
  valor: number;
  cor: string;
}
