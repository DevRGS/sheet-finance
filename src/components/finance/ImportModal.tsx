import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { Transaction } from '@/types/finance';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { categorizeTransaction, type ImportRule } from '@/services/importCategorizer';

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

type ParsedTransaction = Omit<Transaction, 'id'> & {
  _key: string;
  _duplicate?: boolean;
  _selected: boolean;
  _needsReview?: boolean;
  _reason?: string;
};

const RULES_KEY = 'finance_import_rules_v1';

function loadRules(): ImportRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    const parsed = raw ? (JSON.parse(raw) as ImportRule[]) : [];
    return Array.isArray(parsed) ? parsed.filter((r) => r?.match && r?.categoria) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: ImportRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

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

  return lines.slice(1).map((line, idx) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/"/g, ''));
    const rawVal = cols[colVal] || '0';
    const valor = Math.abs(parseAmount(rawVal));
    const tipo: 'Receita' | 'Despesa' = colTipo !== -1
      ? (cols[colTipo].toLowerCase().includes('receita') || parseAmount(rawVal) > 0 ? 'Receita' : 'Despesa')
      : (parseAmount(rawVal) >= 0 ? 'Receita' : 'Despesa');

    const data = parseDateBR(cols[colDate] || '');
    const descricao = (colDesc !== -1 ? cols[colDesc] : '') || 'Importado';

    return {
      _key: `csv|${idx}|${data}|${descricao}|${valor}|${tipo}`,
      data,
      tipo,
      descricao,
      valor,
      categoria: '',
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
  let idx = 0;

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
      const data = parseDateBR(dtPosted.slice(0, 8));
      results.push({
        _key: `ofx|${idx++}|${data}|${memo}|${Math.abs(amount)}|${tipo}`,
        data,
        tipo,
        descricao: memo,
        valor: Math.abs(amount),
        categoria: '',
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
  const { transactions, addTransaction, categories, isLoading, isConnected, hasOfflineSnapshot } = useFinanceContext();
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [rules, setRules] = useState<ImportRule[]>(() => loadRules());
  const [newMatch, setNewMatch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'needsReview' | 'all' | 'duplicates'>('needsReview');
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState<string>('');

  useEffect(() => {
    saveRules(rules);
  }, [rules]);

  const categoryOptionsAll = useMemo(
    () => Array.from(new Set(categories.map((c) => c.nome))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [categories]
  );

  const categoryOptionsByTipo = useMemo(() => {
    const map = {
      Receita: [] as string[],
      Despesa: [] as string[],
      Transferência: [] as string[],
    };
    for (const c of categories) {
      const nome = (c.nome || '').trim();
      if (!nome) continue;
      if (c.tipo === 'Ambos') {
        map.Receita.push(nome);
        map.Despesa.push(nome);
        map.Transferência.push(nome);
      } else if (c.tipo === 'Receita') {
        map.Receita.push(nome);
      } else {
        map.Despesa.push(nome);
      }
    }
    (Object.keys(map) as Array<keyof typeof map>).forEach((k) => {
      map[k] = Array.from(new Set(map[k])).sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [categories]);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isOFX = file.name.toLowerCase().endsWith('.ofx') || content.includes('<OFX>') || content.includes('OFXHEADER');
      const items = isOFX ? parseOFX(content) : parseCSV(content);

      // Mark duplicates
      const existingDescs = new Set(transactions.map((t) => `${t.data}|${t.descricao}|${t.valor}`));
      const marked = items.map((item) => {
        const cat = categorizeTransaction({
          description: item.descricao,
          tipo: item.tipo,
          amount: item.valor,
          rules,
          categories: (item.tipo === 'Receita'
            ? (categoryOptionsByTipo.Receita.length > 0 ? categoryOptionsByTipo.Receita : categoryOptionsAll)
            : item.tipo === 'Despesa'
              ? (categoryOptionsByTipo.Despesa.length > 0 ? categoryOptionsByTipo.Despesa : categoryOptionsAll)
              : categoryOptionsAll),
        });
        const categoria = cat.categoriaSugerida || item.categoria || '';
        const key = `${item.data}|${item.descricao}|${item.valor}`;
        const duplicate = existingDescs.has(key);
        return {
          ...item,
          categoria,
          _needsReview: cat.needsReview || !categoria,
          _reason: cat.reason,
          _duplicate: duplicate,
          _selected: !duplicate,
        };
      });

      if (marked.length === 0) {
        toast.error('Nenhuma transação encontrada. Verifique o formato do arquivo.');
        return;
      }

      setParsed(marked);
      setReviewFilter('needsReview');
      setPageIndex(0);
      setSelectedGroupKey((marked.find((m) => !m._duplicate)?.descricao || marked[0]?.descricao || '').trim() || null);
      setStep('review');
    };
    reader.readAsText(file, 'UTF-8');
  }, [transactions, rules, categoryOptionsByTipo, categoryOptionsAll]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleItem = (key: string) => {
    setParsed((prev) => prev.map((item) => item._key === key ? { ...item, _selected: !item._selected } : item));
  };

  const toggleAll = () => {
    const allSelected = parsed.every((p) => p._selected);
    setParsed((prev) => prev.map((item) => ({ ...item, _selected: !allSelected })));
  };

  const updateItem = (key: string, patch: Partial<ParsedTransaction>) => {
    setParsed((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  };

  const updateMany = (keys: string[], patch: Partial<ParsedTransaction>) => {
    const keySet = new Set(keys);
    setParsed((prev) => prev.map((it) => (keySet.has(it._key) ? { ...it, ...patch } : it)));
  };

  const handleImport = async () => {
    if (!isConnected) {
      toast.error(
        hasOfflineSnapshot
          ? 'Você está em modo offline (somente leitura). Conecte ao Google Sheets para importar.'
          : 'Conecte ao Google Sheets para importar.'
      );
      return;
    }

    const toImport = parsed.filter((p) => p._selected);
    if (toImport.length === 0) { toast.warning('Nenhuma transação selecionada'); return; }

    const pendingReview = toImport.filter((p) => p._needsReview || !p.categoria);
    if (pendingReview.length > 0) {
      toast.warning(`Você ainda tem ${pendingReview.length} item(ns) selecionado(s) para revisar. Ajuste a categoria e marque como revisada.`);
      return;
    }

    setImporting(true);
    let count = 0;
    for (const item of toImport) {
      const { _duplicate, _selected, _needsReview, _reason, _key, ...tx } = item;
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
    setReviewFilter('needsReview');
    setPageIndex(0);
    setSelectedGroupKey(null);
    setBulkCategory('');
    onOpenChange(false);
  };

  const selectedCount = parsed.filter((p) => p._selected).length;
  const needsReviewCount = parsed.filter((p) => p._selected && p._needsReview).length;
  const selectedItems = useMemo(() => parsed.filter((p) => p._selected), [parsed]);
  const selectedTipos = useMemo(() => Array.from(new Set(selectedItems.map((i) => i.tipo))), [selectedItems]);
  const bulkOptions = useMemo(() => {
    if (selectedTipos.length === 1 && selectedTipos[0] === 'Receita') {
      return categoryOptionsByTipo.Receita.length > 0 ? categoryOptionsByTipo.Receita : categoryOptionsAll;
    }
    if (selectedTipos.length === 1 && selectedTipos[0] === 'Despesa') {
      return categoryOptionsByTipo.Despesa.length > 0 ? categoryOptionsByTipo.Despesa : categoryOptionsAll;
    }
    return categoryOptionsAll;
  }, [selectedTipos, categoryOptionsByTipo, categoryOptionsAll]);

  const filteredItems = useMemo(() => {
    return parsed.filter((p) => {
      if (reviewFilter === 'duplicates') return !!p._duplicate;
      if (reviewFilter === 'needsReview') return !!p._needsReview;
      return true;
    });
  }, [parsed, reviewFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, ParsedTransaction[]>();
    for (const item of filteredItems) {
      const gk = (item.descricao || '').trim() || '—';
      const arr = map.get(gk);
      if (arr) arr.push(item);
      else map.set(gk, [item]);
    }

    const arr = Array.from(map.entries()).map(([groupKey, items]) => {
      const selectedInGroup = items.filter((i) => i._selected).length;
      const needsReviewInGroup = items.filter((i) => i._needsReview).length;
      const duplicatesInGroup = items.filter((i) => i._duplicate).length;
      const amountSum = items.reduce((acc, i) => acc + (i.tipo === 'Receita' ? i.valor : -i.valor), 0);
      return {
        groupKey,
        items,
        keys: items.map((i) => i._key),
        selectedInGroup,
        needsReviewInGroup,
        duplicatesInGroup,
        amountSum,
      };
    });

    // Ordena: primeiro os que precisam revisar, depois por maior quantidade
    arr.sort((a, b) => {
      const aR = a.needsReviewInGroup > 0 ? 0 : 1;
      const bR = b.needsReviewInGroup > 0 ? 0 : 1;
      if (aR !== bR) return aR - bR;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.groupKey.localeCompare(b.groupKey);
    });

    return arr;
  }, [filteredItems]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageGroups = groups.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePageIndex]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return groups.find((g) => g.groupKey === selectedGroupKey) ?? null;
  }, [groups, selectedGroupKey]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[1200px] h-[92vh] overflow-hidden flex flex-col">
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
                {parsed.filter((p) => p._needsReview).length > 0 && (
                  <Badge variant="outline" className="text-rose-600 border-rose-500/30">
                    {parsed.filter((p) => p._needsReview).length} para revisar
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                {parsed.every((p) => p._selected) ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Regras de categorização</p>
                  <p className="text-xs text-muted-foreground">
                    Se a descrição contiver um termo, a categoria será aplicada automaticamente no import.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Label className="text-xs">Contém</Label>
                  <Input
                    value={newMatch}
                    onChange={(e) => setNewMatch(e.target.value)}
                    placeholder="ex: ifood, uber…"
                    className="h-9"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptionsAll.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <Button
                    type="button"
                    className="h-9 w-full"
                    variant="outline"
                    onClick={() => {
                      const match = newMatch.trim();
                      const categoria = newCategory.trim();
                      if (!match || !categoria) return;
                      setRules((prev) => [{ match, categoria }, ...prev]);
                      setNewMatch('');
                      setNewCategory('');
                      toast.success('Regra adicionada');
                    }}
                  >
                    Adicionar regra
                  </Button>
                </div>
              </div>

              {rules.length > 0 && (
                <div className="space-y-2">
                  {rules.slice(0, 8).map((r, idx) => (
                    <div key={`${r.match}-${r.categoria}-${idx}`} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                      <div className="text-xs">
                        <span className="text-muted-foreground">contém </span>
                        <span className="font-medium">{r.match}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">{r.categoria}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {rules.length > 8 && (
                    <p className="text-xs text-muted-foreground">Mostrando 8 de {rules.length} regras.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-1 min-h-0 gap-3">
              <div className="w-full sm:w-[42%] rounded-lg border flex flex-col min-h-0">
                <div className="p-3 border-b space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Filtro</Label>
                      <Select
                        value={reviewFilter}
                        onValueChange={(v) => {
                          if (v === 'needsReview' || v === 'all' || v === 'duplicates') {
                            setReviewFilter(v);
                          }
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="needsReview">Revisar</SelectItem>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="duplicates">Duplicadas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-[120px]">
                      <Label className="text-xs">Por página</Label>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                          setPageSize(Number(v) as 10 | 25 | 50);
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {filteredItems.length} itens • {groups.length} grupos
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        disabled={safePageIndex <= 0}
                      >
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {safePageIndex + 1}/{totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={safePageIndex >= totalPages - 1}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-2 space-y-1">
                    {pageGroups.map((g) => {
                      const active = selectedGroupKey === g.groupKey;
                      const allSelectedInGroup = g.items.length > 0 && g.selectedInGroup === g.items.length;
                      const someSelectedInGroup = g.selectedInGroup > 0 && !allSelectedInGroup;
                      const primaryTipo = g.items[0]?.tipo ?? 'Despesa';
                      return (
                        <button
                          key={g.groupKey}
                          type="button"
                          onClick={() => setSelectedGroupKey(g.groupKey)}
                          className={cn(
                            'w-full text-left rounded-md border px-2 py-2 transition-colors',
                            active ? 'border-primary/40 bg-primary/5' : 'border-muted/50 hover:bg-muted/30',
                            g.duplicatesInGroup > 0 && reviewFilter !== 'duplicates' && 'opacity-95'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={allSelectedInGroup}
                                  onCheckedChange={() => {
                                    const next = !allSelectedInGroup;
                                    updateMany(g.keys, { _selected: next });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {g.items.length}×
                                  {someSelectedInGroup ? ` (${g.selectedInGroup} selecionadas)` : ''}
                                </span>
                                {g.needsReviewInGroup > 0 && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-rose-500/30 text-rose-600">
                                    Revisar ({g.needsReviewInGroup})
                                  </Badge>
                                )}
                                {g.duplicatesInGroup > 0 && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500/30 text-amber-600">
                                    Duplicadas ({g.duplicatesInGroup})
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs font-medium mt-1 whitespace-normal break-words line-clamp-2 leading-snug">
                                {g.groupKey}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] h-5 px-1.5',
                                    primaryTipo === 'Receita'
                                      ? 'border-emerald-500/30 text-emerald-600'
                                      : 'border-rose-500/30 text-rose-600'
                                  )}
                                >
                                  {primaryTipo}
                                </Badge>
                                <span className={cn('text-xs font-semibold', g.amountSum >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                  {Math.abs(g.amountSum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                              {(() => {
                                const cats = Array.from(new Set(g.items.map((i) => (i.categoria || '').trim()).filter(Boolean)));
                                if (cats.length === 0) return '—';
                                if (cats.length === 1) return cats[0];
                                return `${cats.length} categorias`;
                              })()}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {pageGroups.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nada aqui.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex-1 rounded-lg border p-3 min-h-0">
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Ações em massa</p>
                        <p className="text-xs text-muted-foreground">
                          Aplica em todas as movimentações selecionadas (mesmo de grupos diferentes).
                        </p>
                      </div>
                      <Badge variant="secondary">{selectedItems.length} selecionadas</Badge>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 mt-3">
                      <div className="sm:col-span-1">
                        <Label className="text-xs">Categoria (massa)</Label>
                        <Select value={bulkCategory} onValueChange={setBulkCategory}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {bulkOptions.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedTipos.length > 1 && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Você selecionou múltiplos tipos ({selectedTipos.join(', ')}). Recomendo aplicar categoria por tipo.
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-1 flex items-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 flex-1"
                          disabled={selectedItems.length === 0 || !bulkCategory}
                          onClick={() => {
                            if (!bulkCategory) return;
                            updateMany(selectedItems.map((i) => i._key), { categoria: bulkCategory });
                            toast.success('Categoria aplicada nas selecionadas');
                          }}
                        >
                          Aplicar categoria
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          disabled={selectedItems.length === 0}
                          onClick={() => {
                            const missing = selectedItems.filter((i) => !(i.categoria || '').trim());
                            if (missing.length > 0) {
                              toast.error(`Há ${missing.length} item(ns) selecionado(s) sem categoria. Defina a categoria antes.`);
                              return;
                            }
                            updateMany(selectedItems.map((i) => i._key), { _needsReview: false });
                            toast.success('Selecionadas marcadas como revisadas');
                          }}
                        >
                          Marcar revisadas
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!selectedGroup ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                      Selecione um grupo na lista para editar/vincular por nome.
                    </div>
                  ) : (
                    <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold whitespace-normal break-words leading-snug">
                          {selectedGroup.groupKey}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedGroup.items.length} movimentação(ões) • {selectedGroup.selectedInGroup} selecionada(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedGroup.needsReviewInGroup > 0 && (
                          <Badge variant="outline" className="border-rose-500/30 text-rose-600">
                            Revisar ({selectedGroup.needsReviewInGroup})
                          </Badge>
                        )}
                        {selectedGroup.duplicatesInGroup > 0 && (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-600">
                            Duplicadas ({selectedGroup.duplicatesInGroup})
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border bg-muted/20">
                      <div className="px-3 py-2 border-b text-xs text-muted-foreground">
                        Itens do grupo
                      </div>
                      <ScrollArea className="max-h-40">
                        <div className="p-2 space-y-1">
                          {selectedGroup.items.map((it) => (
                            <div key={it._key} className="flex items-center justify-between gap-2 rounded-md border border-muted/40 bg-background px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Checkbox
                                  checked={it._selected}
                                  onCheckedChange={() => toggleItem(it._key)}
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{it.data}</span>
                                {it._needsReview && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-rose-500/30 text-rose-600">
                                    Revisar
                                  </Badge>
                                )}
                                {it._duplicate && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500/30 text-amber-600">
                                    Duplicada
                                  </Badge>
                                )}
                              </div>
                              <div className={cn('text-xs font-semibold whitespace-nowrap', it.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600')}>
                                {it.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <Label className="text-xs">Categoria</Label>
                        <Select
                          value={(() => {
                            const cats = Array.from(new Set(selectedGroup.items.map((i) => (i.categoria || '').trim()).filter(Boolean)));
                            return cats.length === 1 ? cats[0] : '';
                          })()}
                          onValueChange={(v) => updateMany(selectedGroup.keys, { categoria: v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar categoria (massa)" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const tipo = selectedGroup.items[0]?.tipo;
                              const opts =
                                tipo === 'Receita'
                                  ? (categoryOptionsByTipo.Receita.length > 0 ? categoryOptionsByTipo.Receita : categoryOptionsAll)
                                  : tipo === 'Despesa'
                                    ? (categoryOptionsByTipo.Despesa.length > 0 ? categoryOptionsByTipo.Despesa : categoryOptionsAll)
                                    : categoryOptionsAll;
                              return opts.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-1 flex items-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 flex-1"
                          onClick={() => {
                            const cats = Array.from(new Set(selectedGroup.items.map((i) => (i.categoria || '').trim()).filter(Boolean)));
                            const categoria = cats.length === 1 ? cats[0] : '';
                            if (!categoria) {
                              toast.error('Selecione uma categoria antes de marcar como revisada.');
                              return;
                            }
                            updateMany(selectedGroup.keys, { _needsReview: false });
                            toast.success('Grupo marcado como revisado');
                          }}
                        >
                          Marcar grupo como revisado
                        </Button>
                        <Button
                          type="button"
                          className="h-9"
                          variant="outline"
                          onClick={() => {
                            const cats = Array.from(new Set(selectedGroup.items.map((i) => (i.categoria || '').trim()).filter(Boolean)));
                            const categoria = cats.length === 1 ? cats[0] : '';
                            if (!categoria) {
                              toast.error('Selecione uma categoria para salvar o vínculo.');
                              return;
                            }
                            const match = `=${selectedGroup.groupKey.trim()}`;
                            setRules((prev) => [{ match, categoria }, ...prev]);
                            updateMany(selectedGroup.keys, { categoria, _needsReview: false });
                            toast.success('Vínculo salvo para futuras importações');
                          }}
                        >
                          Salvar vínculo
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                      Dica: “Salvar vínculo” cria uma regra EXATA pelo nome do grupo para preencher automaticamente nas próximas importações.
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} de {parsed.length} selecionadas
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button onClick={handleImport} disabled={importing || selectedCount === 0 || needsReviewCount > 0}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar {selectedCount > 0 && `(${selectedCount})`}
                </Button>
              </div>
            </div>
            {needsReviewCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertCircle className="h-4 w-4" />
                Há {needsReviewCount} item(ns) selecionado(s) marcado(s) para revisão.
              </div>
            )}
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
