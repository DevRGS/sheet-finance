import localforage from 'localforage';

import type { Bill, Budget, Category, Goal, GoalTransaction, RecurringTransaction, Transaction, BankAccount } from '@/types/finance';

export interface FinanceSnapshot {
  version: 1;
  sheetsId?: string;
  updatedAt: string; // ISO
  data: {
    transactions: Transaction[];
    categories: Category[];
    goals: Goal[];
    goalTransactions: GoalTransaction[];
    recurringTransactions: RecurringTransaction[];
    bills: Bill[];
    budgets: Budget[];
    bankAccounts: BankAccount[];
  };
}

const store = localforage.createInstance({
  name: 'financeflow',
  storeName: 'snapshots',
});

function keyFor(sheetsId?: string) {
  return `snapshot:${sheetsId || 'default'}`;
}

export async function saveFinanceSnapshot(snapshot: FinanceSnapshot): Promise<void> {
  await store.setItem(keyFor(snapshot.sheetsId), snapshot);
}

export async function loadFinanceSnapshot(sheetsId?: string): Promise<FinanceSnapshot | null> {
  const snap = await store.getItem<FinanceSnapshot>(keyFor(sheetsId));
  if (!snap || snap.version !== 1) return null;
  return snap;
}

