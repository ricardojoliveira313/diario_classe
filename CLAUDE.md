# Diário de Classe — Instruções para Claude

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

### Regras de negócio importantes
- **ATIVO**: `situacao === 'ATIVO'` OU `situacao` vazio/nulo
- **Excluídos das contagens**: REMA, TRAN, BXTR
- **Bolsa Família, Educacenso e Professores** são dados fixos/sazonais — não precisam ser re-importados a cada ciclo
- **Importação diária**: FUNDAMENTAL, INFANTIL, ALFABETIZACAO, POS-ALFABETIZACAO, AEE
- **Remanejamento**: aluno REMA (origem) + ATIVO (destino) = mesmo aluno, conta apenas o ATIVO
