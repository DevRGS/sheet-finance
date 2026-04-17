/**
 * Regra de categorização do import.
 * - match normal: faz "contains"
 * - match começando com "=": faz comparação EXATA (normalize) com a descrição completa
 */
export type ImportRule = { match: string; categoria: string };

export type CategorizeResult = {
  categoriaSugerida: string;
  confidence: number; // 0..1
  reason: string;
  needsReview: boolean;
};

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n));
}

export function categorizeTransaction(params: {
  description: string;
  tipo: 'Receita' | 'Despesa';
  amount: number;
  rules: ImportRule[];
  categories: string[];
}): CategorizeResult {
  const descriptionRaw = params.description || '';
  const description = norm(descriptionRaw);
  const categoriesSet = new Set(params.categories);

  const ruleHit = params.rules.find((r) => {
    const raw = (r.match || '').trim();
    if (!raw) return false;
    if (raw.startsWith('=')) {
      const exact = norm(raw.slice(1));
      return exact.length > 0 && description === exact;
    }
    const m = norm(raw);
    return m.length > 0 && description.includes(m);
  });
  if (ruleHit && categoriesSet.has(ruleHit.categoria)) {
    return {
      categoriaSugerida: ruleHit.categoria,
      confidence: 0.95,
      reason: `Regra: contém “${ruleHit.match}”`,
      needsReview: false,
    };
  }

  // Heurísticas básicas
  const heuristics: Array<{ categoria: string; confidence: number; reason: string; when: () => boolean }> = [
    {
      categoria: 'Alimentação',
      confidence: 0.8,
      reason: 'Heurística: mercado/refeição',
      when: () => includesAny(description, ['mercado', 'super', 'atac', 'carrefour', 'assai', 'atacadao', 'pao de acucar', 'restaurante', 'lanchonete', 'ifood', 'uber eats', 'rappi']),
    },
    {
      categoria: 'Transporte',
      confidence: 0.8,
      reason: 'Heurística: transporte/combustível',
      when: () => includesAny(description, ['uber', '99', 'posto', 'gasolina', 'etanol', 'diesel', 'combustivel', 'shell', 'ipiranga', 'ale', 'estacionamento', 'pedagio']),
    },
    {
      categoria: 'Saúde',
      confidence: 0.8,
      reason: 'Heurística: saúde/farmácia',
      when: () => includesAny(description, ['farmacia', 'drogaria', 'hospital', 'clinica', 'exame', 'laboratorio', 'medico', 'odont', 'droga raia', 'drogasil']),
    },
    {
      categoria: 'Moradia',
      confidence: 0.75,
      reason: 'Heurística: moradia/contas',
      when: () => includesAny(description, ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet', 'vivo', 'claro', 'tim', 'oi', 'sanepar', 'sabesp', 'copel', 'enel']),
    },
    {
      categoria: 'Educação',
      confidence: 0.75,
      reason: 'Heurística: educação',
      when: () => includesAny(description, ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'hotmart', 'mensalidade']),
    },
    {
      categoria: 'Lazer',
      confidence: 0.7,
      reason: 'Heurística: lazer/assinaturas',
      when: () => includesAny(description, ['netflix', 'spotify', 'prime', 'amazon prime', 'disney', 'hbo', 'cinema', 'show', 'ingresso', 'steam', 'psn', 'xbox']),
    },
    {
      categoria: 'Investimentos',
      confidence: 0.7,
      reason: 'Heurística: investimento',
      when: () => includesAny(description, ['tesouro', 'cdb', 'lc', 'lci', 'lca', 'fii', 'acao', 'corretora', 'xp', 'rico', 'nubank invest', 'inter investimentos']),
    },
    {
      categoria: 'Outros',
      confidence: 0.4,
      reason: 'Heurística: transferência/PIX (ambíguo)',
      when: () => includesAny(description, ['pix', 'ted', 'doc', 'transferencia', 'transf', 'pagamento', 'pgto']),
    },
  ];

  for (const h of heuristics) {
    if (h.when() && categoriesSet.has(h.categoria)) {
      const needsReview = h.confidence < 0.75;
      return { categoriaSugerida: h.categoria, confidence: h.confidence, reason: h.reason, needsReview };
    }
  }

  // Fallback
  const fallback = categoriesSet.has('Outros') ? 'Outros' : (params.categories[0] || '');
  return {
    categoriaSugerida: fallback,
    confidence: 0.0,
    reason: 'Sem match — revisar',
    needsReview: true,
  };
}

