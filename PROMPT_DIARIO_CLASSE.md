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
- [ ] **9.** Rodar `cd frontend && npm run build` — confirmar zero erros TypeScript
- [ ] **10.** Testar dark mode em todas as telas alteradas
- [ ] **11.** `git add -A && git commit -m "fix: preservar faltas históricas no reimport + parser datas matrícula SED"`
- [ ] **12.** `git push -u origin claude/bold-hamilton-a1Oj6`
- [ ] **13.** Criar PR draft no GitHub se não existir
- [ ] **14.** Reportar ao Ricardo: "Concluído — reimporte o Excel SED para verificar as datas e confirmar preservação do histórico"

---

*Documento gerado em 22/05/2026 — Versão 2.0*  
*Sistema: Diário de Classe Digital — EMEIEF LUIZ GONZAGA*  
*Elaborado pelo agente CÉREBRO para execução pela equipe técnica*
