# PROMPT — Varredura Completa do Sistema
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Versão:** 1.0 | **Branch:** `claude/bold-hamilton-a1Oj6`
**Escopo:** Funcionalidade · Segurança · Responsividade Mobile

---

## CRÍTICO 🔴 — Implementar TODOS antes de ir ao ar

---

### CRÍTICO #1 — XSS em exportação de PDF/HTML (Faltas.tsx)

**Arquivo:** `frontend/src/pages/Faltas.tsx`
**Funções afetadas:** `exportarPDF()`, `exportarFolhaOCR()`, `exportarDiario()`

**Problema:** Todas as 3 funções usam `win.document.write(html)` onde `html` contém nomes de alunos sem escape. Um nome como `<script>alert(1)</script>` executaria código no contexto da janela aberta.

**Correção:** Criar função `escapeHtml` e aplicar em TODO nome de aluno/turma/professora que vai para o HTML:

```typescript
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

**Onde aplicar:** Em CADA `${a.nome}`, `${turma.nome}`, `${turma.professora}`, `${escola}` que aparecem dentro de template strings de HTML. Buscar por `win.document.write` e sanitizar todos os campos de texto das 3 funções.

---

### CRÍTICO #2 — Ano hardcoded `2026` em OCR.tsx

**Arquivo:** `frontend/src/pages/OCR.tsx`
**Linha:** ~131

**Problema:**
```typescript
// ERRADO:
await api.upsertFaltasBatch([{ ..., ano: 2026 }]);
```

**Correção:**
1. Adicionar `import { useAno } from '../AnoContext'`
2. Adicionar `const { ano } = useAno()` no início do componente
3. Substituir `ano: 2026` por `ano`

---

### CRÍTICO #3 — Ano hardcoded `2026` em Professor.tsx

**Arquivo:** `frontend/src/pages/Professor.tsx`
**Linha:** ~131 (chamada `api.getFaltas(turmaId, mes, 2026)`)

**Problema:** Mesmo do OCR.tsx — ano fixo 2026.

**Correção:**
1. Adicionar `import { useAno } from '../AnoContext'`
2. Adicionar `const { ano } = useAno()` no início do componente
3. Substituir `2026` por `ano` em TODAS as ocorrências do arquivo

---

### CRÍTICO #4 — Google Vision API Key exposta na URL (Professor.tsx)

**Arquivo:** `frontend/src/pages/Professor.tsx`
**Linha:** ~190

**Problema:**
```typescript
// ERRADO — a chave fica visível no histórico do navegador, logs, proxies:
fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`)
```

A chave também está salva em plain text no `localStorage`, acessível por qualquer script no domínio.

**Correção no curto prazo:**
- Mover a chave para o corpo da requisição (POST body) em vez da URL query string:
```typescript
fetch(`https://vision.googleapis.com/v1/images:annotate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
  body: JSON.stringify({ ... })
})
```

**Correção definitiva (recomendada):** Criar uma função Edge no Supabase que faz a chamada ao Google Vision com a chave armazenada como variável de ambiente secreta. O frontend chama a função Edge, que chama o Google.

---

### CRÍTICO #5 — `clearAlunos()` apaga TODAS as faltas (Importar.tsx)

**Arquivo:** `frontend/src/pages/Importar.tsx`
**Linha:** ~829

**Problema:** Já documentado em PROMPT_CRUZAMENTO_FIX.md (Mudança #8). Toda reimportação apaga todos os registros de frequência. O usuário perde todos os lançamentos manuais.

**Ver:** `PROMPT_CRUZAMENTO_FIX.md` — Mudança 8 para detalhes completos da solução `smartUpsertAlunos`.

---

## MÉDIO 🟡 — Implementar na próxima sprint

---

### MÉDIO #1 — Distorcao.tsx: filtro com tautologia + calcIdade sem validação

**Arquivo:** `frontend/src/pages/Distorcao.tsx`

**Bug 1 — Filtro tautológico (linha ~55):**
```typescript
// ERRADO — includes('ATIVO') já cobre o último OR:
.filter(a => ['ATIVO', '', null, undefined].includes(a.situacao) || a.situacao === 'ATIVO')
```
```typescript
// CORRETO — inclui alunos sem situação definida + ATIVO:
.filter(a => !a.situacao || a.situacao === 'ATIVO')
```

**Bug 2 — calcIdade sem validação (linha ~8-17):**
```typescript
// ADICIONAR validação antes de processar:
function calcIdade(nasc: string, refDate: Date): number {
  if (!nasc || !/^\d{2}\/\d{2}\/\d{4}$/.test(nasc)) return -1;
  const [d, m, a] = nasc.split('/').map(Number);
  if (d < 1 || d > 31 || m < 1 || m > 12 || a < 1900) return -1;
  // ... resto da função
}
```

Alunos com `calcIdade === -1` devem ser exibidos em uma seção "Data de nascimento inválida" em vez de distorcerem as estatísticas.

**Bug 3 — Grid de estatísticas não responsivo (linha ~242):**
```typescript
// ERRADO:
gridTemplateColumns: 'repeat(4, 1fr)'
// CORRETO:
gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))'
```

---

### MÉDIO #2 — OCR.tsx: regex muito restritivo para nomes

**Arquivo:** `frontend/src/pages/OCR.tsx`

**Problema (linha ~36-41):** O regex para detectar nomes `[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ]` não inclui todos os caracteres acentuados possíveis em nomes brasileiros.

**Correção — ampliar o charset:**
```typescript
// ERRADO:
/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀ]/

// CORRETO — incluir todos os caracteres do português:
/^[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞa-záàâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]/
```

Ou ainda melhor, usar `\p{L}` com flag `u`:
```typescript
/^\p{L}/u
```

---

### MÉDIO #3 — Alunos.tsx / Faltas.tsx: busca sem debounce

**Arquivo:** `frontend/src/pages/Alunos.tsx` (linha ~202)

**Problema:** `setBusca(e.target.value)` filtra em cada keystroke. Com 1000+ alunos, causa lag.

**Correção — adicionar debounce:**
```typescript
import { useCallback } from 'react';

// Fora do componente ou em um hook:
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// No componente:
const [buscaInput, setBuscaInput] = useState('');
const busca = useDebounce(buscaInput, 200);

// Input:
<input value={buscaInput} onChange={e => setBuscaInput(e.target.value)} ... />
```

---

### MÉDIO #4 — styles.ts: DIAS_LETIVOS sem cobertura para 2028+

**Arquivo:** `frontend/src/styles.ts`

**Problema:** `DIAS_LETIVOS_ANO` só cobre até 2027. Em 2028, `getDiasLetivos(mes, 2028)` retorna valores de 2026.

**Correção — adicionar lógica de fallback inteligente:**
```typescript
export function getDiasLetivos(mes: number, ano: number): number {
  const anoData = DIAS_LETIVOS_ANO[ano] ?? DIAS_LETIVOS_ANO[2026];
  return anoData[mes] ?? 22;
}
```
E acrescentar os dados de 2028 quando disponíveis:
```typescript
const DIAS_LETIVOS_ANO: Record<number, Record<number, number>> = {
  2025: { ... },
  2026: { ... },
  2027: { ... },
  2028: { 2: 19, 3: 21, 4: 17, 5: 21, 6: 20, 7: 12, 8: 20, 9: 22, 10: 23, 11: 19, 12: 17 },
};
```

---

### MÉDIO #5 — Turmas.tsx: `readAsBinaryString()` deprecated

**Arquivo:** `frontend/src/pages/Turmas.tsx`
**Linha:** ~87

**Problema:** `readAsBinaryString()` está deprecated e pode não funcionar em navegadores futuros.

**Correção:**
```typescript
// ERRADO:
reader.readAsBinaryString(file);
reader.onload = (e) => {
  const wb = XLSX.read(e.target!.result, { type: 'binary' });
```

```typescript
// CORRETO:
reader.readAsArrayBuffer(file);
reader.onload = (e) => {
  const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
```

---

### MÉDIO #6 — ThemeContext: erro silencioso no localStorage

**Arquivo:** `frontend/src/ThemeContext.tsx`

**Problema:** Se `localStorage` está inacessível (modo privado, quota excedida), o código falha silenciosamente.

**Correção:**
```typescript
function safeGetStorage(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function safeSetStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch { /* quota exceeded — ignore */ }
}
```

---

## LEVE 🟢 — Responsividade Mobile

---

### LEVE #1 — Faltas.tsx: botões de ação não responsivos em mobile

**Arquivo:** `frontend/src/pages/Faltas.tsx`
**Local:** Bloco de botões (Exportar PDF, OCR, Salvar)

**Problema:** Em tela < 480px, os botões ficam apertados ou saem da tela.

**Correção:**
```typescript
const isMobile = window.innerWidth < 640;

// Container dos botões:
<div style={{
  display: 'flex',
  flexWrap: 'wrap',
  gap: isMobile ? 8 : 6,
  justifyContent: isMobile ? 'stretch' : 'flex-end',
}}>
  {/* Cada botão em mobile ocupa largura total: */}
  <button style={{
    ...btn('secondary'),
    flex: isMobile ? '1 1 100%' : '0 0 auto',
  }}>Exportar PDF</button>
  ...
</div>
```

---

### LEVE #2 — Alunos.tsx: grade de filtros não responsiva

**Arquivo:** `frontend/src/pages/Alunos.tsx`
**Local:** Grid de filtros (busca, turma, situação)

**Problema:** `gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'` em tela < 320px quebra.

**Correção:**
```typescript
const isMobile = window.innerWidth < 640;
<div style={{
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 8,
}}>
```

---

### LEVE #3 — Turmas.tsx: grid de importação não responsivo

**Arquivo:** `frontend/src/pages/Turmas.tsx`
**Local:** Grid da lista de turmas

**Problema:** `gridTemplateColumns: '24px 1fr 1fr 80px'` em celular fica muito apertado.

**Correção:**
```typescript
const isMobile = window.innerWidth < 640;
style={{
  gridTemplateColumns: isMobile
    ? '1fr 70px'          // mobile: apenas nome + botão
    : '24px 1fr 1fr 80px', // desktop: completo
}}
```
Em mobile, ocultar a coluna de professora ou exibi-la como subtítulo embaixo do nome.

---

### LEVE #4 — Distorcao.tsx: grid de estatísticas não responsivo

**Arquivo:** `frontend/src/pages/Distorcao.tsx`
**Linha:** ~242

**Problema:** `gridTemplateColumns: 'repeat(4, 1fr)'` → 4 colunas em tela < 400px ficam ilegíveis.

**Correção:**
```typescript
gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))'
```

---

### LEVE #5 — Pendentes.tsx: scrollbox muito pequeno em mobile

**Arquivo:** `frontend/src/pages/Pendentes.tsx`
**Linha:** ~157

**Problema:** `maxHeight: 400, overflowY: 'auto'` em tela pequena deixa o scrollbox muito comprimido.

**Correção:**
```typescript
const isMobile = window.innerWidth < 640;
maxHeight: isMobile ? '60vh' : 400,
```

---

### LEVE #6 — components.tsx: `EmptyState` action link fora do React Router

**Arquivo:** `frontend/src/components.tsx`
**Linha:** ~30

**Problema:** O componente `EmptyState` usa `<a href="/importar">` — um link HTML nativo. Isso causa recarregamento completo da página SPA.

**Correção:**
```typescript
import { useNavigate } from 'react-router-dom';

// No componente EmptyState:
const navigate = useNavigate();
<button onClick={() => navigate(action.href)} style={{ ... }}>
  {action.label}
</button>
```

---

## SEGURANÇA — Notas Adicionais

### Supabase RLS (Row Level Security)

O `SUPABASE_ANON_KEY` está presente no código-fonte (é esperado para o Supabase). **Porém**, se o RLS não estiver configurado no Supabase, qualquer pessoa com a chave ANON pode:
- Ler todos os alunos, turmas e faltas
- Deletar ou modificar dados via API REST direta

**Verificar no painel Supabase:**
1. Table Editor → Aluno → RLS → confirmar que está HABILITADO
2. Table Editor → Falta → RLS → confirmar que está HABILITADO
3. Table Editor → Turma → RLS → confirmar que está HABILITADO
4. Table Editor → Pendente → RLS → confirmar que está HABILITADO

**Policy mínima recomendada** (se o sistema for de acesso interno da escola):
```sql
-- Permite apenas acesso autenticado (via Supabase Auth)
ALTER TABLE "Aluno" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso autenticado" ON "Aluno"
  FOR ALL USING (auth.role() = 'authenticated');
```

Se não for usar autenticação (app interno simples), confirmar que a chave não está acessível publicamente via repositório GitHub público.

---

## ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

```
Prioridade 1 (CRÍTICO — antes do próximo uso em produção):
  [1] CRÍTICO #1  — escapeHtml em exportações PDF
  [2] CRÍTICO #2  — ano hardcoded OCR.tsx
  [3] CRÍTICO #3  — ano hardcoded Professor.tsx
  [4] CRÍTICO #5  — clearAlunos (ver PROMPT_CRUZAMENTO_FIX.md)

Prioridade 2 (CRÍTICO de segurança — médio prazo):
  [5] CRÍTICO #4  — API Key Google Vision no body, não na URL

Prioridade 3 (MÉDIO — próxima sprint):
  [6] MÉDIO #1    — Distorcao.tsx: filtro + validação idade
  [7] MÉDIO #2    — OCR.tsx: regex nome mais abrangente
  [8] MÉDIO #5    — Turmas.tsx: readAsBinaryString deprecated

Prioridade 4 (LEVE — quando houver tempo):
  [9]  LEVE #1-6  — Responsividade mobile
  [10] MÉDIO #3   — Debounce na busca
  [11] MÉDIO #4   — DIAS_LETIVOS para 2028+
  [12] MÉDIO #6   — ThemeContext: localStorage seguro
```

---

## ARQUIVOS MODIFICADOS NESTE PROMPT

| Arquivo | Mudanças |
|---|---|
| `frontend/src/pages/OCR.tsx` | Ano do contexto, regex de nome |
| `frontend/src/pages/Professor.tsx` | Ano do contexto, API key no body |
| `frontend/src/pages/Faltas.tsx` | escapeHtml em todas as exportações |
| `frontend/src/pages/Distorcao.tsx` | Filtro, validação de data, responsividade |
| `frontend/src/pages/Turmas.tsx` | readAsArrayBuffer |
| `frontend/src/pages/Alunos.tsx` | Debounce, responsividade |
| `frontend/src/pages/Pendentes.tsx` | maxHeight responsivo |
| `frontend/src/styles.ts` | DIAS_LETIVOS 2028+ |
| `frontend/src/ThemeContext.tsx` | localStorage seguro |
| `frontend/src/components.tsx` | EmptyState com useNavigate |

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*
