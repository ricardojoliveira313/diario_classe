# Diário de Classe — Instruções para Claude

## Idioma e Localização

O utilizador é do **Brasil**. A língua de comunicação é **português do Brasil (pt-BR)**. Todas as respostas, mensagens de commit, descrições de PR e comentários devem ser escritos em português brasileiro.

---

## 🚨 REGRA OBRIGATÓRIA: Fluxo Git Completo

**SEMPRE que fizeres qualquer alteração de código**, deves completar TODO o fluxo abaixo sem exceção:

1. **`git add`** — adicionar todos os ficheiros alterados
2. **`git commit`** — commit com mensagem descritiva
3. **`git push -u origin <branch>`** — push para o repositório remoto
4. **Criar PR** — via `mcp__github__create_pull_request` se não existir (sempre como draft primeiro)
5. **Converter draft → ready** — via `mcp__github__update_pull_request` com `draft: false`
6. **Merge** — via `mcp__github__merge_pull_request` com `merge_method: "squash"`

**Nunca** deixar alterações sem commit, push e merge. O utilizador precisa que o sistema esteja sempre actualizado e disponível para uso imediato.

### Branch de trabalho
- Branch activa: `claude/affectionate-mendel-BDNAf`
- Base (merge target): `main`
- Repositório: `ricardojoliveira313/diario_classe`

### Após cada merge
Confirmar sempre que o merge foi feito e o sistema está actualizado.

---

## Projecto

**Diário de Classe** — Sistema de gestão escolar (faltas, alunos, turmas) para a escola.

### Stack
- **Frontend**: React + TypeScript + Vite (pasta `frontend/`)
- **Backend de dados**: Supabase (PostgreSQL + Auth + Realtime)
- **Deploy**: Render (site estático)

### Tabelas Supabase principais
- `Turma` — turmas com `nome`, `professora`, `periodo`
- `Aluno` — alunos com `ra`, `nome`, `turmaId`, `situacao`, `deficiencia`, `bolsa_familia`, `nis`, `cpf`
- `Falta` — faltas por aluno e mês
- `Educacenso` — tabela fixa com CPF, deficiência, cor/raça (importação sazonal)
- `Usuario` — utilizadores com permissões e turma associada

### Ficheiros principais
- `frontend/src/pages/Importar.tsx` — importação de dados SED
- `frontend/src/pages/Dashboard.tsx` — painel de indicadores
- `frontend/src/pages/Faltas.tsx` — lançamento de faltas
- `frontend/src/pages/Turmas.tsx` — gestão de turmas
- `frontend/src/pages/Alunos.tsx` — listagem de alunos

---

## 🧠 Regra de Diagnóstico

**Antes de qualquer alteração de código, ir direto à raiz do problema.**

- Ler o código relevante primeiro, completamente, antes de formar hipóteses
- Identificar TODAS as causas raiz de uma vez — não corrigir uma por vez às cegas
- Nunca ficar rodando em hipóteses sem confirmar no código
- Se o bug é em X, ler X até o fim, mapear o fluxo completo, depois corrigir
- Uma análise completa no início vale mais do que dez tentativas erradas

### Verificação preventiva de números/telas (aprendizado real — set/2026)

Em set/2026, revisei "Genero.tsx"/"MatriculasMensais.tsx" a pedido do utilizador
e não encontrei o bug: um filtro em `alunosFiltrados` descartava TRAN/BXTR/N COM/ABAN
*antes* de chegar em `calcularMatriculasMensais`, deixando a coluna "Saídas no mês"
matematicamente travada em zero em todos os meses — só descobri isso quando o
utilizador colou os números reais da tela e a coluna Saídas apareceu zerada em 8
meses seguidos com 855 matrículas, algo implausível. Lendo o código isoladamente,
cada função parecia correta; o bug só existia na integração entre duas delas.

Esta escola atende alunos com deficiência e depende deste app para dados reais —
um número errado não é cosmético. Por isso, sempre que for pedido para "verificar
se algo está funcionando/correto" numa tela de números, painel ou relatório:

1. **Não me contentar em ler o código e concluir "parece certo".** Ler o código
   prova que a lógica existe; não prova que ela é alimentada com os dados certos.
2. **Pedir (ou, se possível, obter sozinho) um valor real da tela/BD para
   comparar com o esperado**, especialmente colunas que deveriam variar com o
   tempo (entradas, saídas, movimentação) — se algo que deveria mudar aparece
   sempre zerado/igual, é sinal de alerta, não coincidência.
3. **Rodar o app localmente (Playwright/dev server) com dados de teste
   quando isso for viável**, em vez de confiar só em leitura estática de código,
   principalmente antes de responder "está tudo certo" a uma pergunta sobre
   dados educacionais reais.
4. **Ao corrigir esse tipo de bug, considerar adicionar um teste automatizado**
   para a função de cálculo afetada (ex.: `matriculasMensais.ts` não tem testes
   hoje) — evita que o mesmo tipo de regressão silenciosa volte a passar
   despercebida numa próxima alteração.

---

### Regras de negócio importantes
- **ATIVO**: `situacao === 'ATIVO'` OU `situacao` vazio/nulo
- **Excluídos das contagens**: REMA, TRAN, BXTR
- **Bolsa Família, Educacenso e Professores** são dados fixos/sazonais — não precisam ser re-importados a cada ciclo
- **Importação diária**: FUNDAMENTAL, INFANTIL, ALFABETIZACAO, POS-ALFABETIZACAO, AEE
- **Remanejamento**: aluno REMA (origem) + ATIVO (destino) = mesmo aluno, conta apenas o ATIVO
