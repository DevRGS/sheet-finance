export type TransactionType = 'Receita' | 'Despesa' | 'Transferência';

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
  /** ID da transação recorrente de origem (preenchido quando a entrada foi gerada automaticamente) */
  recorrente_id?: string;
  /** ID da conta bancária de origem/destino */
  conta_id?: string;
  /** ID da conta bancária destino (apenas para Transferência) */
  conta_destino_id?: string;
  /** ID para vincular as duas pontas da transferência (opcional) */
  transferencia_id?: string;
  /** Se a transação já foi conferida/conciliada */
  confirmado?: boolean;
}

export interface Category {
  id: string;
  nome: string;
  cor: string;
  /** Tipo da categoria para separar Receitas/Despesas */
  tipo: 'Receita' | 'Despesa' | 'Ambos';
}

export interface Goal {
  id: string;
  nome: string;
  valor_alvo: number;
  valor_atual: number;
  prazo: string;
  cor: string;
}

export interface GoogleSheetsConfig {
  sheetsId: string;
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

export interface TransactionFilters {
  search: string;
  tipo: 'all' | 'Receita' | 'Despesa' | 'Transferência';
  categoria: string;
  periodo: {
    inicio: string | null;
    fim: string | null;
  };
}

export type GoalTransactionType = 'deposito' | 'saque';

export interface GoalTransaction {
  id: string;
  goal_id: string;
  tipo: GoalTransactionType;
  valor: number;
  data: string;
  observacao?: string;
}

export interface BalanceData {
  month: string;
  monthKey: string; // YYYY-MM format for sorting
  entradas: number;
  saidas: number;
  investimentos: number;
  investimentos_metas: number;
  saldo: number;
  saldo_acumulado: number;
  receita_prevista?: number; // Receitas previstas de contas a receber não recebidas
}

export type RecurrenceType = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type RecurrenceEndType = 'after_months' | 'until_cancelled';

export interface RecurringTransaction {
  id: string;
  descricao: string;
  tipo: TransactionType;
  valor: number;
  categoria: string;
  forma_pagamento: PaymentMethod;
  data_inicio: string; // YYYY-MM-DD
  recorrencia: RecurrenceType;
  fim_tipo: RecurrenceEndType;
  meses_duracao?: number; // Se fim_tipo === 'after_months'
  ativo: boolean;
  observacao?: string;
}

export interface ForecastTransaction {
  id: string;
  recurring_id: string;
  data: string; // YYYY-MM-DD
  tipo: TransactionType;
  descricao: string;
  valor: number;
  categoria: string;
  forma_pagamento: PaymentMethod;
  observacao?: string;
}

// ── Budget ────────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  categoria: string;
  valor_limite: number;
  /** YYYY-MM for a specific month, empty string for recurring monthly */
  mes: string;
}

// ── Bank Account ──────────────────────────────────────────────────────────────

export type AccountType = 'corrente' | 'poupanca' | 'investimento' | 'carteira' | 'cartao_credito';

export interface BankAccount {
  id: string;
  nome: string;
  tipo: AccountType;
  banco: string;
  saldo_inicial: number;
  cor: string;
  ativo: boolean;
}

// ── Bills ─────────────────────────────────────────────────────────────────────

export type BillType = 'pagar' | 'receber';

export interface Bill {
  id: string;
  tipo: BillType;
  descricao: string;
  valor: number;
  categoria: string;
  data_vencimento: string | null; // YYYY-MM-DD ou null
  data_pagamento: string | null; // YYYY-MM-DD ou null (quando pago/recebido)
  pago: boolean;
  observacao?: string;
}