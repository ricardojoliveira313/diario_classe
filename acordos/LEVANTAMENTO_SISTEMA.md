# LEVANTAMENTO COMPLETO — DIÁRIO DE CLASSE DIGITAL
## EMEIEF LUIZ GONZAGA — Santo André/SP
**Data:** 22/05/2026

---

## 1. RESUMO GERAL

| Item | Valor |
|---|---|
| Tipo | SPA React + TypeScript |
| Build | Vite 5 |
| Backend | Supabase (PostgreSQL) — serverless |
| Deploy | Render.com (static site) |
| Domínio | diario.jroapp.com.br |
| Branch ativa | `main` |
| Último commit | `de12ba4` — fix PDF export A4 |
| Total páginas | 9 |
| Total arquivos src | 15 |
| Total linhas frontend | ~3700 |

---

## 2. ARQUIVOS DO SISTEMA

### 2.1 Core (config/infra)

| Arquivo | Linhas | Função |
|---|---|---|
| `frontend/index.html` | 146 | CSS variables dark/light mode + entry point |
| `frontend/src/main.tsx` | 249 | Router + sidebar + ThemeContext + AnoContext |
| `frontend/src/api.ts` | 163 | Todas as chamadas Supabase (163 linhas) |
| `frontend/src/styles.ts` | 132 | Design system: theme, btn(), input, card(), row() |
| `frontend/src/components.tsx` | 134 | Componentes reutilizáveis (Spinner, Loading, StatCard, etc.) |
| `frontend/src/ThemeContext.tsx` | 33 | Toggle dark/light mode |
| `frontend/src/AnoContext.tsx` | 18 | Ano letivo selecionado (2025, 2026, 2027) |
| `render.yaml` | 11 | Configuração Render: static site, build npm |
| `SUPABASE_SQL.sql` | 97 | Schema completo do banco (4 tabelas) |

### 2.2 Páginas

| Arquivo | Linhas | Função |
|---|---|---|
| `Importar.tsx` | **1119** | Parser SED (Excel + PDF) — maior arquivo |
| `Faltas.tsx` | **492** | Grade de faltas + exportação |
| `Alunos.tsx` | **367** | Lista/detalhe/edição de alunos |
| `Turmas.tsx` | **355** | CRUD turmas + importação professora |
| `Distorcao.tsx` | **352** | Relatório distorção série-idade |
| `OCR.tsx` | **294** | Leitura OCR via Tesseract.js |
| `Professor.tsx` | **272** | Lançamento mobile + foto OCR (Google Vision) |
| `Pendentes.tsx` | **203** | Revisão de OCR pendentes |
| `Dashboard.tsx` | **158** | Visão geral por turma |

---

## 3. BANCO DE DADOS (Supabase)

### 3.1 Tabelas

| Tabela | Chave | FK |
|---|---|---|
| `Turma` | UUID `id` | — |
| `Aluno` | UUID `id` | `turmaId` → Turma(id) |
| `Falta` | UUID `id` | `alunoId` → Aluno(id), `turmaId` → Turma(id) |
| `Pendente` | UUID `id` | `turmaId` → Turma(id) |

**Unique:** `Falta(alunoId, mes, ano)`

**RLS:** Desabilitado em todas as tabelas

### 3.2 API (`api.ts` — 163 linhas)

Métodos disponíveis:

| Categoria | Métodos |
|---|---|
| **Turma** | `getTurmas`, `createTurma`, `updateTurma`, `deleteTurma`, `bulkInsertTurmas` |
| **Aluno** | `getAlunos`, `getAllAlunos`, `updateAluno`, `createAluno`, `deleteAluno`, `bulkInsertAlunos`, `clearAlunos` (⚠️ apaga faltas) |
| **Falta** | `getFaltas`, `getFaltasMes`, `getFaltasAluno`, `upsertFaltasBatch`, `bulkInsertFaltas` |
| **Pendente** | `getPendentes`, `criarPendente`, `atualizarPendente`, `deletePendente`, `contarPendentes` |
| **Schema** | `reloadSchema`, `checkSchema` |
| **Clear** | `clearAll` (apaga TUDO), `clearAlunos` (apaga alunos+faltas) |

**CHUNK:** 80 registros por batch

---

## 4. ROTAS (main.tsx)

| Rota | Página | NavItem |
|---|---|---|
| `/` | Dashboard | 📊 |
| `/importar` | Importar | 📥 |
| `/turmas` | Turmas | 👩‍🏫 |
| `/alunos` | Alunos | 👥 |
| `/faltas` | Faltas | 📋 |
| `/distorcao` | Distorcao | 📐 |
| `/ocr` | OCR | 📷 |
| `/professor` | Professor | (não no nav, acessado por link?) |
| `/pendentes` | Pendentes | ⏳ |

**NÃO existem:** BolsaFamilia (descrita no PROMPT_DIARIO_CLASSE.md mas não implementada)

---

## 5. ESTADO DAS CORREÇÕES (commits recentes)

| Commit | O que fez | Status |
|---|---|---|
| `de12ba4` | PDF export formatado A4 com tabela/assinaturas | ✅ Live |
| `36057d5` | Upsert preserva faltas históricas + parser datas SED + dark mode css vars | ✅ Live |
| `4294a21` | Dynamic lookup DATA INICIO MATRICULA | ✅ Live |
| `d630b29` | Merge date fields + alias colunas | ✅ Live |
| `fa7fd85` | Dark mode: bg-card em aluno detail | ✅ Live |
| `1a73c34` | PDF regex boundaries + deficiência filter | ✅ Live |

### Bugs corrigidos:

- **#1 — Datas SED não capturadas** (dataFimMatricula + dataMovimentacao com fallback dinâmico) ✅
- **#2 — Faltas históricas apagadas na reimportação** (upsert por RA em vez de clear+insert) ✅
- **#3 — PDF export monospace** (substituído por HTML A4 formatado) ✅

---

## 6. DARK MODE

**Mecanismo:** CSS variables em `index.html` + `ThemeContext.tsx`
- `:root` = light, `[data-theme="dark"]` = dark
- 30+ variáveis CSS (`--bg`, `--text`, `--card`, `--border`, etc.)
- Persiste em `localStorage`
- Toggle no header via `🌙`/`☀️`

**Cobertura:** Todas as páginas adaptadas
- Tabelas usam `var(--row-even)`, `var(--row-odd)`
- Inputs usam `var(--input-bg)`
- Cores primárias adaptativas via `var(--primary-text)`

---

## 7. PARSERS (Importar.tsx — 1119 linhas)

### Formatos suportados:
- **PDF SED** "Relação de Alunos por Classe" — RA, nome, nascimento, situação, turma, professora
- **Excel SED** "Diário de Classe" — alunos + frequência por mês
- **Excel** "Turmas-Professores" — mapa turma → professora
- **TXT** Bolsa Família — NIS + responsável
- **PDF** Bolsa Família (parser separado)

### Funcionalidades:
- Matching aluno por RA → nome normalizado
- Normalização de turmas (aliases EJA, prefixos)
- Preview antes de importar (stats)
- **Modo upsert** (preserva faltas) implementado no commit `36057d5`

---

## 8. OCR

### Duas implementações paralelas:

#### OCR.tsx (Tesseract.js — grátis, local)
- `runTesseractOCR()` — reconhece texto da imagem
- `parseOCRText()` — extrai `Nº Nome <numero_faltas>`
- Interface de upload, revisão e salvamento
- **Sem suporte a grade de dias** (pendente — ver `acordos/PROMPT_FOLHA_OCR.md`)

#### Professor.tsx (Google Vision API — pago, nuvem)
- `ocr(base64, key)` — chama Google Vision
- `parseTexto(text)` — extrai faltas totais
- `cruzar()` — cruza com banco
- Cria `Pendente` para revisão (não salva direto)

---

## 9. EXPORTAÇÕES (Faltas.tsx)

| Botão | Função | Formato |
|---|---|---|
| 📊 Excel | `exportarExcel()` | XLSX com dias + totais |
| 📄 PDF | `exportarPDF()` | HTML A4 com cabeçalho/tabela/assinaturas |
| 📋 Folha OCR | `exportarFolhaOCR()` | **NÃO IMPLEMENTADO** — pendente |

---

## 10. PONTOS DE ATENÇÃO

### 🔴 Problemas conhecidos (não corrigidos):

1. **Falta página BolsaFamilia** — descrita no prompt de arquitetura mas não existe no código
2. **📋 Folha OCR não implementada** — prompt em `acordos/` aguardando aprovação
3. **Professor.tsx usa Google Vision** (pago) enquanto OCR.tsx usa Tesseract (gratuito) — duas lógicas paralelas
4. **`clearAlunos()` ainda existe em api.ts** — não é mais chamado no fluxo normal, mas pode ser invocado manualmente com efeitos destrutivos
5. **Importar.tsx tem 1119 linhas** — arquivo grande, difícil de manter

### 📋 Funcionalidades descritas em prompts mas não implementadas:
- Folha OCR (grade de dias para marcar X)
- Página BolsaFamilia
- Feature A: Numeração de chamada do SED
- Feature B: Exportação Excel aprimorada
- Feature C: Relatório completo para impressão

---

## 11. DEPENDÊNCIAS (package.json)

| Pacote | Versão | Uso |
|---|---|---|
| `@supabase/supabase-js` | ^2.43.4 | Backend |
| `pdfjs-dist` | ^4.0.379 | Parser PDF SED |
| `react` | ^18.3.1 | Framework |
| `react-router-dom` | ^6.23.1 | Rotas |
| `tesseract.js` | ^7.0.0 | OCR gratuito |
| `xlsx` | ^0.18.5 | Excel |
| `typescript` + `vite` + `@vitejs/plugin-react` | ^5 | Build |

---

## 12. GIT

```
branch: main
remote: origin (github.com/ricardojoliveira313/diario_classe)
último commit: de12ba4 - "fix: PDF export formatado A4 com tabela, assinaturas e destaques"
commits atrás do remote: 0 (up-to-date)
working tree: apenas pasta acordos/ (não commitada)
```
