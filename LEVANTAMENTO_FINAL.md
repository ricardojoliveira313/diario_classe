# Levantamento Final — Diário de Classe

**Data:** 23/05/2026
**URL produção:** https://diario.jroapp.com.br
**Repositório:** https://github.com/ricardojoliveira313/diario_classe
**Hosting:** Render (static site) + Supabase (PostgreSQL)

---

## 1. FUNCIONALIDADES (o que o sistema faz hoje)

| Página | Rota | O que faz | Funciona? |
|--------|------|-----------|-----------|
| 📊 **Dashboard** | `/` | Cards de resumo (total alunos, ativos, bolsa família, deficiências, turmas). Gráfico de distorção idade-série e alunos por turma. | ✅ Sim |
| 📥 **Importar** | `/importar` | Upload de PDFs, Excels (XLSX/XLS), TXT. Parser automático de 4 formatos: PDF SED, HTML SED (.xls), Excel de faltas, TXT Bolsa Família. Detecta EDUCACENSO, TURMA-PROFESSORES, BOLSA FAMÍLIA. Preview antes de importar. Upsert no banco. | ⚠️ Parcial — remanejamento e numeração com problemas |
| 👩‍🏫 **Turmas** | `/turmas` | Criar/editar/excluir turmas manualmente. Gerenciar nome, etapa, número, letra, período, professora. | ✅ Sim |
| 👥 **Alunos** | `/alunos` | Lista alunos com filtros (turma, professora, situação, deficiência, nome, bolsa família). Cards de estatísticas. Export Excel/PDF. Editar situação, datas, CPF, cor/raça. Expandir detalhes (remanejamento, matrícula, NIS, responsável). | ✅ Sim, com bugs na ordenação |
| 📋 **Faltas** | `/faltas` | Visualizar faltas por turma/mês/ano. Exportar: Excel, PDF, Folha OCR (para professor preencher), Grade de dias. Imprimir folhas de frequência. Registrar faltas manualmente. | ✅ Sim |
| 📐 **Distorção** | `/distorcao` | Cálculo de distorção idade-série por turma. Indicadores NSE (baixo, moderado, alto). | ✅ Sim |
| 📷 **OCR** | `/ocr` | Ler folhas de frequência fotografadas (Tesseract.js local + Google Vision). Reconhecer nome, número, faltas. Cruzar com banco. Exportar resultados. | ✅ Sim |
| ⏳ **Pendentes** | `/pendentes` | Visualizar/resolver pendências de importação. | ✅ Sim |
| 👥 **Usuários** | `/usuarios` | Gerenciar usuários de login. | ✅ Sim |
| 🔐 **Login** | (tela inicial) | Autenticação por usuário/senha. Perfis: admin (total), viewer (leitura). Sessão via sessionStorage. | ✅ Sim |

---

## 2. RESPONSIVIDADE

### Pontos fortes
- ✅ `meta viewport` configurado (`width=device-width, initial-scale=1.0`)
- ✅ `-webkit-tap-highlight-color: transparent` para mobile
- ✅ `-webkit-text-size-adjust: 100%` previne zoom indesejado no iOS
- ✅ Grid responsivo: `grid-template-columns: repeat(auto-fit, minmax(...))` nos filtros e cards
- ✅ Tema dark/light adaptável
- ✅ Navbar com sticky position e scroll detection
- ✅ CSS transitions suaves

### Pontos fracos
- ❌ **Tabela de alunos não é horizontalmente scrollável em mobile** — colunas como CPF e Cor/Raça podem quebrar em telas estreitas (400-480px)
- ❌ **Sem breakpoints explícitos** (@media queries) — o layout depende de `auto-fit` e `min-width`, que podem não ser ideais em telas < 360px
- ❌ **OCR usa bibliotecas pesadas** (Tesseract.js ~600KB, pdf.js ~400KB) — pode ser lento em mobile 3G
- ❌ **Importação é desktop-first** — upload de múltiplos arquivos PDF/Excel via celular é difícil
- ⚠️ A coluna de navegação `overflow: hidden` pode cortar itens em telas muito estreitas

### Nota: **6/10** — Funcional em tablet/desktop, pobre em celular pequeno

---

## 3. SEGURANÇA

### Pontos fortes
- ✅ **Autenticação em 2 camadas:** variáveis de ambiente (`VITE_USERS`) + tabela `Usuario` no Supabase
- ✅ **RBAC (Role-Based Access Control):** admin e viewer
- ✅ **AdminRoute guard:** redireciona viewers para `/`
- ✅ **Sessão via sessionStorage** — não persiste ao fechar o navegador
- ✅ **Supabase anon key** — chave pública, sem acesso admin ao banco
- ✅ **Senhas no formato texto** (gestao:gestao2026) — adequado para ambiente interno/escolar

### Pontos fracos
- ❌ **RLS desativado** em TODAS as tabelas (`DISABLE ROW LEVEL SECURITY`) — qualquer pessoa com a anon key pode ler/escrever tudo
- ❌ **Sem proteção CSRF** — sem tokens anti-CSRF nas requisições
- ❌ **Sem rate limiting** — a API do Supabase aceita requests ilimitados com a anon key
- ❌ **sessionStorage é vulnerável a XSS** — se houver injeção de script, as credenciais podem ser roubadas (mas o risco é baixo em app interno)
- ❌ **Senhas hardcoded como fallback** no código (`gestao:gestao2026`) — visível no source do frontend
- ❌ **Sem HTTPS enforcement** — Render deve configurar redirect HTTP→HTTPS

### Nota: **4/10** — Funcional para uso escolar interno, mas frágil para exposição pública

---

## 4. PRÓS E CONTRAS

### ✅ PRÓS

| Aspecto | Detalhe |
|---------|---------|
| **Design system consistente** | Tokens CSS, tema claro/escuro, componentes reutilizáveis |
| **Multi-formato** | Lê PDF, XLSX, XLS (HTML), TXT — flexível para diferentes fontes da SED |
| **Offline-ready (OCR)** | Tesseract.js roda localmente, sem dependência de API paga |
| **SPA rápido** | Vite build, bundle ~388KB gzip, carregamento instantâneo após primeiro load |
| **Exportação completa** | Excel, PDF, folhas de frequência, grade OCR — múltiplos formatos de saída |
| **Preview antes de importar** | Usuário vê quantos alunos/turmas/faltas serão afetados antes de confirmar |
| **Preservação de dados** | Upsert por ID, faltas acumulativas, datas preservadas entre importações |
| **Colunas do SED** | RA, Dig. RA, CPF, NIS, data início/fim/movimentação, deficiência, cor/raça — schema completo |
| **Detecção automática** | Identifica tipo de arquivo (EDUCACENSO, BOLSA FAMÍLIA, TURMA-PROFESSORES) por conteúdo |

### ❌ CONTRAS

| Aspecto | Detalhe |
|---------|---------|
| **Numeração** | Alunos sem `Nº` (TRAN/REMA via Excel) vão pro final da lista, quebrando a ordem SED |
| **Merge PDF vs Excel** | O mergeAluno não trata corretamente quando PDF e Excel têm dados conflitantes |
| **REMA sem número** | Registros REMA criados pelo `ehRemaDuplo` não herdam o `Nº` do PDF de origem |
| **Sem persistência do Nº** | Alunos novos (manuais, sem SED) ficam com `numero=0` e mudam de posição a cada import |
| **Dependência do Excel** | O sistema insiste em usar Excel como fonte, quando 99% dos dados estão no PDF |
| **Ordenação instável** | Mudanças frequentes no algoritmo de sort (data_matricula → numero → data_matricula) |
| **Tabela não scrollável** | Em mobile, a tabela de alunos não tem scroll horizontal |
| **Bundle grande** | 1.2MB principal (Tesseract + pdf.js + xlsx) — lento em conexões ruins |
| **RLS desativado** | Segurança depende exclusivamente do frontend, sem proteção no banco |
| **Sem testes** | Não há testes unitários, de integração ou E2E |
| **Sem documentação** | Sem README funcional, sem documentação de API, sem guia de deploy |

---

## 5. ERROS E PROBLEMAS ENCONTRADOS

### Erro 1: Ordenação — `numero=0` vai pro final
**Arquivo:** `Alunos.tsx` linha 57
**Causa:** `(a.numero || 9999) - (b.numero || 9999)` coloca alunos sem número no fim.
**Impacto:** TRAN/REMA sem `Nº` do Excel aparecem no final, quebrando a ordem SED.
**Status:** ❌ Não resolvido — o sort atual é por `numero` com fallback 9999.

### Erro 2: REMA não herda Nº do PDF
**Arquivo:** `Importar.tsx` linha ~868 (`ehRemaDuplo`)
**Causa:** O registro REMA (criado em `RA:XXXX|REMA`) nunca é atualizado pelo PDF porque `mkKey()` retorna a chave principal.
**Impacto:** Alunos remanejados aparecem sem número na turma de origem.
**Status:** ❌ Não resolvido

### Erro 3: Data de matrícula vs Numeração
**Arquivo:** `Alunos.tsx`, `Faltas.tsx`, `api.ts`
**Causa:** Algoritmo de ordenação foi alterado 3 vezes (data_matricula → numero → data_matricula → numero), sem consenso.
**Impacto:** Inconsistência entre SED e Diário.
**Status:** ⚠️ Instável — último commit usa `numero`, mas API consulta por `data_inicio_matricula`

### ⚠️ Inconsistência: API vs Frontend
- **API (`api.ts`):** ordena por `data_inicio_matricula`
- **Frontend (`Alunos.tsx`):** ordena por `numero`  
**Impacto:** A ordem que vem do banco é diferente da ordem exibida. Alunos podem "pular" de posição.

### Erro 4: Bundle warning
**Build output:** "Some chunks are larger than 500 kB" — o bundle principal tem 1.274 KB (388 KB gzip).
**Causa:** Tesseract.js, pdf.js e xlsx incluídos no bundle principal.
**Impacto:** Carregamento lento em conexões 3G/móvel.
**Status:** ⚠️ Não crítico, mas deve ser otimizado com code splitting

### Erro 5: `index-C98PHkKw.js` hash fixo pode causar cache
O nome do chunk contém hash, mas não está claro se o cache busting funciona no Render.

---

## 6. CONTEXTO — O QUE O DIÁRIO DE CLASSE DEVERIA SER

### Objetivo real
O Diário de Classe é um **espelho digital** do banco de dados da **Secretaria Escolar Digital (SED)**. Ele deve:

1. **Importar dados da SED** (via PDFs e Excels exportados)
2. **Exibir exatamente o que está na SED**, sem transformações
3. **Complementar com dados adicionais** (faltas mensais, bolsa família, EDUCACENSO)
4. **Servir como diário de frequência** para os professores
5. **Gerar relatórios** (faltas, distorção, folhas de chamada)

### O que está errado hoje
- O sistema **inventa sua própria ordenação** em vez de usar a da SED
- A **numeração** (Nº da chamada) é inconsistente
- O **mergeAluno** prioriza Excel sobre PDF (deveria ser o contrário)
- A tabela de alunos **agrupa por situação**, quebrando a ordem natural do SED
- Alunos **transferidos/remanejados** perdem seu número de chamada

### O que falta
- [ ] Ordenação **fixa** igual ao SED (por `numero` do PDF, sem reordenar por situação)
- [ ] **Nº da chamada** preservado para TODOS os alunos (inclusive TRAN, REMA, ABANDONO)
- [ ] **PDF como fonte primária** absoluta — Excel só para faltas
- [ ] Alunos **manuais** (fora do SED) recebem o próximo Nº disponível baseado na data de matrícula
- [ ] "Todas as turmas" mostra cada turma com sua **própria numeração 1-N**

---

## 7. ARQUITETURA TÉCNICA

```
Frontend (React + Vite + TypeScript)
    │
    ├── Supabase JS Client (direto, sem backend intermediário)
    │       │
    │       └── Supabase PostgreSQL
    │               ├── Turma
    │               ├── Aluno
    │               ├── Falta
    │               ├── Pendente
    │               ├── Educacenso
    │               └── Usuario
    │
    ├── Tesseract.js (OCR local)
    ├── pdf.js (parse de PDFs SED)
    └── xlsx (parse de Excel)

Backend (Express + Prisma) — ALTERNATIVO, não usado atualmente
```

---

## 8. ESTATÍSTICAS DO CÓDIGO

| Métrica | Valor |
|---------|-------|
| Total de arquivos fonte | ~25 |
| Linhas totais de código | ~7.000 |
| Maior arquivo | `Importar.tsx` (~1.527 linhas) |
| Componentes reutilizáveis | 11 |
| Páginas/rotas | 11 |
| Tabelas SQL | 6 |
| Commits totais | ~50 |
| Deploy automático | Sim (Render) |
| Build time | ~2.7s |
| Bundle size | 388 KB (gzip) |

---

## 9. RECOMENDAÇÕES PARA A PRÓXIMA EQUIPE

### Prioridade 1 — Correção da ordenação
1. Unificar ordenação: usar APENAS `numero` do SED, sem fallback de situação
2. Garantir que TODOS os alunos (ATIVO, REMA, TRAN, ABANDONO, N COM) tenham `numero` preenchido
3. No `ehRemaDuplo`, copiar `numero` da entrada original para o registro REMA
4. Reverter `api.ts` para ordenar por `numero` (não `data_inicio_matricula`)

### Prioridade 2 — PDF como fonte primária
1. `mergeAluno` deve priorizar SEMPRE os campos do PDF sobre o Excel  
2. Remover extração de `numero`, `situacao`, `serie`, `professora` do Excel (deixar o PDF mandar)
3. Excel deve fornecer APENAS: faltas mensais, bolsa família (se não vier do PDF)

### Prioridade 3 — Segurança
1. Ativar RLS no Supabase com políticas por perfil
2. Mover fallback de senhas para `.env` (não hardcoded)
3. Adicionar rate limiting via Supabase

### Prioridade 4 — Performance
1. Code splitting: separar Tesseract.js e pdf.js em chunks lazy-load
2. Otimizar tabela de alunos para mobile (scroll horizontal)
3. Adicionar @media queries para breakpoints explícitos
