# PROMPT COMPLETO — DIÁRIO DE CLASSE DIGITAL
## Sistema de Lançamento de Faltas para Professores

---

## 1. CONTEXTO E OBJETIVO

Construir um **aplicativo web** chamado **Diário de Classe** para uso por professores e secretaria escolar.

O objetivo é simples:
- Importar a planilha oficial exportada da **Secretaria Escolar Digital (SED)** do Estado de São Paulo
- Visualizar os alunos por turma com todos os seus dados
- Lançar faltas mensalmente por turma
- Acessar pelo celular (mobile-first)

**Não há login.** O app é interno, link compartilhado com os professores.

---

## 2. STACK TECNOLÓGICA

```
Frontend: React + Vite + TypeScript (sem framework extra)
Banco de dados: Supabase (PostgreSQL) — projeto já existente
Hospedagem frontend: Render (Static Site) — gratuito
Biblioteca Excel: xlsx (SheetJS) — para parsing no browser
```

**Repositório GitHub:** `ricardojoliveira313/diario_classe`
**URL do app:** `https://diario-classe-frontend.onrender.com`

---

## 3. BANCO DE DADOS — SUPABASE

**URL:** `https://hxmwpleyhagwcukuhzxg.supabase.co`
**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ`

### Tabelas (já existem no banco — apenas ADD COLUMN IF NOT EXISTS):

```sql
-- TURMA
CREATE TABLE IF NOT EXISTS "Turma" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,           -- Nome completo da série (ex: "1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL")
  professora TEXT,     -- Nome da professora responsável
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALUNO
CREATE TABLE IF NOT EXISTS "Aluno" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turmaId UUID REFERENCES "Turma"(id) ON DELETE CASCADE,
  nome TEXT,
  numero INTEGER,                    -- Nº de ordem na lista
  ra BIGINT,                         -- Registro do Aluno
  dig_ra TEXT,                       -- Dígito do RA
  data_nascimento TEXT,
  data_inicio_matricula TEXT,
  data_fim_matricula TEXT,
  data_movimentacao TEXT,
  deficiencia TEXT,
  bolsa_familia BOOLEAN DEFAULT FALSE,
  situacao TEXT DEFAULT 'ATIVO',     -- ATIVO | N COM | BAIXA TRANSF. | REMA | TRANSF.
  professora TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FALTA
CREATE TABLE IF NOT EXISTS "Falta" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alunoId UUID REFERENCES "Aluno"(id) ON DELETE CASCADE,
  turmaId UUID REFERENCES "Turma"(id),
  mes INTEGER NOT NULL,              -- 1=Jan, 2=Fev, ..., 12=Dez
  ano INTEGER NOT NULL DEFAULT 2026,
  faltas INTEGER DEFAULT 0,
  frequencia TEXT DEFAULT '',
  UNIQUE(alunoId, mes, ano)
);
```

### Regras obrigatórias do Supabase:
```sql
-- Desabilitar RLS (sem autenticação):
ALTER TABLE "Turma" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Aluno" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Falta" DISABLE ROW LEVEL SECURITY;

-- Remover constraints NOT NULL que impedem insert:
ALTER TABLE "Turma" ALTER COLUMN "nome" DROP NOT NULL;
ALTER TABLE "Aluno" ALTER COLUMN "nome" DROP NOT NULL;
```

---

## 4. PLANILHA DE ORIGEM — ESTRUTURA EXATA

A planilha é exportada da **Secretaria Escolar Digital (SED)** do Estado de São Paulo.

**Pode vir em dois formatos:**
1. **Multi-abas:** cada aba = um mês (ex: aba "FEVEREIRO", aba "MARÇO", aba "ABRIL")
2. **Aba consolidada:** uma única aba com nome variável (ex: "Diário Consolidado 2026") e coluna MÊS com os valores

**O sistema DEVE suportar os dois formatos.**

### Colunas da planilha (15 colunas, nesta ordem):

| Coluna | Conteúdo | Exemplo |
|--------|----------|---------|
| PROFESSORA | Nome da professora | Maria Lucia |
| SÉRIE | Nome completo da turma | 1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL |
| Nº | Número de ordem do aluno | 1 |
| NOME DO ALUNO | Nome completo | ALANNA EMANUELLY FERREIRA DE SOUZA |
| MÊS | Mês de referência | Fevereiro |
| FREQUÊNCIA DOS ALUNOS(A) | Descrição textual da frequência | Não há faltas no mês |
| SITUAÇÃO | Status do aluno | ATIVO |
| RA | Registro do Aluno (número) | 123981657 |
| DIG RA | Dígito verificador do RA | 1 |
| DATA DE NASCIMENTO | Data nascimento | 26/03/2022 |
| DATA INÍCIO MATRÍCULA | Data início | 04/02/2026 |
| DATA FIM MATRÍCULA | Data fim | 18/12/2026 |
| DATA MOVIMENTAÇÃO | Data movimentação | 23/02/2026 |
| DEFICIÊNCIA | Tipo de deficiência (pode ser vazio) | — |
| BOLSA FAMÍLIA | Participa do programa | Sim / Não |

### Valores possíveis de SITUAÇÃO:
- `ATIVO` (verde)
- `N COM` (vermelho — não compareceu)
- `BAIXA TRANSF.` (roxo — baixa por transferência)
- `REMA` (laranja — remanejamento)
- `TRANSF.` (azul — transferido)

---

## 5. FUNCIONALIDADES DO APP

### 5.1 — Página: IMPORTAR (tela inicial `/`)
- Campo de upload: aceita `.xlsx`
- Ao selecionar o arquivo, lê no browser usando `xlsx` (SheetJS) e exibe preview:
  - Quantidade de turmas encontradas
  - Quantidade de alunos
  - Abas/meses encontrados
  - Quantidade de registros de frequência
- Botão "Confirmar Importação" (vermelho, com aviso de que apaga dados anteriores)
- Processo de importação:
  1. Limpar tabelas Falta, Aluno, Turma (nessa ordem)
  2. Inserir Turmas (únicas por SÉRIE)
  3. Inserir Alunos (únicos por RA, ou por nome se não tiver RA)
  4. Inserir Faltas (uma por aluno+mês, sem duplicatas)
- Barra de progresso durante inserção
- Mensagem de sucesso com links para "Ver Alunos" e "Lançar Faltas"

### Regras críticas da importação:
- **Mês:** tentar pelo nome da aba primeiro. Se a aba não for nome de mês, usar a coluna MÊS da linha
- **Deduplicação alunos:** chave = RA (se existir) ou nome do aluno
- **Deduplicação faltas:** chave = `alunoId + mes` — nunca inserir duplicata
- **Inserção em chunks de 80 registros** para não estourar limites do Supabase
- **Não incluir colunas que não existem na tabela** (causa erro de schema cache)

```javascript
// Mapeamento de mês por nome (normalizado sem acentos):
const MES_MAP = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12
};

// Obter mês: aba primeiro, depois coluna MÊS da linha
function getMes(sheetName, row) {
  const normalize = s => s.toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MES_MAP[normalize(sheetName)]
    ?? MES_MAP[normalize(row['MÊS'] ?? row['MES'] ?? '')]
    ?? 0;
}
// Só inserir na tabela Falta se mes > 0
```

---

### 5.2 — Página: ALUNOS (`/alunos`)
- Seletor de turma (dropdown)
- Cards de resumo: Total | Ativos | Bolsa Família
- Barra de busca por nome ou RA
- Filtro por SITUAÇÃO
- Tabela com colunas: Nº | Nome | Nascimento/Deficiência | RA | Situação (colorida) | Bolsa Família (✅ ou —)
- Situação com cor por tipo (ATIVO=verde, N COM=vermelho, etc.)

---

### 5.3 — Página: FALTAS (`/faltas`)
- Seletor de turma + seletor de mês
- Lista de alunos da turma com:
  - Nº de ordem
  - Nome
  - Indicador Bolsa Família (💚 se sim)
  - Situação se diferente de ATIVO
  - Botões − / número / + para lançar faltas
- Total de faltas no rodapé
- Botão "Salvar Faltas" (upsert por alunoId+mes+ano)

---

## 6. NAVEGAÇÃO

Menu superior azul (`#1e40af`) com:
- 📥 Importar (rota `/`)
- 👥 Alunos (rota `/alunos`)
- 📋 Faltas (rota `/faltas`)

**OBRIGATÓRIO:** configurar rewrite de rotas para SPA no `render.yaml`:
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

---

## 7. ESTRUTURA DE ARQUIVOS

```
diario_classe/
├── render.yaml                    # Deploy config Render
├── frontend/
│   ├── package.json               # inclui: xlsx, react, react-dom, react-router-dom
│   ├── vite.config.ts
│   ├── public/
│   │   └── _redirects             # /* /index.html 200
│   └── src/
│       ├── main.tsx               # Router + Nav
│       ├── api.ts                 # Supabase client + métodos
│       └── pages/
│           ├── Importar.tsx
│           ├── Alunos.tsx
│           └── Faltas.tsx
```

---

## 8. render.yaml COMPLETO

```yaml
services:
  - type: web
    name: diario-classe-frontend
    runtime: static
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    rootDir: frontend
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

---

## 9. api.ts — MÉTODOS NECESSÁRIOS

```typescript
// getTurmas, getAlunos, getFaltas, upsertFaltasBatch (já existentes)

// IMPORTAÇÃO:
clearAll()           // Delete Falta, Aluno, Turma (nessa ordem)
bulkInsertTurmas()   // Insert array de turmas, retorna com IDs
bulkInsertAlunos()   // Insert em chunks de 80, com callback de progresso
bulkInsertFaltas()   // Insert em chunks de 80
```

---

## 10. O QUE NÃO FAZER

```
❌ NÃO usar autenticação — app é público internamente
❌ NÃO incluir colunas que não existem na tabela (frequencia_texto, _idx, etc.)
❌ NÃO ler o mês APENAS pelo nome da aba (aba pode ter nome livre)
❌ NÃO criar rotas sem configurar rewrite no Render (dá "Not Found")
❌ NÃO inserir mais de 100 registros por vez no Supabase
❌ NÃO deixar RLS habilitado nas tabelas (bloqueia inserts anônimos)
❌ NÃO assumir que colunas têm NOT NULL — dropar constraints antes
❌ NÃO deployar sem testar o fluxo completo localmente primeiro
```

---

## 11. CRITÉRIO DE CONCLUSÃO

O app está CONCLUÍDO quando:
1. ✅ Upload do arquivo `.xlsx` da SED funciona sem erro
2. ✅ Preview mostra turmas, alunos e meses corretamente
3. ✅ Importação completa sem erro (836+ alunos, 37+ turmas)
4. ✅ Página Alunos mostra tabela com RA, Situação colorida, Bolsa Família
5. ✅ Página Faltas mostra alunos com +/- e salva no banco
6. ✅ Rotas `/alunos` e `/faltas` funcionam ao acessar diretamente (sem "Not Found")
7. ✅ Funciona no celular (mobile-first)
8. ✅ Testado por Ricardo Oliveira e aprovado

---

*Documento gerado em 18/05/2026*
*App: Diário de Classe — ricardojoliveira313/diario_classe*
