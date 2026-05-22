# PROMPT COMPLETO — DIÁRIO DE CLASSE DIGITAL
## EMEIEF LUIZ GONZAGA — Sistema de Gestão de Frequência Escolar

> **VOCÊ É O EXECUTOR.** Este documento é o cérebro da operação.
> Leia tudo antes de tocar em qualquer arquivo. Siga exatamente o que está aqui.
> Cada bug tem diagnóstico, localização de linha e correção especificada.

---

## 1. VISÃO GERAL DO PROJETO

**Nome:** Diário de Classe Digital  
**Escola:** EMEIEF LUIZ GONZAGA, Santo André – SP  
**Responsável:** Ricardo (ricardodeoliveiraj@gmail.com)  
**URL Produção:** https://diario.jroapp.com.br  
**Repositório:** https://github.com/ricardojoliveira313/diario_classe  
**Branch de desenvolvimento:** `claude/bold-hamilton-a1Oj6`  

### O que o sistema faz
Sistema web SPA para substituir o Diário de Classe físico. Importa dados da SED (Secretaria Escolar Digital do Estado de SP) via Excel/PDF, armazena em nuvem (Supabase/PostgreSQL) e permite:
- Visualizar alunos por turma com situação, faltas, deficiência, Bolsa Família
- Lançar faltas manualmente (por toque, mobile-first) ou via foto com OCR
- Exportar diário imprimível e folha de OCR
- Ver dashboard de frequência e distorção série-idade
- Monitorar Bolsa Família (frequência mínima)
- Aprovar registros de OCR pendentes

---

## 2. STACK TÉCNICA

```
Frontend:   React 18 + TypeScript + Vite
Styling:    Inline styles + CSS variables (sem CSS-in-JS externo)
Excel:      SheetJS (xlsx)
PDF:        pdfjs-dist 4.0.379
OCR:        Tesseract.js (local) + Google Vision API (cloud)
Backend:    Supabase (PostgreSQL) — sem servidor próprio
Deploy:     Render.com (static site)
Domínio:    diario.jroapp.com.br → Render via CNAME em Registro.br
```

---

## 3. BANCO DE DADOS — SUPABASE

**URL:** `https://hxmwpleyhagwcukuhzxg.supabase.co`  
**Chave anon:** já configurada em `frontend/src/api.ts`

### Tabelas

#### `Turma`
```sql
id           UUID PRIMARY KEY DEFAULT uuid_generate_v4()
nome         TEXT NOT NULL          -- Ex: "1ª ETAPA PRÉ-ESCOLA A"
professora   TEXT                   -- Ex: "MARIA LUCIA SOUZA"
periodo      TEXT                   -- "MANHÃ", "TARDE", etc.
created_at   TIMESTAMPTZ DEFAULT NOW()
```

#### `Aluno`
```sql
id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4()
turmaId               UUID REFERENCES Turma(id)
nome                  TEXT NOT NULL
ra                    TEXT                        -- RA SED formato 000XXXXXXXXX
numero                INTEGER DEFAULT 0           -- Nº de chamada
data_nascimento       TEXT                        -- formato DD/MM/AAAA
data_inicio_matricula TEXT                        -- formato DD/MM/AAAA
data_fim_matricula    TEXT                        -- formato DD/MM/AAAA
data_movimentacao     TEXT                        -- formato DD/MM/AAAA
situacao              TEXT DEFAULT 'ATIVO'        -- ATIVO, REMA, TRAN, BXTR, N COM, ABAN
deficiencia           TEXT
bolsa_familia         BOOLEAN DEFAULT FALSE
professora            TEXT
nis                   TEXT
responsavel           TEXT
created_at            TIMESTAMPTZ DEFAULT NOW()
```

#### `Falta`
```sql
id          UUID PRIMARY KEY DEFAULT uuid_generate_v4()
alunoId     UUID REFERENCES Aluno(id)
turmaId     UUID REFERENCES Turma(id)
mes         INTEGER NOT NULL    -- 1=Jan, 2=Fev, ... 12=Dez
ano         INTEGER NOT NULL    -- Ex: 2026
faltas      INTEGER DEFAULT 0
frequencia  TEXT               -- texto livre ("95%", "Ótimo", etc.)
created_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE(alunoId, mes, ano)
```

#### `Pendente`
```sql
id               UUID PRIMARY KEY DEFAULT uuid_generate_v4()
turmaId          UUID REFERENCES Turma(id)
mes              INTEGER
ano              INTEGER
dados            JSONB          -- array de registros OCR reconhecidos
total_entradas   INTEGER
total_problemas  INTEGER
status           TEXT DEFAULT 'pendente'   -- 'pendente', 'aprovado', 'rejeitado'
created_at       TIMESTAMPTZ DEFAULT NOW()
```

---

## 4. ESTRUTURA DE ARQUIVOS

```
diario_classe/
├── frontend/
│   ├── index.html              ← CSS variables dark/light mode
│   ├── src/
│   │   ├── main.tsx            ← Entry point
│   │   ├── App.tsx             ← Router + sidebar + ThemeContext + AnoContext
│   │   ├── api.ts              ← Todas as chamadas Supabase
│   │   ├── styles.ts           ← theme object + utilitários btn(), card()
│   │   ├── components.tsx      ← Spinner, Loading, EmptyState, StatCard, etc.
│   │   ├── ThemeContext.tsx     ← useTheme() hook — isDark, toggleTheme
│   │   ├── AnoContext.tsx      ← useAno() hook — ano letivo selecionado
│   │   └── pages/
│   │       ├── Dashboard.tsx   ← Visão geral por turma
│   │       ├── Turmas.tsx      ← CRUD de turmas e professoras
│   │       ├── Alunos.tsx      ← Lista/detalhe/edição de alunos por turma
│   │       ├── Faltas.tsx      ← Grade de faltas + exportação diário/excel
│   │       ├── Professor.tsx   ← Lançamento mobile (manual +/- ou foto OCR)
│   │       ├── Importar.tsx    ← Parser SED (Excel + PDF) + importação DB
│   │       ├── Pendentes.tsx   ← Revisão de OCR pendentes
│   │       ├── Distorcao.tsx   ← Relatório distorção série-idade
│   │       └── BolsaFamilia.tsx← Monitoramento frequência BF
```

---

## 5. CONTEXTO E TEMA (DARK MODE)

### CSS Variables — `frontend/index.html`

O sistema usa variáveis CSS no `:root` para light mode e `[data-theme="dark"]` para dark. **NUNCA use cores hardcoded em elementos de lista/tabela/fundo — use sempre as variáveis.**

```css
:root {
  --row-even: #ffffff;
  --row-odd: #f8fafc;
  --row-alerta: #fef3c7;
  --footer-row: #f8fafc;
  --edit-bg: #fffbeb;
  --edit-border: #fbbf24;
  --ghost-bg: #ffffff;
  --primary-text: #1e40af;   /* Azul adaptativo — use para texto azul */
  --card: #ffffff;
}
[data-theme="dark"] {
  --row-even: #1e293b;
  --row-odd: #0f172a;
  --row-alerta: #451a03;
  --footer-row: #0f172a;
  --edit-bg: #1c1917;
  --edit-border: #92400e;
  --ghost-bg: #1e293b;
  --primary-text: #60a5fa;   /* Azul claro em dark mode */
  --card: #1e293b;
}
```

### `theme` object — `frontend/src/styles.ts`

```typescript
export const theme = {
  primary: '#1e40af',          // Para BACKGROUNDS de botão azul (branco em cima = OK)
  primaryText: 'var(--primary-text)', // Para TEXTO azul sobre fundo (adapta ao dark)
  primaryBg: '#eff6ff',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  card: 'var(--card)',
  bg: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  radius: '6px',
  radiusMd: '12px',
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  success: '#16a34a',
  successLight: '#f0fdf4',
  successHover: '#15803d',
  warning: '#d97706',
  warningLight: '#fffbeb',
  orange: '#ea580c',
  sky: '#0ea5e9',
}
```

**REGRA DE OURO:**
- `color: theme.primary` → ERRADO para texto sobre fundo branco/dark (azul escuro invisível em dark)
- `color: theme.primaryText` → CORRETO para qualquer texto azul

---

## 6. FUNCIONALIDADES IMPLEMENTADAS (estado atual)

### ✅ Dashboard (`/`)
- Cards com totais: alunos ativos, turmas, faltas no mês atual
- Tabela por turma com % de frequência e contagem de Bolsa Família
- Filtro por ano letivo (AnoContext)

### ✅ Turmas (`/turmas`)
- CRUD completo de turmas (nome + professora)
- Listagem com cards e ações editar/excluir
- Cor do nome da professora: usa `theme.primaryText` (não `theme.primary`)

### ✅ Alunos (`/alunos`)
- Lista paginada por turma com filtros (situação, busca por nome)
- Detalhe expansível: nome, RA, nascimento, situação, deficiência, BF
- Campo `data_inicio_matricula` SEMPRE exibido — se null, mostra ⚠️ "não informado — clique em ✏️ Situação para preencher"
- Campo `data_fim_matricula` SEMPRE exibido — mesma regra
- Edição inline de situação + datas de matrícula
- Fundos adaptativos: `var(--footer-row)`, `var(--edit-bg)`, `var(--edit-border)`

### ✅ Faltas (`/faltas`)
- Grade mensal: linha por aluno, coluna por dia (D1..D22)
- Células P/F/J/A com cores adaptativas para dark mode (via `useTheme()`)
- Exportação:
  - `📋 Folha` — folha A4 retrato simples: Nº | Nome | [F box] | [J box] para OCR
  - `🖨️ Diário` — grade completa com TODOS os dias do mês, fins de semana em verde
  - `📊 Excel` — exporta planilha completa
  - `📄 PDF` — exporta PDF via window.print()
- Alerta de frequência < 75% (fundo âmbar)
- Cor do nome do aluno: usa `color: theme.text` (não padrão)

### ✅ Professor (`/professor`)
- **Modo Manual:** +/- 38px touch targets por aluno, salva direto no Supabase
  - Carrega alunos da turma + faltas existentes do mês (não sobrescreve)
  - Botão "💾 Salvar" usa `api.upsertFaltasBatch()`
- **Modo Foto/OCR:** Google Vision API para leitura de folha OCR
  - Upload de foto → chama Vision API → reconhece nomes + marcações
  - Resultado vai para `Pendente` no banco para revisão na tela Pendentes
- Toggle entre modos: `✏️ Digitar` | `📷 Via Foto`

### ✅ Importar (`/importar`)
- Aceita múltiplos arquivos: .xlsx, .xls, .pdf, .txt
- Parsers:
  - **PDF SED "Relação de Alunos por Classe"**: extrai RA (12 dígitos), nome, nascimento, situação, turma, professora via regex
  - **Excel "Diário de Classe" SED**: extrai alunos + frequência por mês
  - **Excel "Turmas-Professores"**: extrai mapa turma → professora
  - **TXT Bolsa Família**: extrai NIS + responsável
- Normalização de nomes de turmas SED (aliases EJA, prefixos)
- Matching aluno por: RA → nome normalizado
- Preview antes de confirmar: stats de turmas, alunos, faltas reconhecidas
- **PROBLEMA CRÍTICO:** `clearAlunos()` apaga TODO o histórico de faltas a cada reimportação (ver Bug #2 abaixo)

### ✅ Pendentes (`/pendentes`)
- Lista de OCR pendentes de revisão
- Aprovação/rejeição com confirmação
- Contagem no sidebar

### ✅ Distorção (`/distorcao`)
- Cálculo de distorção série-idade por aluno
- Filtra por turma, agrupa por distorção

### ✅ Bolsa Família (`/bolsafamilia`)
- Lista alunos beneficiários com frequência atual
- Alerta quando < 85% (limite para manutenção do benefício)

### ✅ Dark Mode
- Toggle no header
- Persiste via localStorage
- Todas as telas adaptadas

---

## 7. BUGS CRÍTICOS A CORRIGIR — ESPECIFICAÇÃO EXATA

---

### 🔴 BUG #1 — `data_fim_matricula` não capturada do Excel SED

**Sintoma:**  
Aluno tem "Dt Início Matrícula: 04/02/2026" e "Dt Fim Matrícula: 18/12/2026" no SED web, mas no Diário de Classe aparece "não informado" para ambas as datas.

**Caso real:** Aluna ALANNA EMANUELLY FERREIRA DE SOUZA, RA 000123981657, turma 1ª ETAPA PRÉ-ESCOLA A, professora Maria Lúcia, situação Ativo, ano 2026.

**Diagnóstico:**  
O parser do Excel (`frontend/src/pages/Importar.tsx`) normaliza os nomes das colunas com `normalizeStr()` (remove acentos, converte para maiúsculas). A coluna SED "Dt Fim Matrícula" vira "DT FIM MATRICULA". Mas o código só testa `nr['DATA FIM MATRICULA']` — que NÃO bate. O campo `dataFimMatricula` fica vazio, e como o merge (linha 318) só atualiza `if (dataFimMatricula)`, o campo permanece vazio.

**Localização exata:**  
`frontend/src/pages/Importar.tsx`, linhas 297–308:
```typescript
// ATUAL — com bug:
const _inicioKey = Object.keys(nr).find(k => k.includes('INICIO') && k.includes('MATRICULA'));
const _inicioVal = _inicioKey ? nr[_inicioKey] : undefined;
const dataInicioMatricula = fmtDate(
  nr['DATA INICIO MATRICULA'] ??
  nr['DATA DE INICIO DA MATRICULA'] ??
  nr['INICIO DA MATRICULA'] ??
  nr['INICIO MATRICULA'] ??
  nr['DATA DA MATRICULA'] ??
  _inicioVal
);
const dataFimMatricula = fmtDate(nr['DATA FIM MATRICULA']);      // ← BUG: sem fallback
const dataMovimentacao = fmtDate(nr['DATA MOVIMENTACAO']);       // ← BUG: sem fallback
```

**Correção exata — substituir as 2 linhas bugadas por:**
```typescript
const _fimKey = Object.keys(nr).find(k => k.includes('FIM') && k.includes('MATRICULA'));
const _fimVal = _fimKey ? nr[_fimKey] : undefined;
const dataFimMatricula = fmtDate(
  nr['DATA FIM MATRICULA'] ??
  nr['DT FIM MATRICULA'] ??
  _fimVal
);

const _movKey = Object.keys(nr).find(k =>
  k.includes('MOVIMENTAC') || (k.includes('DATA') && k.includes('MOVIM'))
);
const _movVal = _movKey ? nr[_movKey] : undefined;
const dataMovimentacao = fmtDate(
  nr['DATA MOVIMENTACAO'] ??
  nr['DT MOVIMENTACAO'] ??
  nr['DATA DE MOVIMENTACAO'] ??
  _movVal
);
```

**Nota sobre o PDF parser:**  
O parser de PDF (linhas 232–244) sempre define `dataInicioMatricula: ''` pois o PDF "Relação de Alunos" do SED não contém colunas de datas de matrícula. As datas de matrícula SÓ existem no Excel. O merge (linhas 310–319) preenche os campos do aluno já adicionado pelo PDF com os dados do Excel:
```typescript
if (dataInicioMatricula) e.dataInicioMatricula = dataInicioMatricula;
if (dataFimMatricula) e.dataFimMatricula = dataFimMatricula;
```
Isso FUNCIONA corretamente SE o Excel tiver a coluna e a coluna for reconhecida. Portanto, o Bug #1 é especificamente no lookup de `dataFimMatricula`.

**Teste pós-correção:**  
Reimportar arquivo Excel SED com alunos que têm Dt Fim Matrícula preenchida. Verificar em Alunos → detalhe do aluno → "Fim Matrícula" exibe "18/12/2026" em vez de "⚠️ não informado".

---

### 🔴 BUG #2 — Faltas históricas apagadas a cada reimportação

**Sintoma:**  
Cada vez que o usuário importa o Excel SED (ex: nova exportação em maio), TODAS as faltas de todos os meses anteriores (fevereiro, março, abril) são permanentemente deletadas do banco.

**Diagnóstico:**  
`frontend/src/pages/Importar.tsx`, linha 811:
```typescript
await api.clearAlunos();   // ← APAGA Falta + Aluno inteiros antes de reimportar
```

`frontend/src/api.ts`, linhas 140–144:
```typescript
clearAlunos: async () => {
  await supabase.from('Falta').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('Aluno').delete().neq('id', '00000000-0000-0000-0000-000000000000');
},
```

Depois disso, `bulkInsertAlunos()` insere novos alunos com NOVOS UUIDs. Mesmo que as Faltas não fossem deletadas, estariam orphaned (referenciando UUIDs antigos).

**Solução: Smart UPSERT por RA**

A solução preserva os UUIDs dos alunos existentes fazendo match por RA (Registro do Aluno). Como as Faltas referenciam `alunoId` (UUID do Aluno), ao manter o mesmo UUID, todo o histórico de faltas é automaticamente preservado.

---

#### PARTE A — Adicionar método `smartUpsertAlunos` em `frontend/src/api.ts`

**Inserir ANTES do fechamento do objeto `api` (antes da última `},` antes de `};` no final):**

```typescript
// Smart UPSERT alunos por RA — preserva UUIDs existentes (protege histórico de Falta)
smartUpsertAlunos: async (
  alunos: any[],
  onProgress: (n: number) => void
): Promise<{ raToId: Map<string, string>; nomeToId: Map<string, string> }> => {
  // 1. Busca todos os alunos existentes para comparar por RA
  const { data: existentes, error: fetchErr } = await supabase
    .from('Aluno').select('id, ra, nome');
  if (fetchErr) throw fetchErr;

  const raToExistingId = new Map<string, string>();
  const nomeNormToId = new Map<string, string>();
  for (const e of (existentes ?? [])) {
    if (e.ra) raToExistingId.set(String(e.ra), e.id);
    const nomeNorm = (e.nome ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    nomeNormToId.set(nomeNorm, e.id);
  }

  // 2. Prepara upsert: se RA existe → inclui id existente (mantém UUID), senão → sem id (insert)
  const toUpsert = alunos.map(a => {
    const ra = String(a.ra ?? '');
    const nomeNorm = (a.nome ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const existingId = (ra ? raToExistingId.get(ra) : undefined)
      ?? nomeNormToId.get(nomeNorm);
    return existingId ? { ...a, id: existingId } : a;
  });

  // 3. Faz upsert em chunks (onConflict: 'id' — atualiza existente, insere novo sem id)
  for (let i = 0; i < toUpsert.length; i += CHUNK) {
    const { error } = await supabase
      .from('Aluno')
      .upsert(toUpsert.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw error;
    onProgress(Math.min(i + CHUNK, toUpsert.length));
  }

  // 4. Re-lê alunos para obter UUIDs dos novos inseridos
  const { data: todos, error: err2 } = await supabase
    .from('Aluno').select('id, ra, nome');
  if (err2) throw err2;

  const raToId = new Map<string, string>();
  const nomeToId = new Map<string, string>();
  for (const a of (todos ?? [])) {
    if (a.ra) raToId.set(String(a.ra), a.id);
    nomeToId.set((a.nome ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''), a.id);
  }
  return { raToId, nomeToId };
},
```

---

#### PARTE B — Modificar `importar()` em `frontend/src/pages/Importar.tsx`

**Passo B1 — Remover as linhas clearAlunos (linhas 810–811):**

```typescript
// REMOVER estas 2 linhas completamente:
setStatus('Limpando alunos e faltas anteriores (turmas preservadas)...');
await api.clearAlunos();
```

O bloco try deve começar diretamente em:
```typescript
try {
  setStatus('Carregando turmas cadastradas...');
  const turmasExistentes = await api.getTurmas();
  // ... continua igual
```

---

**Passo B2 — Substituir bloco de inserção de alunos (linhas 856–881):**

Localizar o bloco que começa em:
```typescript
setStatus('Inserindo alunos...');
const alunosInsert = alunos.map(a => ({
```

E termina em:
```typescript
nomeToId.set(normalizeStr(a.nome), a.id);
}
```

**Substituir TODO esse bloco por:**
```typescript
setStatus('Atualizando cadastro de alunos (preservando histórico de faltas)...');
const alunosInsert = alunos.map(a => ({
  nome: a.nome,
  turmaId: resolveId(a.serie, a.professora),
  ra: a.ra ? String(a.ra) : null,
  numero: 0,
  data_nascimento: a.nascimento || null,
  data_inicio_matricula: a.dataInicioMatricula || null,
  data_fim_matricula: a.dataFimMatricula || null,
  data_movimentacao: a.dataMovimentacao || null,
  deficiencia: a.deficiencia,
  situacao: a.situacao,
  bolsa_familia: a.bolsaFamilia,
  professora: a.professora,
  nis: a.nis || null,
  responsavel: a.responsavel || null,
}));

const { raToId, nomeToId } = await api.smartUpsertAlunos(alunosInsert, (n) => {
  setProgresso(n);
  setStatus(`Atualizando alunos... ${n}/${alunos.length}`);
});
```

---

**Passo B3 — Substituir inserção de faltas (linhas 898–899):**

```typescript
// SUBSTITUIR:
setStatus(`Inserindo ${faltasParaInserir.length} registros de frequência...`);
await api.bulkInsertFaltas(faltasParaInserir);
```

**POR:**
```typescript
setStatus(`Atualizando ${faltasParaInserir.length} registros de frequência (histórico preservado)...`);
await api.upsertFaltasBatch(faltasParaInserir);
```

---

**Passo B4 — Atualizar texto do botão de confirmação (linha ~982):**

```typescript
// SUBSTITUIR:
<button onClick={importar}
  style={{ ...btn('danger', { full: true }), fontWeight: 700, fontSize: 15 }}>
  ✅ Confirmar Importação (preserva turmas e professoras)
</button>
```

**POR:**
```typescript
<button onClick={importar}
  style={{ ...btn('primary', { full: true }), fontWeight: 700, fontSize: 15 }}>
  ✅ Atualizar Cadastro (preserva faltas históricas)
</button>
```

---

#### PARTE C — Exibir contagem de faltas existentes no preview

**Passo C1 — Adicionar estado no componente (junto dos outros useState, após linha 93):**
```typescript
const [faltasExistentes, setFaltasExistentes] = useState<number>(0);
```

**Passo C2 — Ao final da função `analisar()`, dentro do bloco try, ANTES de `setPreview(...)`:**
```typescript
// Conta faltas existentes para informar o usuário
const { count: cntFaltas } = await supabase
  .from('Falta').select('*', { count: 'exact', head: true });
setFaltasExistentes(cntFaltas ?? 0);
```

**Passo C3 — No preview, adicionar card de faltas preservadas (no array dos StatCards):**
```tsx
['🗄️ Faltas preservadas', faltasExistentes],
```

**Passo C4 — Abaixo dos cards, adicionar aviso (antes do bloco `<div style={{ display: 'flex', gap: 10, marginTop: 20 }}>`):**
```tsx
{faltasExistentes > 0 && (
  <div style={{
    marginTop: 12, padding: '10px 14px',
    background: theme.successLight,
    border: `1px solid ${theme.success}`,
    borderRadius: theme.radius,
    fontSize: 13, color: theme.successHover,
    fontWeight: 600,
  }}>
    ✅ {faltasExistentes} registros de frequência históricos serão PRESERVADOS.
    Apenas os dados do arquivo atual serão adicionados/atualizados por mês.
  </div>
)}
```

---

#### Resultado esperado após Bug #2 corrigido:
- Reimportar Excel de maio → faltas de fev/mar/abr permanecem intactas
- Alunos existentes (mesmo RA) são ATUALIZADOS (nome, situação, datas), não deletados+recriados
- Alunos novos (RA não existente) são INSERIDOS normalmente
- Alunos que saíram do SED mas existem no banco PERMANECEM com seu histórico
- Registros de frequência do arquivo atual são UPSERTEADOS: chave única = `alunoId + mes + ano`

---

### 🔴 BUG #3 — Botão "📄 PDF" exporta texto monospace sem formatação (parece terminal)

**Sintoma:**  
O botão `📄 PDF` na tela Faltas abre uma janela com texto puro em fonte monospace, caracteres ASCII `══` e `──` como bordas, sem tabela real, sem cores, sem qualidade para impressão oficial.

**Localização exata:**  
`frontend/src/pages/Faltas.tsx`, função `exportarPDF()`, linhas 122–162.

**Código atual (PROBLEMÁTICO):**
```typescript
const exportarPDF = () => {
  const linhas = alunos.map((a, i) => {
    // ...cálculos...
    return `${String(a.numero || i + 1).padStart(2)} ${(a.nome + defi + bf).padEnd(44)}  F:${nF} J:${nJ} A:${nA}   ${freq}%${alerta}`;
  });
  const conteudo = [
    '══════════════════════════════════════════════════════════════',
    `  DIÁRIO DE CLASSE — ${ano}`,
    // ... mais texto monospace ...
  ].join('\n');

  win.document.write(`<html>...<style>body{font-family:monospace;...}
  <body><pre>${conteudo}</pre>...`);  // ← <pre> com texto plano
};
```

**Resultado ATUAL:** janela com texto como um terminal de computador, sem bordas reais, sem cores, não tem aparência de documento oficial.

---

**CORREÇÃO: Substituir TODA a função `exportarPDF()` pelo código abaixo.**

> **ATENÇÃO:** Substituir o bloco completo desde `const exportarPDF = () => {` até o `};` correspondente (linhas 122–162).

```typescript
const exportarPDF = () => {
  const turmaObj = turmas.find(t => t.id === turmaId);
  const nomeMes = MESES[mes - 1];

  const linhas = alunos.map((a, i) => {
    const dias = diasAluno[a.id] ?? initDias(numDias);
    const nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
    const ausencias = nF + nJ + nA;
    const freqNum = numDias > 0 ? ((numDias - ausencias) / numDias * 100) : 100;
    const freq = freqNum.toFixed(0);
    const alerta = freqNum < 75;
    const defi = a.deficiencia ? ' ♿' : '';
    const bf = a.bolsa_familia ? ' 💚' : '';
    const rowBg = alerta ? '#fff1f2' : i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const freqColor = alerta ? '#dc2626' : freqNum >= 90 ? '#16a34a' : '#d97706';
    return `<tr style="background:${rowBg};">
      <td style="border:1px solid #cbd5e1;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;width:28px;">${String(a.numero || i + 1).padStart(2, '0')}</td>
      <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:12px;${alerta ? 'font-weight:700;' : ''}">${a.nome}${defi}${bf}${alerta ? ' <span style="color:#dc2626;font-size:10px;">⚠️</span>' : ''}</td>
      <td style="border:1px solid #cbd5e1;padding:5px 4px;text-align:center;font-size:12px;color:#dc2626;font-weight:${nF > 0 ? '700' : '400'};">${nF}</td>
      <td style="border:1px solid #cbd5e1;padding:5px 4px;text-align:center;font-size:12px;color:#d97706;font-weight:${nJ > 0 ? '700' : '400'};">${nJ}</td>
      <td style="border:1px solid #cbd5e1;padding:5px 4px;text-align:center;font-size:12px;color:#7c3aed;font-weight:${nA > 0 ? '700' : '400'};">${nA}</td>
      <td style="border:1px solid #cbd5e1;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;color:${freqColor};">${freq}%</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Frequência — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 8mm; font-size: 12px; color: #0f172a; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 8mm; }
    body { margin: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<!-- CABEÇALHO DA ESCOLA -->
<div style="text-align:center; border-bottom:3px solid #1e40af; padding-bottom:8px; margin-bottom:10px;">
  <div style="font-size:11px; color:#64748b; font-weight:600; letter-spacing:1px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:18px; font-weight:900; color:#1e40af; letter-spacing:1px; margin:2px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:11px; color:#475569;">Diário de Frequência — Ano Letivo ${ano}</div>
</div>

<!-- INFORMAÇÕES DA TURMA -->
<table style="margin-bottom:10px; border:none;">
  <tr>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">TURMA:</span>
      <span style="font-size:14px; font-weight:900; color:#1e40af; margin-left:6px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">PROFESSORA:</span>
      <span style="font-weight:600; margin-left:6px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:13px; text-align:right; white-space:nowrap;">
      <span style="font-weight:900; color:#dc2626; font-size:15px;">${nomeMes.toUpperCase()} / ${ano}</span>
    </td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Total de alunos:</span> ${alunos.length}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Dias letivos do mês:</span> ${numDias}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b; text-align:right;">
      <span style="font-weight:600;">Frequência geral:</span>
      <span style="font-weight:900; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'}; font-size:13px; margin-left:4px;">${freqGeral}%</span>
    </td>
  </tr>
</table>

<!-- TABELA DE ALUNOS -->
<table>
  <thead>
    <tr style="background:#1e40af; color:#ffffff;">
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:28px; font-size:11px; text-align:center;">Nº</th>
      <th style="border:1px solid #1e3a8a; padding:7px 8px; font-size:11px; text-align:left;">NOME DO ALUNO</th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#dc2626;">F<br><span style="font-size:8px;font-weight:400;">Faltas</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#d97706;">J<br><span style="font-size:8px;font-weight:400;">Justif.</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#7c3aed;">A<br><span style="font-size:8px;font-weight:400;">Atestado</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 6px; width:52px; font-size:11px; text-align:center;">FREQ.<br><span style="font-size:8px;font-weight:400;">%</span></th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
  <tfoot>
    <tr style="background:#f1f5f9; font-weight:700;">
      <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-size:11px;" colspan="2">TOTAIS DO MÊS</td>
      <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-size:13px; color:#dc2626;">${totalF}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-size:13px; color:#d97706;">${totalJ}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-size:13px; color:#7c3aed;">${totalA}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-size:13px; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'};">${freqGeral}%</td>
    </tr>
  </tfoot>
</table>

<!-- ESTATÍSTICAS -->
<div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
  ${alertas.length > 0 ? `<div style="padding:5px 10px; background:#fff1f2; border:1px solid #fca5a5; border-radius:4px; font-size:11px; color:#dc2626; font-weight:700;">⚠️ Alertas frequência &lt;75%: ${alertas.length} aluno(s)</div>` : `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#16a34a; font-weight:700;">✅ Nenhum aluno com frequência crítica</div>`}
  ${alunos.filter((a: any) => a.deficiencia).length > 0 ? `<div style="padding:5px 10px; background:#f0f9ff; border:1px solid #7dd3fc; border-radius:4px; font-size:11px; color:#0369a1;">♿ Alunos com deficiência: ${alunos.filter((a: any) => a.deficiencia).length}</div>` : ''}
  ${alunos.filter((a: any) => a.bolsa_familia).length > 0 ? `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#15803d;">💚 Bolsa Família: ${alunos.filter((a: any) => a.bolsa_familia).length} aluno(s)</div>` : ''}
</div>

<!-- LEGENDA -->
<div style="margin-top:6px; font-size:10px; color:#64748b; padding:4px 0; border-top:1px solid #e2e8f0;">
  <span style="font-weight:700;">Legenda:</span>
  <span style="margin-left:8px; color:#dc2626; font-weight:700;">F = Falta</span>
  <span style="margin-left:10px; color:#d97706; font-weight:700;">J = Justificado</span>
  <span style="margin-left:10px; color:#7c3aed; font-weight:700;">A = Atestado médico</span>
  <span style="margin-left:10px;">⚠️ = Frequência abaixo de 75%</span>
  <span style="margin-left:10px;">♿ = Deficiência</span>
  <span style="margin-left:10px;">💚 = Bolsa Família</span>
</div>

<!-- ASSINATURAS -->
<div style="margin-top:14mm; display:flex; gap:20mm; flex-wrap:wrap; font-size:11px;">
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura do(a) Professor(a)</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:140px;">Data: _____ / _____ / _______</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura da Coordenação</div>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups no navegador para imprimir.'); return; }
  win.document.write(html);
  win.document.close();
};
```

**Resultado esperado após Bug #3 corrigido:**
- Cabeçalho com nome da escola em destaque azul
- Tabela com borda real, header azul, colunas F/J/A com cores (vermelho/laranja/roxo)
- Linhas alternadas branco/cinza claro
- Linhas de alunos em alerta (freq < 75%) com fundo vermelho claro
- Frequência colorida: verde ≥90%, laranja 75–89%, vermelho <75%
- Rodapé com totais em destaque
- Estatísticas em cards coloridos
- Linhas de assinatura professor + data + coordenação
- Formato A4 retrato, margem 10mm, auto-abre diálogo de impressão

---

## 8. FUNCIONALIDADES PENDENTES DE IMPLEMENTAÇÃO

### 📋 FEATURE A — Numeração de chamada (nº da turma)

Campo `numero` na tabela Aluno existe mas sempre importado como 0. O SED Excel tem coluna "Nº CHAMADA" ou "NR CHAMADA". Adicionar ao parser:

Em `frontend/src/pages/Importar.tsx`, no bloco de parsing Excel (próximo à linha 278, após `const nasc = ...`):
```typescript
const numero = parseInt(
  String(nr['NR CHAMADA'] ?? nr['NUMERO'] ?? nr['NR'] ?? nr['N'] ?? '0')
) || 0;
```
E incluir `numero` no objeto `alunosInsert` (substituir `numero: 0` por `numero`).

### 📋 FEATURE B — Exportação Excel com formato aprimorado

O botão `📊 Excel` na tela Faltas existe mas exporta formato simples. Melhorar para:
- Aba "Frequência" com colunas: Nº, Nome, RA, Situação, Jan..Dez, Total, %
- Nome do arquivo: `DiarioClasse_{turma}_{ano}.xlsx`

### 📋 FEATURE C — Relatório completo para impressão

Criar página `/relatorio` que gera PDF imprimível com:
- Cabeçalho: escola, turma, professora, ano letivo
- Tabela: Nº | Nome | RA | Fev | Mar | ... | Dez | Total | %
- Rodapé: assinatura da professora e do diretor
- Formato A4 paisagem

---

## 9. VARIÁVEIS DE AMBIENTE (Render.com)

No painel do Render, em Environment:
```
VITE_SUPABASE_URL=https://hxmwpleyhagwcukuhzxg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ
```
(Esses valores já estão hardcoded como fallback em `api.ts` — funcionam mesmo sem as env vars)

---

## 10. PROCESSO DE DEPLOY

```bash
# 1. Fazer alterações nos arquivos
# 2. Build local para verificar erros TypeScript
cd frontend && npm run build

# 3. Commit e push
git add -A
git commit -m "descrição da correção"
git push -u origin claude/bold-hamilton-a1Oj6

# 4. Render detecta o push e faz deploy automático (~2-3 minutos)
# 5. Verificar em: https://diario.jroapp.com.br
```

**Build command no Render:** `cd frontend && npm install && npm run build`  
**Publish directory:** `frontend/dist`  
**Domínio customizado:** `diario.jroapp.com.br` via CNAME → `diario-classe-frontend.onrender.com`

---

## 11. REGRAS CRÍTICAS PARA O EXECUTOR

1. **NUNCA usar `api.clearAlunos()` no fluxo de importação** — isso apaga TODAS as faltas históricas. Após o Bug #2 corrigido, esse método pode ser mantido apenas com aviso claro "⚠️ Apaga tudo incluindo histórico de faltas".

2. **NUNCA hardcodar cores de fundo em listas/tabelas** — usar sempre `var(--row-even)`, `var(--row-odd)`, `var(--footer-row)`, `var(--card)`, `var(--edit-bg)`.

3. **NUNCA usar `color: theme.primary` para texto** — usar `color: theme.primaryText`. `theme.primary = '#1e40af'` é azul escuro invisível em dark mode. `theme.primaryText = 'var(--primary-text)'` adapta automaticamente para claro/escuro.

4. **Formato de datas sempre DD/MM/AAAA** — o banco armazena como TEXT nesse formato. A função `fmtDate()` em `Importar.tsx` normaliza para esse formato.

5. **Upsert de faltas usa `onConflict: 'alunoId,mes,ano'`** — garantido pelo `api.upsertFaltasBatch()`. Nunca usar `bulkInsertFaltas()` em reimportações.

6. **Testar em dark mode SEMPRE** — ligar o dark mode e verificar contraste de todo elemento novo.

7. **Após push, criar Pull Request como draft** se não existir para a branch `claude/bold-hamilton-a1Oj6`.

---

## 12. CASO ESPECÍFICO: Prof.ª Maria Lúcia — Aluna ALANNA (bug de referência)

**Situação reportada pelo usuário:**
- Aluna: ALANNA EMANUELLY FERREIRA DE SOUZA
- RA: 000123981657 (formato SED: 000123981657-1/SP)
- Turma: 1ª ETAPA PRÉ-ESCOLA A (MANHÃ) — professora: MARIA LUCIA
- No SED web (aba Matrículas), ano 2026:
  - Situação: **Ativo**
  - Dt Início Matrícula: **04/02/2026**
  - Dt Fim Matrícula: **18/12/2026**
- No Diário de Classe (sistema): campos aparecem como "⚠️ não informado"

**Causa raiz:** Bug #1 — coluna "Dt Fim Matrícula" no Excel SED normaliza para "DT FIM MATRICULA" mas o código busca "DATA FIM MATRICULA" — não bate, retorna undefined, campo fica vazio.

**Solução:** Aplicar exatamente a correção descrita no Bug #1 acima.

**Verificação pós-correção:**
1. Aplicar o fix no código
2. Fazer build e deploy
3. Reimportar o Excel SED do ano 2026
4. Abrir Alunos → selecionar turma 1ª ETAPA PRÉ-ESCOLA A → clicar em ALANNA EMANUELLY
5. Verificar que "Início Matrícula" mostra **04/02/2026** e "Fim Matrícula" mostra **18/12/2026**

---

## 13. CHECKLIST DE EXECUÇÃO (ordem obrigatória)

- [ ] **1.** Fazer checkout da branch `claude/bold-hamilton-a1Oj6`
- [ ] **2.** Corrigir Bug #1: `Importar.tsx` linhas 307–308 — dataFimMatricula + dataMovimentacao com fallback dinâmico
- [ ] **3.** Corrigir Bug #2 Parte A: adicionar `smartUpsertAlunos` em `api.ts`
- [ ] **4.** Corrigir Bug #2 Parte B1: remover `clearAlunos()` de `importar()` em `Importar.tsx`
- [ ] **5.** Corrigir Bug #2 Parte B2: substituir `bulkInsertAlunos` por `smartUpsertAlunos`
- [ ] **6.** Corrigir Bug #2 Parte B3: substituir `bulkInsertFaltas` por `upsertFaltasBatch`
- [ ] **7.** Corrigir Bug #2 Parte B4: atualizar texto do botão de confirmação
- [ ] **8.** Corrigir Bug #2 Parte C: adicionar contagem de faltas existentes no preview
- [ ] **9.** Corrigir Bug #3: substituir TODA a função `exportarPDF()` em `Faltas.tsx` (linhas 122–162) pelo código fornecido na seção Bug #3
- [ ] **10.** Rodar `cd frontend && npm run build` — confirmar zero erros TypeScript
- [ ] **11.** Testar dark mode em todas as telas alteradas
- [ ] **12.** Testar o botão 📄 PDF na tela Faltas — verificar que abre documento formatado (não texto monospace)
- [ ] **13.** `git add -A && git commit -m "fix: PDF formatado A4 + preservar faltas históricas + parser datas matrícula SED"`
- [ ] **14.** `git push -u origin claude/bold-hamilton-a1Oj6`
- [ ] **15.** Criar PR draft no GitHub se não existir
- [ ] **16.** Reportar ao Ricardo: "Concluído — teste o botão 📄 PDF e reimporte o Excel SED para verificar as datas"

---

*Documento gerado em 22/05/2026 — Versão 2.0*  
*Sistema: Diário de Classe Digital — EMEIEF LUIZ GONZAGA*  
*Elaborado pelo agente CÉREBRO para execução pela equipe técnica*
