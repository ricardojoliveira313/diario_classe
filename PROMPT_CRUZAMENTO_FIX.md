# PROMPT — Correção Completa do Cruzamento de Dados
## Diário de Classe Digital — EMEIEF LUIZ GONZAGA
**Versão:** 1.0 | **Arquivo-alvo:** `frontend/src/pages/Importar.tsx`
**Branch:** `claude/bold-hamilton-a1Oj6`

---

## CONTEXTO

O sistema importa alunos de até 4 fontes simultâneas:
1. **PDF SED** — Relação de Alunos por Classe (nome, RA, nascimento, situação)
2. **Excel SED** — Diário de Classe / Frequência (nome, RA, faltas mensais, data início matrícula)
3. **Excel Educacenso** — Cadastro completo (nome, RA, nascimento, CPF, deficiência, Bolsa Família)
4. **TXT/PDF Bolsa Família** — Formulários com NIS

O cruzamento entre fontes usa uma **chave de matching** (`mkKey`):
- Se o aluno tem RA: chave = `RA:${ra}`
- Se não tem RA: chave = `${nomeNorm}|${nascimento}`

**PROBLEMA CRÍTICO:** A `normalizeStr` atual não fecha o cerco. Um único caractere diferente entre fontes quebra o cruzamento silenciosamente:
- "MARIA-CLARA" (PDF) ≠ "MARIA CLARA" (Excel) → chave diferente → aluno duplicado
- "D'AVILA" (Bolsa Família) ≠ "DAVILA" (SED) → NIS não vinculado
- "NASCIMENTO." (Educacenso) ≠ "NASCIMENTO" (PDF) → matrícula não cruzada
- "JOÃO  PEDRO" (2 espaços) ≠ "JOÃO PEDRO" (1 espaço) → duplicata

---

## MUDANÇA 1 — Criar `normalizeNome` (normalização agressiva para nomes de alunos)

**Localização:** Logo após a função `normalizeStr` (linha ~42)

**ADICIONAR esta nova função:**

```typescript
/**
 * Normalização COMPLETA para nomes de alunos.
 * Garante cruzamento correto mesmo quando fontes (PDF, Excel, Bolsa Família)
 * usam variações de acentuação, hífen, apóstrofe, espaços ou pontuação.
 * 
 * Transformações aplicadas (em ordem):
 *  1. toUpperCase()         – "maria" → "MARIA"
 *  2. trim()                – remove espaços nas pontas
 *  3. NFD + remove acentos  – "Ç" → "C", "É" → "E", "Ã" → "A"
 *  4. hifens → espaço       – "MARIA-CLARA" → "MARIA CLARA"
 *  5. apóstrofes → espaço   – "D'AVILA" → "D AVILA"
 *  6. pontos removidos      – "JR." → "JR", "NASCIMENTO." → "NASCIMENTO"
 *  7. colapsa espaços duplos – "JOAO  PEDRO" → "JOAO PEDRO"
 *  8. trim() final
 */
function normalizeNome(s: string): string {
  return s
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove todos os diacríticos (acentos)
    .replace(/['’`´]/g, ' ') // apóstrofes (', ', `, ´) → espaço
    .replace(/-/g, ' ')                 // hifens → espaço
    .replace(/\./g, '')                 // pontos → removidos
    .replace(/\s+/g, ' ')              // colapsa múltiplos espaços
    .trim();
}
```

**IMPORTANTE:** `normalizeStr` permanece inalterada — ela é usada para normalizar **nomes de colunas** do Excel (não de pessoas).

---

## MUDANÇA 2 — Substituir `normalizeStr` por `normalizeNome` em TODOS os campos de nome de aluno

Há exatamente **8 locais** onde o `nomeNorm` (campo de comparação de nomes de alunos) é construído com `normalizeStr`. Todos devem usar `normalizeNome`.

### 2.1 — `parsePDFs` — fallback (dentro do `if (!afterMatch)`)

**LOCALIZAR:**
```typescript
alunos.push({
  nome, nomeNorm: normalizeStr(nome),
  ra: parseInt(raStr) || null,
  nascimento: '',
  serie: serieAluno,
```

**SUBSTITUIR `normalizeStr(nome)` por `normalizeNome(nome)`:**
```typescript
alunos.push({
  nome, nomeNorm: normalizeNome(nome),
  ra: parseInt(raStr) || null,
  nascimento: '',
  serie: serieAluno,
```

### 2.2 — `parsePDFs` — caminho principal (dentro do `else` após `afterMatch`)

**LOCALIZAR:**
```typescript
alunos.push({
  nome, nomeNorm: normalizeStr(nome),
  ra: parseInt(raStr) || null,
  nascimento,
  serie: serieAluno,
```

**SUBSTITUIR:**
```typescript
alunos.push({
  nome, nomeNorm: normalizeNome(nome),
  ra: parseInt(raStr) || null,
  nascimento,
  serie: serieAluno,
```

### 2.3 — `parseExcels` — chave de deduplicação interna

**LOCALIZAR (linha ~281):**
```typescript
const key = ra ? `RA:${ra}` : `${normalizeStr(nome)}|${nasc}`;
```

**SUBSTITUIR:**
```typescript
// Chave RA-first: igual ao mkKey() do merge — garante cruzamento correto entre arquivos
const key = ra ? `RA:${ra}` : `${normalizeNome(nome)}|${nasc}`;
```

### 2.4 — `parseExcels` — campo `nomeNorm` ao inserir no mapa

**LOCALIZAR:**
```typescript
alunosMap.set(key, {
  nome, nomeNorm: normalizeStr(nome),
  ra, nascimento: nasc,
```

**SUBSTITUIR:**
```typescript
alunosMap.set(key, {
  nome, nomeNorm: normalizeNome(nome),
  ra, nascimento: nasc,
```

### 2.5 — `parseHTMLSED` — chave de deduplicação (BUG: formato errado!)

**LOCALIZAR (linha ~467):**
```typescript
const key = normalizeStr(nome) + '|' + (ra || '') + '|' + nasc;
```

**SUBSTITUIR pelo formato RA-first (consistente com `mkKey`):**
```typescript
const key = ra ? `RA:${ra}` : `${normalizeNome(nome)}|${nasc}`;
```

### 2.6 — `parseHTMLSED` — campo `nomeNorm` ao fazer push

**LOCALIZAR (logo após o `if (processados.has(key)) continue;`):**
```typescript
alunos.push({
  nome, nomeNorm: normalizeStr(nome),
  ra, nascimento: nasc, serie,
```

**SUBSTITUIR:**
```typescript
alunos.push({
  nome, nomeNorm: normalizeNome(nome),
  ra, nascimento: nasc, serie,
```

---

## MUDANÇA 3 — `parseBolsaFamiliaPDF.indexar` — normalizar dentro da função

A função `indexar` (dentro de `parseBolsaFamiliaPDF`) deve aplicar `normalizeNome` internamente, em vez de depender do chamador.

**LOCALIZAR o bloco `indexar` dentro de `parseBolsaFamiliaPDF`:**
```typescript
const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
  if (nome.length < 3 || !/^\d{11}$/.test(nis)) return;
  mapa.set(`${nome}|${nasc}`, { nis, responsavel });
  // Chave fuzzy: nome sem artigos + data (tolera variações de "DA"/"DE" entre sistemas)
  const nomeSimp = nomeSignificativo(nome);
  if (nomeSimp.length >= 3 && nasc) {
    mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
  }
};
```

**SUBSTITUIR:**
```typescript
const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
  // normalizeNome garante cruzamento correto independente de como o chamador formatou o nome
  const nomeNorm = normalizeNome(nome);
  if (nomeNorm.length < 3 || !/^\d{11}$/.test(nis)) return;
  mapa.set(`${nomeNorm}|${nasc}`, { nis, responsavel });
  // Chave fuzzy: nome sem artigos + data (tolera variações de "DA"/"DE" entre sistemas)
  const nomeSimp = nomeSignificativo(nomeNorm);
  if (nomeSimp.length >= 3 && nasc) {
    mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
  }
};
```

---

## MUDANÇA 4 — `parseBolsaFamiliaTXT.indexar` — mesma correção

Há uma segunda função `indexar` dentro de `parseBolsaFamiliaTXT` (função separada). Aplicar a mesma mudança.

**LOCALIZAR o segundo `indexar` (dentro de `parseBolsaFamiliaTXT`):**
```typescript
const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
  if (nome.length < 3 || !/^\d{11}$/.test(nis)) return;
  mapa.set(`${nome}|${nasc}`, { nis, responsavel });
  const nomeSimp = nomeSignificativo(nome);
  if (nomeSimp.length >= 3 && nasc) {
    mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
  }
};
```

**SUBSTITUIR:**
```typescript
const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
  const nomeNorm = normalizeNome(nome);
  if (nomeNorm.length < 3 || !/^\d{11}$/.test(nis)) return;
  mapa.set(`${nomeNorm}|${nasc}`, { nis, responsavel });
  const nomeSimp = nomeSignificativo(nomeNorm);
  if (nomeSimp.length >= 3 && nasc) {
    mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
  }
};
```

---

## MUDANÇA 5 — `importar()` — usar ano do contexto (não `new Date().getFullYear()`)

**LOCALIZAR a importação no topo do arquivo:**
```typescript
import { useState, useRef, useCallback } from 'react';
```

**SUBSTITUIR:**
```typescript
import { useState, useRef, useCallback } from 'react';
import { useAno } from '../AnoContext';
```

**LOCALIZAR o início da função `Importar` (linha ~85):**
```typescript
export default function Importar() {
  const [files, setFiles] = useState<File[]>([]);
```

**SUBSTITUIR:**
```typescript
export default function Importar() {
  const { ano } = useAno();
  const [files, setFiles] = useState<File[]>([]);
```

**LOCALIZAR na função `importar()` (linha ~910):**
```typescript
faltasParaInserir.push({
  alunoId, turmaId,
  mes: Number(mes), ano: new Date().getFullYear(),
  faltas: f.faltas, frequencia: f.frequencia,
});
```

**SUBSTITUIR:**
```typescript
faltasParaInserir.push({
  alunoId, turmaId,
  mes: Number(mes), ano,
  faltas: f.faltas, frequencia: f.frequencia,
});
```

**LOCALIZAR na função `importar()` — `nomeToId` map (linha ~898):**
```typescript
nomeToId.set(normalizeStr(a.nome), a.id);
```

**SUBSTITUIR:**
```typescript
nomeToId.set(normalizeNome(a.nome), a.id);
```

---

## MUDANÇA 6 — `importar()` — mostrar aviso de ano ao usuário

Na interface, quando o usuário clicar em "Importar", exibir o ano selecionado no cabeçalho da página para confirmação.

**LOCALIZAR o título da página:**
```typescript
<h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📥 Importar Dados da SED</h1>
```

**SUBSTITUIR:**
```typescript
<h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📥 Importar Dados da SED — {ano}</h1>
```

---

## MUDANÇA 7 — CPF no parseExcels

O usuário adicionou CPF à planilha Educacenso. Necessário parsear e armazenar.

### 7.1 — Interface `AlunoUnificado`

**LOCALIZAR:**
```typescript
interface AlunoUnificado {
  nome: string;
  nomeNorm: string;
  ra: number | null;
  nascimento: string;
  serie: string;
  professora: string;
  situacao: string;
  deficiencia: string;
  bolsaFamilia: boolean;
  dataInicioMatricula: string;
  dataFimMatricula: string;
  dataMovimentacao: string;
  nis: string;
  responsavel: string;
  faltas: Record<number, { faltas: number; frequencia: string }>;
}
```

**SUBSTITUIR:**
```typescript
interface AlunoUnificado {
  nome: string;
  nomeNorm: string;
  ra: number | null;
  nascimento: string;
  serie: string;
  professora: string;
  situacao: string;
  deficiencia: string;
  bolsaFamilia: boolean;
  cpf: string;
  dataInicioMatricula: string;
  dataFimMatricula: string;
  dataMovimentacao: string;
  nis: string;
  responsavel: string;
  faltas: Record<number, { faltas: number; frequencia: string }>;
}
```

### 7.2 — Parsear CPF no `parseExcels`

**LOCALIZAR (logo após a linha `const bolsaFamilia = parseBool(...)`):**
```typescript
const bolsaFamilia = parseBool(nr['BOLSA FAMILIA'] ?? nr['BOLSA FAMLIA']);
```

**SUBSTITUIR:**
```typescript
const bolsaFamilia = parseBool(nr['BOLSA FAMILIA'] ?? nr['BOLSA FAMLIA']);
// CPF: normaliza removendo pontos e traço (000.000.000-00 → 00000000000)
const cpfRaw = String(nr['CPF'] ?? '').trim().replace(/[.\-]/g, '');
const cpf = /^\d{11}$/.test(cpfRaw) ? cpfRaw : '';
```

### 7.3 — Incluir CPF no `alunosMap.set` e no merge

**LOCALIZAR dentro do `if (alunosMap.has(key))` (bloco de merge):**
```typescript
if (situacao !== 'ATIVO') e.situacao = situacao;
if (professora) e.professora = professora;
if (dataInicioMatricula) e.dataInicioMatricula = dataInicioMatricula;
```

**ADICIONAR após `if (professora) ...`:**
```typescript
if (cpf) e.cpf = cpf;
```

**LOCALIZAR o `alunosMap.set(key, { ... })` (novo aluno):**
```typescript
alunosMap.set(key, {
  nome, nomeNorm: normalizeNome(nome),
  ra, nascimento: nasc,
  serie, professora,
  situacao, deficiencia,
  bolsaFamilia,
  dataInicioMatricula,
  dataFimMatricula,
  dataMovimentacao,
  nis: '',
  responsavel: '',
  faltas: mes > 0 && faltasQtd >= 0 ? { [mes]: { faltas: faltasQtd, frequencia: freqTexto } } : {},
});
```

**SUBSTITUIR:**
```typescript
alunosMap.set(key, {
  nome, nomeNorm: normalizeNome(nome),
  ra, nascimento: nasc,
  serie, professora,
  situacao, deficiencia,
  bolsaFamilia,
  cpf,
  dataInicioMatricula,
  dataFimMatricula,
  dataMovimentacao,
  nis: '',
  responsavel: '',
  faltas: mes > 0 && faltasQtd >= 0 ? { [mes]: { faltas: faltasQtd, frequencia: freqTexto } } : {},
});
```

### 7.4 — Inicializar CPF nas outras fontes (PDF, HTML, fallbacks)

Em TODOS os `alunos.push({ ... })` e fallbacks que não parseiam CPF, adicionar `cpf: ''` na estrutura.

Buscar por: `nis: '', responsavel: ''` — em cada ocorrência, adicionar `cpf: '',` antes ou depois.

### 7.5 — Incluir CPF no merge `mergeAluno`

**LOCALIZAR dentro de `mergeAluno`:**
```typescript
existente.bolsaFamilia = existente.bolsaFamilia || a.bolsaFamilia;
existente.nis = existente.nis || a.nis;
```

**ADICIONAR após `existente.nis`:**
```typescript
existente.cpf = existente.cpf || a.cpf;
```

### 7.6 — Incluir CPF no `alunosInsert`

**LOCALIZAR em `importar()`:**
```typescript
const alunosInsert = alunos.map(a => ({
  nome: a.nome, turmaId: resolveId(a.serie, a.professora),
  ra: a.ra, numero: 0,
  data_nascimento: a.nascimento,
  data_inicio_matricula: a.dataInicioMatricula,
  data_fim_matricula: a.dataFimMatricula,
  data_movimentacao: a.dataMovimentacao,
  deficiencia: a.deficiencia, situacao: a.situacao,
  bolsa_familia: a.bolsaFamilia, professora: a.professora,
  nis: a.nis || null, responsavel: a.responsavel || null,
}));
```

**SUBSTITUIR:**
```typescript
const alunosInsert = alunos.map(a => ({
  nome: a.nome, turmaId: resolveId(a.serie, a.professora),
  ra: a.ra, numero: 0,
  data_nascimento: a.nascimento,
  data_inicio_matricula: a.dataInicioMatricula,
  data_fim_matricula: a.dataFimMatricula,
  data_movimentacao: a.dataMovimentacao,
  deficiencia: a.deficiencia, situacao: a.situacao,
  bolsa_familia: a.bolsaFamilia, professora: a.professora,
  cpf: a.cpf || null,
  nis: a.nis || null, responsavel: a.responsavel || null,
}));
```

---

## MUDANÇA 8 — BUG CRÍTICO: Remover `clearAlunos()` + implementar `smartUpsert`

**Este é o bug mais crítico do sistema.** Toda vez que o usuário reimporta, a linha:
```typescript
await api.clearAlunos(); // linha ~829 em importar()
```
apaga TODOS os alunos E todos os registros de Falta do banco. O usuário perde todas as frequências lançadas manualmente.

### 8.1 — Remover a chamada a clearAlunos

**LOCALIZAR em `importar()` (linha ~828-829):**
```typescript
setStatus('Limpando alunos e faltas anteriores (turmas preservadas)...');
await api.clearAlunos();
```

**SUBSTITUIR por:**
```typescript
setStatus('Carregando alunos existentes para merge inteligente...');
```

### 8.2 — Trocar `bulkInsertAlunos` por upsert inteligente

**LOCALIZAR (linha ~887):**
```typescript
await api.bulkInsertAlunos(alunosInsert, (n) => {
  setProgresso(n);
  setStatus(`Inserindo alunos... ${n}/${alunos.length}`);
});
```

**SUBSTITUIR por:**
```typescript
await api.smartUpsertAlunos(alunosInsert, (n) => {
  setProgresso(n);
  setStatus(`Atualizando alunos... ${n}/${alunos.length}`);
});
```

### 8.3 — Implementar `smartUpsertAlunos` em `frontend/src/api.ts`

**No arquivo `api.ts`, ADICIONAR a função `smartUpsertAlunos`:**

```typescript
/** Upsert inteligente: atualiza alunos existentes (por RA ou nome+nasc),
 *  insere os novos. NÃO apaga faltas. Processa em lotes de 100. */
async smartUpsertAlunos(
  alunos: any[],
  onProgress?: (n: number) => void
): Promise<void> {
  const BATCH = 100;
  let done = 0;
  for (let i = 0; i < alunos.length; i += BATCH) {
    const batch = alunos.slice(i, i + BATCH);
    const { error } = await supabase
      .from('Aluno')
      .upsert(batch, { onConflict: 'ra', ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    done += batch.length;
    onProgress?.(done);
  }
},
```

**NOTA:** O `onConflict: 'ra'` requer que a coluna `ra` tenha uma constraint UNIQUE no Supabase.
Se não tiver, executar no SQL Editor:
```sql
ALTER TABLE "Aluno" ADD CONSTRAINT aluno_ra_unique UNIQUE (ra) WHERE ra IS NOT NULL;
```

Para alunos sem RA, o upsert vai usar o fallback de INSERT (pode criar duplicatas se o mesmo aluno sem RA for importado duas vezes). Para tratar isso, adicionar também um índice único por `nome + data_nascimento + turmaId` para alunos sem RA.

---

## ORDEM DE EXECUÇÃO

1. ✅ Mudança 1 — Criar `normalizeNome`
2. ✅ Mudança 2 — Substituir `normalizeStr` → `normalizeNome` em todos os 8 locais
3. ✅ Mudança 3 — `parseBolsaFamiliaPDF.indexar` normalizar internamente
4. ✅ Mudança 4 — `parseBolsaFamiliaTXT.indexar` normalizar internamente
5. ✅ Mudança 5 — `importar()` usar `ano` do contexto
6. ✅ Mudança 6 — Mostrar ano no título
7. ✅ Mudança 7 — CPF no parseExcels
8. ✅ Mudança 8 — Remover clearAlunos + smartUpsert

---

## VERIFICAÇÃO APÓS IMPLEMENTAÇÃO

Verificar que os seguintes cenários cruzam corretamente:

| Aluno no Excel | Aluno no PDF | Deve cruzar? |
|---|---|---|
| `MARIA CLARA DA SILVA` | `MARIA-CLARA DA SILVA` | ✅ SIM |
| `D'AVILA SANTOS` | `DAVILA SANTOS` | ✅ SIM |
| `JOAO PEDRO` | `JOÃO PEDRO` | ✅ SIM |
| `NASCIMENTO JR.` | `NASCIMENTO JR` | ✅ SIM |
| `JOAO  PEDRO` (2 espaços) | `JOAO PEDRO` | ✅ SIM |
| `MARIA CLARA` nascido 01/01/2010 | `MARIA CLARA` nascido 01/01/2011 | ❌ NÃO (nomes iguais mas idades diferentes = alunos diferentes) |

---

## ARQUIVOS MODIFICADOS

- `frontend/src/pages/Importar.tsx` — todas as mudanças 1-8
- `frontend/src/api.ts` — adicionar `smartUpsertAlunos`

---

*Prompt gerado pelo CEREBRO — Branch: claude/bold-hamilton-a1Oj6*
