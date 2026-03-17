import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Transaction } from '@/types/finance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseDateBR(raw: string): string {
  // Handle formats: DD/MM/YYYY, YYYYMMDD, YYYY-MM-DD
  const clean = raw.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    return `${y}-${m}-${d}`;
  }
  return clean;
}

function parseAmount(raw: string): number {
  return parseFloat(raw.trim().replace(/\./g, '').replace(',', '.')) || 0;
}

type ParsedTransaction = Omit<Transaction, 'id'> & { _duplicate?: boolean; _selected: boolean };

function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const colDate = headers.findIndex((h) => h.includes('data') || h.includes('date'));
  const colDesc = headers.findIndex((h) => h.includes('desc') || h.includes('memo') || h.includes('hist'));
  const colVal = headers.findIndex((h) => h.includes('valor') || h.includes('amount') || h.includes('value'));
  const colTipo = headers.findIndex((h) => h.includes('tipo') || h.includes('type'));

  if (colDate === -1 || colVal === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/"/g, ''));
    const rawVal = cols[colVal] || '0';
    const valor = Math.abs(parseAmount(rawVal));
    const tipo: 'Receita' | 'Despesa' = colTipo !== -1
      ? (cols[colTipo].toLowerCase().includes('receita') || parseAmount(rawVal) > 0 ? 'Receita' : 'Despesa')
      : (parseAmount(rawVal) >= 0 ? 'Receita' : 'Despesa');

    return {
      data: parseDateBR(cols[colDate] || ''),
      tipo,
      descricao: (colDesc !== -1 ? cols[colDesc] : '') || 'Importado',
      valor,
      categoria: 'Outros',
      forma_pagamento: 'Transferência' as const,
      observacao: 'Importado via CSV',
      _selected: true,
    };
  }).filter((t) => t.data && t.valor > 0);
}

function parseOFX(content: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const trnType = get('TRNTYPE').toUpperCase();
    const dtPosted = get('DTPOSTED');
    const trnAmt = get('TRNAMT');
    const memo = get('MEMO') || get('NAME') || 'Importado';

    const amount = parseFloat(trnAmt) || 0;
    const tipo: 'Receita' | 'Despesa' = trnType === 'CREDIT' || amount > 0 ? 'Receita' : 'Despesa';

    if (dtPosted) {
      results.push({
        data: parseDateBR(dtPosted.slice(0, 8)),
        tipo,
        descricao: memo,
        valor: Math.abs(amount),
        categoria: 'Outros',
        forma_pagamento: 'Transferência' as const,
        observacao: 'Importado via OFX',
        _selected: true,
      });
    }
  }

  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'review' | 'done';

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const { transactions, addTransaction, categories, isLoading } = useFinanceContext();
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isOFX = file.name.toLowerCase().endsWith('.ofx') || content.includes('<OFX>') || content.includes('OFXHEADER');
      const items = isOFX ? parseOFX(content) : parseCSV(content);

      // Mark duplicates
      const existingDescs = new Set(transactions.map((t) => `${t.data}|${t.descricao}|${t.valor}`));
      const marked = items.map((item) => ({
        ...item,
        _duplicate: existingDescs.has(`${item.data}|${item.descricao}|${item.valor}`),
        _selected: !existingDescs.has(`${item.data}|${item.descricao}|${item.valor}`),
      }));

      if (marked.length === 0) {
        toast.error('Nenhuma transação encontrada. Verifique o formato do arquivo.');
        return;
      }

      setParsed(marked);
      setStep('review');
    };
    reader.readAsText(file, 'UTF-8');
  }, [transactions]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleItem = (idx: number) => {
    setParsed((prev) => prev.map((item, i) => i === idx ? { ...item, _selected: !item._selected } : item));
  };

  const toggleAll = () => {
    const allSelected = parsed.every((p) => p.selected);
    setParsed((prev) => prev.map((item) => ({ ...item, _selected: !allSelected })));
  };

  const handleImport = async () => {
    const toImport = parsed.filter((p) => p._selected);
    if (toImport.length === 0) { toast.warning('Nenhuma transação selecionada'); return; }

    setImporting(true);
    let count = 0;
    for (const item of toImport) {
      const { _duplicate, _selected, ...tx } = item;
      const defaultCat = categories[0]?.nome || 'Outros';
      const success = await addTransaction({ ...tx, categoria: tx.categoria || defaultCat });
      if (success) count++;
    }
    setImportedCount(count);
    setImporting(false);
    setStep('done');
    toast.success(`${count} transação(ões) importada(s) com sucesso!`);
  };

  const handleClose = () => {
    setStep('upload');
    setParsed([]);
    setFileName('');
    setImportedCount(0);
    onOpenChange(false);
  };

  const selectedCount = parsed.filter((p) => p._selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
          <DialogDescription>
            Importe um arquivo CSV ou OFX exportado pelo seu banco.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 p-12 text-center transition-colors hover:border-primary/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-base font-medium">Arraste o arquivo aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
              <p className="mt-1 text-xs text-muted-foreground">Suporta CSV e OFX</p>
            </div>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>Selecionar Arquivo</span>
              </Button>
              <input
                type="file"
                accept=".csv,.ofx,.txt"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{fileName}</span>
                <Badge variant="secondary">{parsed.length} encontradas</Badge>
                {parsed.filter((p) => p._duplicate).length > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    {parsed.filter((p) => p._duplicate).length} duplicatas
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                {parsed.every((p) => p._selected) ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-80 rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="p-2 w-8" />
                    <th className="p-2 text-left font-medium">Data</th>
                    <th className="p-2 text-left font-medium">Descrição</th>
                    <th className="p-2 text-left font-medium">Tipo</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        'border-t border-muted/50 transition-colors',
                        item._duplicate && 'opacity-50',
                        item._selected ? 'bg-background' : 'bg-muted/30'
                      )}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={item._selected}
                          onCheckedChange={() => toggleItem(idx)}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{item.data}</td>
                      <td className="p-2 max-w-[180px] truncate" title={item.descricao}>
                        {item.descricao}
                        {item._duplicate && (
                          <span className="ml-1 text-xs text-amber-500">(duplicata)</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            item.tipo === 'Receita'
                              ? 'border-emerald-500/30 text-emerald-600'
                              : 'border-rose-500/30 text-rose-600'
                          )}
                        >
                          {item.tipo}
                        </Badge>
                      </td>
                      <td className={cn('p-2 text-right font-medium', item.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600')}>
                        {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} de {parsed.length} selecionadas
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar {selectedCount > 0 && `(${selectedCount})`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">{importedCount} transação(ões) importada(s)!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Suas transações foram adicionadas com sucesso.
              </p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
