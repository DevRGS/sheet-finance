/**
 * Ponto de entrada do serviço Google Sheets usado pela app.
 *
 * Reexporta tudo de googleSheetsGapi, mas as funções que alteram a planilha passam por uma fila
 * por planilha: correm uma de cada vez. Atualizar/excluir localiza a linha pelo número e depois
 * escreve nela; em paralelo, uma exclusão deslocaria as linhas e outra operação poderia
 * gravar ou apagar a linha errada.
 *
 * As exportações locais abaixo têm precedência sobre o `export *`.
 */
import type { GoogleSheetsConfig } from '@/types/finance';
import * as api from './googleSheetsGapi';

export * from './googleSheetsGapi';

const mutationQueues = new Map<string, Promise<unknown>>();

/** Envolve uma mutação cujo último argumento é a config da planilha. */
function serialized<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => {
    const config = args[args.length - 1] as GoogleSheetsConfig | undefined;
    const key = config?.sheetsId ?? '';
    const previous = mutationQueues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => fn(...args));
    const tail = run.catch(() => undefined);
    mutationQueues.set(key, tail);
    void tail.then(() => {
      if (mutationQueues.get(key) === tail) mutationQueues.delete(key);
    });
    return run;
  };
}

export const addTransaction = serialized(api.addTransaction);
export const addTransactionsBatch = serialized(api.addTransactionsBatch);
export const updateTransaction = serialized(api.updateTransaction);
export const updateTransactionsBatch = serialized(api.updateTransactionsBatch);
export const deleteTransaction = serialized(api.deleteTransaction);
export const deleteTransactionsBatch = serialized(api.deleteTransactionsBatch);

export const addCategory = serialized(api.addCategory);
export const updateCategory = serialized(api.updateCategory);
export const deleteCategory = serialized(api.deleteCategory);

export const addGoal = serialized(api.addGoal);
export const updateGoal = serialized(api.updateGoal);
export const deleteGoal = serialized(api.deleteGoal);
export const addGoalTransaction = serialized(api.addGoalTransaction);
export const deleteGoalTransaction = serialized(api.deleteGoalTransaction);

export const addRecurringTransaction = serialized(api.addRecurringTransaction);
export const updateRecurringTransaction = serialized(api.updateRecurringTransaction);
export const deleteRecurringTransaction = serialized(api.deleteRecurringTransaction);

export const addBill = serialized(api.addBill);
export const updateBill = serialized(api.updateBill);
export const deleteBill = serialized(api.deleteBill);

export const addBudget = serialized(api.addBudget);
export const updateBudget = serialized(api.updateBudget);
export const deleteBudget = serialized(api.deleteBudget);

export const addBankAccount = serialized(api.addBankAccount);
export const updateBankAccount = serialized(api.updateBankAccount);
export const deleteBankAccount = serialized(api.deleteBankAccount);
